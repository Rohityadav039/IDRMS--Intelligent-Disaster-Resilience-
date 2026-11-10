const express = require('express');
const router = express.Router();
const { getCollectionAsync, insertRecordAsync, updateRecordAsync } = require('../db');
const { authenticateToken, requireAdmin } = require('./auth');

// Get all disaster incidents
router.get('/', async (req, res) => {
  try {
    const disasters = await getCollectionAsync('disasters');
    res.json(disasters);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load disasters' });
  }
});

// Create new disaster incident (Admin / FirstResponder)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, category, severity, location_name, lat, lng, radius_km, affected_population, description } = req.body;

    if (!title || !category || !severity) {
      return res.status(400).json({ error: 'Title, category, and severity are required' });
    }

    const newDisaster = {
      id: `DIS-${Date.now().toString().slice(-4)}`,
      title,
      category: category || 'General',
      severity: severity || 'AMBER',
      location_name: location_name || 'NCR Sector',
      lat: parseFloat(lat) || 28.6139,
      lng: parseFloat(lng) || 77.2090,
      radius_km: parseFloat(radius_km) || 5.0,
      affected_population: parseInt(affected_population) || 0,
      status: 'ACTIVE',
      reported_by: req.user.name || 'Emergency Command Center',
      description: description || '',
      created_at: new Date().toISOString()
    };

    const insertedDisaster = await insertRecordAsync('disasters', newDisaster);

    // Auto-create initial emergency alert for RED/AMBER disasters
    const newAlert = {
      id: `ALT-${Date.now().toString().slice(-4)}`,
      title: `${severity} ALERT: ${title}`,
      message: `Emergency Alert for ${location_name}: ${description || 'Please remain vigilant and follow NDMA instructions.'}`,
      disaster_id: insertedDisaster.id,
      severity: severity === 'RED' ? 'CRITICAL' : 'WARNING',
      broadcast_area: location_name,
      target_audience: 'ALL_CITIZENS',
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'ACTIVE'
    };
    const insertedAlert = await insertRecordAsync('alerts', newAlert);

    res.status(201).json({ disaster: insertedDisaster, alert: insertedAlert });
  } catch (err) {
    console.error("Create Disaster Error:", err);
    res.status(500).json({ error: 'Failed to report disaster incident' });
  }
});

// Update disaster status (ACTIVE, CONTAINED, RESOLVED)
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const disaster = await updateRecordAsync('disasters', req.params.id, { status });
    if (!disaster) return res.status(404).json({ error: 'Disaster incident not found' });
    res.json({ message: 'Disaster status updated', disaster });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update disaster status' });
  }
});

// Get active alerts ticker
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await getCollectionAsync('alerts');
    res.json(alerts.filter(a => a.status === 'ACTIVE'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load alerts' });
  }
});

// Post emergency alert broadcast (Admin / FirstResponder)
router.post('/alerts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title, message, severity, broadcast_area } = req.body;

    const newAlert = {
      id: `ALT-${Date.now().toString().slice(-4)}`,
      title,
      message,
      disaster_id: req.body.disaster_id || 'GENERAL',
      severity: severity || 'WARNING',
      broadcast_area: broadcast_area || 'All Districts',
      target_audience: 'ALL_CITIZENS',
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: 'ACTIVE'
    };

    const inserted = await insertRecordAsync('alerts', newAlert);
    res.status(201).json(inserted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to broadcast alert' });
  }
});

module.exports = router;
