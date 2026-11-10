const express = require('express');
const router = express.Router();
const { getCollectionAsync, insertRecordAsync } = require('../db');

// GET /api/policies - List Govt Policies & Disaster Management Act 2005 clauses
router.get('/', async (req, res) => {
  try {
    const policies = await getCollectionAsync('govt_policies');
    res.json({
      success: true,
      count: policies.length,
      policies
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/policies/refund-schemes - List Pre & Post Disaster Refund Assistance Schemes
router.get('/refund-schemes', async (req, res) => {
  try {
    const schemes = await getCollectionAsync('relief_refund_schemes');
    res.json({
      success: true,
      count: schemes.length,
      schemes
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/policies/claims - Retrieve disaster victim relief claims
router.get('/claims', async (req, res) => {
  try {
    const claims = await getCollectionAsync('relief_claims');
    res.json({
      success: true,
      count: claims.length,
      claims
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/policies/claims - File a new Pre or Post Disaster Relief Refund Claim
router.post('/claims', async (req, res) => {
  try {
    const { claimant_name, phone, disaster_id, damage_type, claimed_amount, location, description, bank_account_last4 } = req.body;

    if (!claimant_name || !phone || !damage_type || !claimed_amount) {
      return res.status(400).json({
        success: false,
        error: "Missing required claim parameters (claimant_name, phone, damage_type, claimed_amount)"
      });
    }

    const newClaim = {
      id: `CLM-${Math.floor(1000 + Math.random() * 9000)}`,
      claimant_name,
      citizen_id: req.body.citizen_id || "USR-C01",
      phone,
      disaster_id: disaster_id || "DIS-101",
      damage_type,
      claimed_amount: parseFloat(claimed_amount),
      location: location || "Disaster Affected Zone",
      description: description || "Relief claim for disaster damage assistance.",
      bank_account_last4: bank_account_last4 || "0000",
      status: "UNDER_REVIEW",
      submitted_at: new Date().toISOString()
    };

    const inserted = await insertRecordAsync('relief_claims', newClaim);
    res.status(201).json({
      success: true,
      message: "Disaster damage refund claim submitted successfully. Track your claim status below.",
      claim: inserted
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
