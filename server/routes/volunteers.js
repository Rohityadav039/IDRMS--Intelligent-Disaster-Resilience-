const express = require('express');
const router = express.Router();
const { getCollectionAsync, updateRecordAsync } = require('../db');
const { authenticateToken } = require('./auth');

// Calculate distance between two lat/lng coordinates in km (Haversine formula)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Get all volunteers around a target lat/lng or search query
router.get('/', async (req, res) => {
  try {
    const volunteers = await getCollectionAsync('volunteers');
    const lat = req.query.lat ? parseFloat(req.query.lat) : 28.6139;
    const lng = req.query.lng ? parseFloat(req.query.lng) : 77.2090;
    const radiusKm = req.query.radius ? parseFloat(req.query.radius) : 50; // default 50km
    const skill = req.query.skill;

    let list = volunteers.map(v => {
      const dist = getDistanceKm(lat, lng, v.lat, v.lng);
      return { ...v, distance_km: Math.round(dist * 10) / 10 };
    });

    if (radiusKm) {
      list = list.filter(v => v.distance_km <= radiusKm);
    }

    if (skill) {
      list = list.filter(v => (v.skills || []).some(s => s.toLowerCase().includes(skill.toLowerCase())));
    }

    list.sort((a, b) => a.distance_km - b.distance_km);

    res.json({
      total_found: list.length,
      volunteers: list
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load volunteers' });
  }
});

// Update volunteer duty status or location
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, lat, lng, location_name } = req.body;
    const volunteers = await getCollectionAsync('volunteers');
    const volunteer = volunteers.find(v => v.id === req.params.id || v.user_id === req.user.id);

    if (!volunteer) return res.status(404).json({ error: 'Volunteer profile not found' });

    const updates = { last_active: new Date().toISOString() };
    if (status) updates.status = status;
    if (lat) updates.lat = parseFloat(lat);
    if (lng) updates.lng = parseFloat(lng);
    if (location_name) updates.location_name = location_name;

    const updated = await updateRecordAsync('volunteers', volunteer.id, updates);
    res.json({ message: 'Volunteer status updated', volunteer: updated || { ...volunteer, ...updates } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update volunteer status' });
  }
});

module.exports = router;
