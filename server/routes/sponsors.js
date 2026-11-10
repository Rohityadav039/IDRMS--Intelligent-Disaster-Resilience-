const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const { getCollectionAsync, insertRecordAsync, getSponsorsWithRankingsAsync, verifyEquipmentDeliveryAsync } = require('../db');
const { uploadMedia } = require('../lib/mediaStorage');

// Sponsor equipment & delivery-proof photos are uploaded into memory, then
// pushed to Supabase Storage (bucket: SUPABASE_MEDIA_BUCKET, default
// 'idrms-media') by uploadMedia(). If Supabase isn't configured, uploadMedia
// transparently falls back to writing into public/uploads/equipment/.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

function buildUniqueFilename(prefix, originalname) {
  const ext = path.extname(originalname || '') || '.jpg';
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
}

// GET /api/sponsors - List all registered Sponsors & NGOs
router.get('/', async (req, res) => {
  try {
    const sponsors = await getCollectionAsync('sponsors');
    res.json({
      success: true,
      count: sponsors.length,
      sponsors
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sponsors/rankings - Get Sponsor Leaderboard sorted by Trust Score
router.get('/rankings', async (req, res) => {
  try {
    const rankedSponsors = await getSponsorsWithRankingsAsync();
    res.json({
      success: true,
      count: rankedSponsors.length,
      rankings: rankedSponsors
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sponsors - Register a new Sponsor / NGO
router.post('/', async (req, res) => {
  try {
    const { organization_name, sponsor_type, contact_person, email, phone, website, total_funds_contributed } = req.body;

    if (!organization_name || !contact_person || !email || !phone) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields (organization_name, contact_person, email, phone)"
      });
    }

    const newSponsor = {
      id: `SPON-${Math.floor(100 + Math.random() * 900)}`,
      organization_name,
      sponsor_type: sponsor_type || "NGO",
      contact_person,
      email,
      phone,
      website: website || "#",
      total_funds_contributed: parseFloat(total_funds_contributed || 0),
      status: "VERIFIED_SPONSOR",
      created_at: new Date().toISOString()
    };

    const inserted = await insertRecordAsync('sponsors', newSponsor);
    res.status(201).json({
      success: true,
      message: "Sponsor / NGO organization registered successfully.",
      sponsor: inserted
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sponsors/equipment - List donated equipment & aid supplies
router.get('/equipment', async (req, res) => {
  try {
    const equipment = await getCollectionAsync('sponsor_donated_equipment');
    res.json({
      success: true,
      count: equipment.length,
      equipment
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sponsors/equipment - Upload / log donated equipment & aid (with photo upload)
router.post('/equipment', upload.single('photo'), async (req, res) => {
  try {
    const { sponsor_id, sponsor_name, equipment_name, category, quantity, unit, estimated_value, deployed_location, proof_image_url: bodyUrl } = req.body;

    if (!sponsor_name || !equipment_name || !quantity || !deployed_location) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters (sponsor_name, equipment_name, quantity, deployed_location)"
      });
    }

    let proof_image_url = null;
    let media_storage = null;
    if (req.file) {
      const uploaded = await uploadMedia({
        buffer: req.file.buffer,
        folder: 'equipment',
        filename: buildUniqueFilename('equip', req.file.originalname),
        mimetype: req.file.mimetype
      });
      proof_image_url = uploaded.url;
      media_storage = uploaded.storage;
    } else if (bodyUrl) {
      proof_image_url = bodyUrl;
    }

    const newEquipment = {
      id: `EQP-${Math.floor(300 + Math.random() * 700)}`,
      sponsor_id: sponsor_id || "SPON-101",
      sponsor_name,
      equipment_name,
      category: category || "RESCUE_EQUIPMENT",
      quantity: parseInt(quantity),
      unit: unit || "Units",
      estimated_value: parseFloat(estimated_value || 0),
      deployed_location,
      dispatch_status: proof_image_url ? "DELIVERY_CONFIRMED" : "IN_TRANSIT",
      tracking_hash: `TRACK-EQP${Math.floor(100+Math.random()*900)}-GPS${Math.floor(10+Math.random()*90)}`,
      delivery_lat: null,
      delivery_lng: null,
      verified_by_officer: proof_image_url ? "Sponsor / Field Officer Verification" : null,
      proof_image_url: proof_image_url || null,
      media_storage: media_storage || (bodyUrl ? 'EXTERNAL_URL' : null),
      uploaded_at: new Date().toISOString()
    };

    const inserted = await insertRecordAsync('sponsor_donated_equipment', newEquipment);
    res.status(201).json({
      success: true,
      message: "Donated equipment logged and dispatched with tracking code.",
      equipment: inserted
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sponsors/equipment/:id/verify - Verify equipment delivery by Field Officer with proof photo upload
router.post('/equipment/:id/verify', upload.single('proof_photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { verified_by_officer, delivery_lat, delivery_lng, proof_image_url: bodyUrl } = req.body;

    if (!verified_by_officer) {
      return res.status(400).json({
        success: false,
        error: "Verification requires Field Officer name/badge details."
      });
    }

    let proof_image_url = bodyUrl || null;
    if (req.file) {
      const uploaded = await uploadMedia({
        buffer: req.file.buffer,
        folder: 'equipment',
        filename: buildUniqueFilename('equip_proof', req.file.originalname),
        mimetype: req.file.mimetype
      });
      proof_image_url = uploaded.url;
    }

    const updated = await verifyEquipmentDeliveryAsync(id, { verified_by_officer, delivery_lat, delivery_lng, proof_image_url });

    if (!updated) {
      return res.status(404).json({ success: false, error: "Equipment record not found." });
    }

    res.json({
      success: true,
      message: `Equipment delivery successfully verified and status updated to DELIVERY_CONFIRMED.`,
      equipment: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sponsors/impact-reports - List Sponsor Impact Reports
router.get('/impact-reports', async (req, res) => {
  try {
    const reports = await getCollectionAsync('sponsor_impact_reports');
    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sponsors/impact-reports - Submit a new Impact Report
router.post('/impact-reports', async (req, res) => {
  try {
    const { sponsor_id, sponsor_name, title, disaster_id, location_served, families_assisted, equipment_deployed, summary } = req.body;

    if (!sponsor_name || !title || !location_served || !summary) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields (sponsor_name, title, location_served, summary)"
      });
    }

    const newReport = {
      id: `IMP-${Math.floor(700 + Math.random() * 300)}`,
      sponsor_id: sponsor_id || "SPON-101",
      sponsor_name,
      title,
      disaster_id: disaster_id || "DIS-101",
      location_served,
      families_assisted: parseInt(families_assisted || 0),
      equipment_deployed: equipment_deployed || "Relief Supplies & Kits",
      summary,
      created_at: new Date().toISOString()
    };

    const inserted = await insertRecordAsync('sponsor_impact_reports', newReport);
    res.status(201).json({
      success: true,
      message: "Sponsor impact report published successfully.",
      report: inserted
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
