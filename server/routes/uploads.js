const express = require('express');
const router = express.Router();
const { getCollectionAsync } = require('../db');

// GET /api/uploads/gallery - Return all uploaded images with metadata for Admin Gallery
router.get('/gallery', async (req, res) => {
  try {
    const [equipment, reports, fieldReports] = await Promise.all([
      getCollectionAsync('sponsor_donated_equipment'),
      getCollectionAsync('landslide_ground_reports'),
      getCollectionAsync('field_reports')
    ]);

    const gallery = [];

    // Equipment Proof Photos
    equipment.forEach(item => {
      if (item.proof_image_url) {
        gallery.push({
          id: `GAL-EQP-${item.id}`,
          ref_id: item.id,
          category: 'Sponsor Equipment Delivery Proof',
          title: item.equipment_name,
          subtitle: `Sponsor: ${item.sponsor_name}`,
          location: item.deployed_location || 'Field Base',
          url: item.proof_image_url,
          uploaded_at: item.uploaded_at || new Date().toISOString(),
          verified_by: item.verified_by_officer || 'NDRF Field Officer',
          status: item.dispatch_status || 'DELIVERY_CONFIRMED'
        });
      }
    });

    // Landslide Ground Reports Photos
    reports.forEach(report => {
      if (report.photo_url) {
        gallery.push({
          id: `GAL-REP-${report.id}`,
          ref_id: report.id,
          category: 'Landslide Ground Observation',
          title: report.observation_type,
          subtitle: `Reported by: ${report.reported_by || 'Field Official'} (${report.reported_by_role || 'Volunteer'})`,
          location: report.zone_location || 'NER Monitored Zone',
          url: report.photo_url,
          uploaded_at: report.submitted_at || new Date().toISOString(),
          description: report.description,
          status: 'GROUND_VERIFIED'
        });
      }
    });

    // Field Reports Photos (cracks, road blockages, slope movement)
    fieldReports.forEach(field => {
      if (field.photo_url) {
        gallery.push({
          id: `GAL-FLD-${field.id}`,
          ref_id: field.id,
          category: 'Citizen & Field Hazard Photo',
          title: field.incident_type || 'Slope / Road Hazard',
          subtitle: `Reported by: ${field.reporter_name || 'Citizen'} (${field.reporter_role || 'Field Official'})`,
          location: field.location_name || `${field.lat}, ${field.lng}`,
          url: field.photo_url,
          uploaded_at: field.submitted_at || new Date().toISOString(),
          description: field.description,
          status: field.status || 'REPORTED'
        });
      }
    });

    // Sort newest first
    gallery.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));

    res.json({
      success: true,
      total_images: gallery.length,
      gallery
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
