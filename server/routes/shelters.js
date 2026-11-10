const express = require('express');
const router = express.Router();
const { getCollectionAsync, updateRecordAsync } = require('../db');
const { authenticateToken } = require('./auth');

// Get all emergency relief shelters
router.get('/shelters', async (req, res) => {
  try {
    res.json(await getCollectionAsync('shelters'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load shelters' });
  }
});

// Update shelter occupancy
router.patch('/shelters/:id/occupancy', authenticateToken, async (req, res) => {
  try {
    const { current_occupancy, status } = req.body;
    const updates = {};
    if (current_occupancy !== undefined) updates.current_occupancy = parseInt(current_occupancy);
    if (status) updates.status = status;

    const shelter = await updateRecordAsync('shelters', req.params.id, updates);
    if (!shelter) return res.status(404).json({ error: 'Shelter not found' });

    res.json({ message: 'Shelter capacity updated', shelter });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update shelter' });
  }
});

// Get all emergency hospitals & medical centers
router.get('/hospitals', async (req, res) => {
  try {
    res.json(await getCollectionAsync('hospitals'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load hospitals' });
  }
});

// Get emergency resources & supplies
router.get('/resources', async (req, res) => {
  try {
    res.json(await getCollectionAsync('resources'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load resources' });
  }
});

// Get emergency insurance & disaster assistance funds
router.get('/assistance', async (req, res) => {
  try {
    res.json(await getCollectionAsync('insurance_assistance'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load assistance schemes' });
  }
});

// Get evacuation routes
router.get('/routes', async (req, res) => {
  try {
    res.json(await getCollectionAsync('evacuation_routes'));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load evacuation routes' });
  }
});

module.exports = router;
