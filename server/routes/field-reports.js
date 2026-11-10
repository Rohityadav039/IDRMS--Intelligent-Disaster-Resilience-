const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { getCollectionAsync, insertRecordAsync } = require('../db');
const { authenticateToken } = require('./auth');
const { uploadMedia } = require('../lib/mediaStorage');

// Citizen/field-official geo-tagged photos (cracks, slope movement, blocked
// roads) are buffered in memory then pushed to Supabase Storage via
// uploadMedia(); falls back to public/uploads/field/ when Supabase Storage
// isn't configured, so field reporting keeps working offline/low-network.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GET /api/field-reports - List all citizen/field geo-tagged photo reports
router.get('/', async (req, res) => {
  try {
    const reports = await getCollectionAsync('field_reports');
    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/field-reports - Upload geo-tagged photo report (cracks, slope movement, road blockages)
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { incident_type, location_name, lat, lng, description, reporter_name, reporter_role } = req.body;

    if (!incident_type || !location_name) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields (incident_type, location_name)"
      });
    }

    let photo_url = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname || '') || '.jpg';
      const uploaded = await uploadMedia({
        buffer: req.file.buffer,
        folder: 'field',
        filename: `field_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`,
        mimetype: req.file.mimetype
      });
      photo_url = uploaded.url;
    } else if (req.body.photo_url) {
      photo_url = req.body.photo_url;
    }

    const newFieldReport = {
      id: `FLD-${Date.now().toString().slice(-6)}`,
      incident_type: incident_type || 'Slope / Road Hazard',
      location_name,
      lat: parseFloat(lat) || 26.1445,
      lng: parseFloat(lng) || 91.7362,
      description: description || '',
      reporter_name: reporter_name || 'Field Reporter',
      reporter_role: reporter_role || 'Citizen / Field Official',
      photo_url: photo_url || '/images/idrms_logo.jpg',
      status: 'REPORTED',
      submitted_at: new Date().toISOString()
    };

    const inserted = await insertRecordAsync('field_reports', newFieldReport);

    res.status(201).json({
      success: true,
      message: "Geo-tagged photo incident report submitted successfully.",
      report: inserted
    });
  } catch (err) {
    console.error("Field report error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
