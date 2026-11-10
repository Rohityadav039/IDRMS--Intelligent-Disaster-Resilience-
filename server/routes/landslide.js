const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { getCollectionAsync, insertRecordAsync, updateRecordAsync } = require('../db');
const { authenticateToken, requireAdmin } = require('./auth');
const { uploadMedia } = require('../lib/mediaStorage');

// Ground-observation photos (cracks, seepage, slope movement) are buffered
// in memory then pushed to Supabase Storage via uploadMedia(); falls back to
// public/uploads/reports/ when Supabase Storage isn't configured.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// --- NER Landslide Early-Warning Risk Model ------------------------------
// ASSUMPTION: this is still the rule-based weighted index (rainfall 40%,
// slope 25%, soil saturation 25%, historical incidents 10%) documented in
// docs/NER_LANDSLIDE_PROBLEM_STATEMENT.md as "v1". Swapping in a trained
// ML/satellite-imagery model is a follow-up; the API shape below (risk_score,
// risk_level, model) is designed so a real model can be dropped in without
// changing any consumer (dashboard, /api/livemap, alerts).
function computeRisk(zone) {
  const rainfallScore = Math.min(zone.rainfall_mm_24h / 300, 1) * 40;
  const slopeScore = Math.min(zone.slope_angle_deg / 60, 1) * 25;
  const saturationScore = Math.min(zone.soil_saturation_percent / 100, 1) * 25;
  const historyScore = Math.min(zone.historical_incidents_5yr / 10, 1) * 10;

  const score = Math.round(rainfallScore + slopeScore + saturationScore + historyScore);

  let level = 'LOW';
  if (score >= 75) level = 'CRITICAL';
  else if (score >= 55) level = 'HIGH';
  else if (score >= 35) level = 'MODERATE';

  return { risk_score: score, risk_level: level };
}

function withRisk(zone) {
  return { ...zone, ...computeRisk(zone), model: 'IDRMS Weighted Risk Index v1 (rule-based)' };
}

// GET /api/landslide/zones - all monitored NER zones with live risk score
router.get('/zones', async (req, res) => {
  try {
    const zones = (await getCollectionAsync('landslide_zones')).map(withRisk);
    res.json({ total: zones.length, zones });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load landslide zones' });
  }
});

// GET /api/landslide/alerts - HIGH/CRITICAL zones formatted as early warnings
router.get('/alerts', async (req, res) => {
  try {
    const zones = (await getCollectionAsync('landslide_zones')).map(withRisk);
    const warnings = zones
      .filter(z => z.risk_level === 'HIGH' || z.risk_level === 'CRITICAL')
      .map(z => ({
        id: `LSW-${z.id}`,
        zone_id: z.id,
        state: z.state,
        location_name: z.location_name,
        risk_level: z.risk_level,
        risk_score: z.risk_score,
        message: `${z.risk_level} landslide risk in ${z.location_name}, ${z.state}. Rainfall ${z.rainfall_mm_24h}mm/24h, soil saturation ${z.soil_saturation_percent}%. ${z.risk_level === 'CRITICAL' ? 'Evacuation of vulnerable slopes recommended.' : 'Residents on steep slopes should stay alert.'}`,
        issued_at: new Date().toISOString()
      }));
    res.json({ total: warnings.length, warnings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute landslide alerts' });
  }
});

// POST /api/landslide/zones - register a new monitored zone (Admin / FirstResponder)
router.post('/zones', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { state, location_name, lat, lng, slope_angle_deg, rainfall_mm_24h, soil_saturation_percent, historical_incidents_5yr } = req.body;

    if (!state || !location_name || lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'state, location_name, lat and lng are required' });
    }

    const zone = {
      id: `LSZ-${Date.now().toString().slice(-5)}`,
      state,
      location_name,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      slope_angle_deg: parseFloat(slope_angle_deg) || 20,
      rainfall_mm_24h: parseFloat(rainfall_mm_24h) || 40,
      soil_saturation_percent: parseFloat(soil_saturation_percent) || 40,
      historical_incidents_5yr: parseInt(historical_incidents_5yr) || 0,
      last_updated: new Date().toISOString()
    };

    const inserted = await insertRecordAsync('landslide_zones', zone);
    res.status(201).json(withRisk(inserted));
  } catch (err) {
    console.error('Create Landslide Zone Error:', err);
    res.status(500).json({ error: 'Failed to create monitoring zone' });
  }
});

// PATCH /api/landslide/zones/:id/telemetry - push fresh sensor/rainfall telemetry
// ASSUMPTION: any authenticated user may push telemetry (sensor gateways
// authenticate with a service account token). Tighten to requireAdmin if
// telemetry should only come from a trusted ingestion service.
router.patch('/zones/:id/telemetry', authenticateToken, async (req, res) => {
  try {
    const { rainfall_mm_24h, soil_saturation_percent } = req.body;
    const updates = { last_updated: new Date().toISOString() };
    if (rainfall_mm_24h !== undefined) updates.rainfall_mm_24h = parseFloat(rainfall_mm_24h);
    if (soil_saturation_percent !== undefined) updates.soil_saturation_percent = parseFloat(soil_saturation_percent);

    const zone = await updateRecordAsync('landslide_zones', req.params.id, updates);
    if (!zone) return res.status(404).json({ error: 'Monitoring zone not found' });

    res.json(withRisk(zone));
  } catch (err) {
    console.error('Landslide Telemetry Update Error:', err);
    res.status(500).json({ error: 'Failed to update zone telemetry' });
  }
});

// GET /api/landslide/reports - all ground observation reports
router.get('/reports', async (req, res) => {
  try {
    const reports = await getCollectionAsync('landslide_ground_reports');
    res.json({ total: reports.length, reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load landslide ground reports' });
  }
});

// POST /api/landslide/reports - ground report with optional geo-tagged photo
router.post('/reports', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { zone_id, observation_type, description } = req.body;
    if (!zone_id || !observation_type) {
      return res.status(400).json({ error: 'zone_id and observation_type are required' });
    }

    const zones = await getCollectionAsync('landslide_zones');
    const zone = zones.find(z => z.id === zone_id);
    if (!zone) return res.status(404).json({ error: 'Monitoring zone not found' });

    let photo_url = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname || '') || '.jpg';
      const uploaded = await uploadMedia({
        buffer: req.file.buffer,
        folder: 'reports',
        filename: `landslide_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`,
        mimetype: req.file.mimetype
      });
      photo_url = uploaded.url;
    } else if (req.body.photo_url) {
      photo_url = req.body.photo_url;
    }

    const report = {
      id: `LSR-${Date.now().toString().slice(-5)}`,
      zone_id,
      zone_location: zone.location_name,
      observation_type,
      description: description || '',
      reported_by: req.user.name,
      reported_by_role: req.user.role,
      photo_url: photo_url || null,
      submitted_at: new Date().toISOString()
    };

    const insertedReport = await insertRecordAsync('landslide_ground_reports', report);

    const bump = { 'Crack Sighted': 4, 'Water Seepage': 6, 'Minor Slide': 12, 'Major Slide / Road Blocked': 20, 'Trees Tilting': 8 };
    const zoneUpdates = {
      soil_saturation_percent: Math.min(100, zone.soil_saturation_percent + (bump[observation_type] || 3)),
      historical_incidents_5yr: observation_type.includes('Slide') ? zone.historical_incidents_5yr + 1 : zone.historical_incidents_5yr,
      last_updated: new Date().toISOString()
    };
    const updatedZone = await updateRecordAsync('landslide_zones', zone_id, zoneUpdates);

    res.status(201).json({ message: 'Ground observation report submitted and risk index updated', report: insertedReport, zone: withRisk(updatedZone || { ...zone, ...zoneUpdates }) });
  } catch (err) {
    console.error('Landslide Report Error:', err);
    res.status(500).json({ error: 'Failed to submit ground report' });
  }
});

module.exports = router;
