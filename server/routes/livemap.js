const express = require('express');
const router = express.Router();
const { getCollectionAsync } = require('../db');

// =========================================================================
// GET /api/livemap - Unified Real-Time GIS Layer Feed
//
// Single endpoint that aggregates every map-relevant data source (active
// disasters, NER landslide risk zones, shelters, hospitals, volunteers,
// citizen/field hazard reports, and sponsor equipment delivery points) into
// one consistent point-feature format so the frontend only needs one poll
// loop to redraw the whole live map instead of 6+ separate fetches.
//
// ASSUMPTIONS (flag for correction):
// 1. "Live" here means near-real-time via short-interval polling (default
//    poll suggestion below), not a websocket/SSE push channel. Swapping to
//    push (Supabase Realtime channels are the natural fit since the tables
//    already live in Postgres) is a follow-up if sub-second latency matters.
// 2. Every layer is returned in one payload; ?layers=disasters,landslide
//    lets the client fetch a subset for lower bandwidth (helps with the
//    "low-network NER" requirement) - optional, defaults to all layers.
// 3. Risk scoring for landslide zones is duplicated from
//    routes/landslide.js on purpose (kept tiny + dependency-free) rather
//    than imported, so this endpoint can't break if that route changes
//    shape. If you refactor the risk model, update both places or extract
//    it into server/lib/riskModel.js.
// =========================================================================

function computeLandslideRisk(zone) {
  const rainfallScore = Math.min((zone.rainfall_mm_24h || 0) / 300, 1) * 40;
  const slopeScore = Math.min((zone.slope_angle_deg || 0) / 60, 1) * 25;
  const saturationScore = Math.min((zone.soil_saturation_percent || 0) / 100, 1) * 25;
  const historyScore = Math.min((zone.historical_incidents_5yr || 0) / 10, 1) * 10;
  const score = Math.round(rainfallScore + slopeScore + saturationScore + historyScore);
  let level = 'LOW';
  if (score >= 75) level = 'CRITICAL';
  else if (score >= 55) level = 'HIGH';
  else if (score >= 35) level = 'MODERATE';
  return { risk_score: score, risk_level: level };
}

const ALL_LAYERS = ['disasters', 'landslide_zones', 'shelters', 'hospitals', 'volunteers', 'field_reports', 'sponsor_equipment'];

router.get('/', async (req, res) => {
  try {
    const requested = (req.query.layers ? req.query.layers.split(',').map(l => l.trim()) : ALL_LAYERS)
      .filter(l => ALL_LAYERS.includes(l));

    const wanted = requested.length ? requested : ALL_LAYERS;
    const need = (layer) => wanted.includes(layer);

    const [disasters, landslideZones, shelters, hospitals, volunteers, fieldReports, equipment] = await Promise.all([
      need('disasters') ? getCollectionAsync('disasters') : [],
      need('landslide_zones') ? getCollectionAsync('landslide_zones') : [],
      need('shelters') ? getCollectionAsync('shelters') : [],
      need('hospitals') ? getCollectionAsync('hospitals') : [],
      need('volunteers') ? getCollectionAsync('volunteers') : [],
      need('field_reports') ? getCollectionAsync('field_reports') : [],
      need('sponsor_equipment') ? getCollectionAsync('sponsor_donated_equipment') : []
    ]);

    const features = [];

    if (need('disasters')) {
      disasters.forEach(d => features.push({
        layer: 'disasters',
        id: d.id,
        lat: d.lat,
        lng: d.lng,
        title: d.title,
        severity: d.severity,
        status: d.status,
        radius_km: d.radius_km,
        popup: `${d.category} · ${d.location_name} · ${d.affected_population || 0} affected`
      }));
    }

    if (need('landslide_zones')) {
      landslideZones.forEach(z => {
        const risk = computeLandslideRisk(z);
        features.push({
          layer: 'landslide_zones',
          id: z.id,
          lat: z.lat,
          lng: z.lng,
          title: `${z.location_name}, ${z.state}`,
          severity: risk.risk_level,
          risk_score: risk.risk_score,
          rainfall_mm_24h: z.rainfall_mm_24h,
          soil_saturation_percent: z.soil_saturation_percent,
          last_updated: z.last_updated,
          popup: `Rainfall ${z.rainfall_mm_24h}mm/24h · Saturation ${z.soil_saturation_percent}% · Risk ${risk.risk_level} (${risk.risk_score}/100)`
        });
      });
    }

    if (need('shelters')) {
      shelters.forEach(s => features.push({
        layer: 'shelters',
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        title: s.name,
        status: s.status,
        popup: `Occupancy ${s.current_occupancy}/${s.capacity} · ${s.status}`
      }));
    }

    if (need('hospitals')) {
      hospitals.forEach(h => features.push({
        layer: 'hospitals',
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        title: h.name,
        status: h.status,
        popup: `Available beds ${h.available_beds}/${h.total_beds} · ICU ${h.icu_beds}`
      }));
    }

    if (need('volunteers')) {
      volunteers.forEach(v => features.push({
        layer: 'volunteers',
        id: v.id,
        lat: v.lat,
        lng: v.lng,
        title: v.full_name,
        status: v.status,
        popup: `${(v.skills || []).join(', ')} · ${v.status}`
      }));
    }

    if (need('field_reports')) {
      fieldReports.forEach(f => features.push({
        layer: 'field_reports',
        id: f.id,
        lat: f.lat,
        lng: f.lng,
        title: f.incident_type,
        status: f.status,
        photo_url: f.photo_url || null,
        popup: `${f.location_name} · reported by ${f.reporter_name || 'Citizen'}`
      }));
    }

    if (need('sponsor_equipment')) {
      equipment
        .filter(e => e.delivery_lat && e.delivery_lng)
        .forEach(e => features.push({
          layer: 'sponsor_equipment',
          id: e.id,
          lat: e.delivery_lat,
          lng: e.delivery_lng,
          title: e.equipment_name,
          status: e.dispatch_status,
          photo_url: e.proof_image_url || null,
          popup: `${e.sponsor_name} · ${e.deployed_location} · ${e.dispatch_status}`
        }));
    }

    res.json({
      success: true,
      generated_at: new Date().toISOString(),
      recommended_poll_interval_seconds: 30,
      layers_included: wanted,
      total_features: features.length,
      counts_by_layer: wanted.reduce((acc, l) => {
        acc[l] = features.filter(f => f.layer === l).length;
        return acc;
      }, {}),
      features
    });
  } catch (err) {
    console.error('Livemap Error:', err);
    res.status(500).json({ success: false, error: 'Failed to build live map feed' });
  }
});

module.exports = router;
