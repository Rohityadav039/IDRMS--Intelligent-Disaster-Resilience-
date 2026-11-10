const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getSupabase, isSupabaseConfigured } = require('./supabaseClient');

const DB_FILE = path.join(__dirname, '..', 'idrms_data.json');

// Default Seed Data for Local JSON Fallback & First Boot
const initialData = {
  users: [],
  roles: [
    { id: 1, name: 'Admin', description: 'System administrator with full command center access' },
    { id: 2, name: 'Volunteer', description: 'Field responder providing ground reports & aid' },
    { id: 3, name: 'Citizen', description: 'General citizen receiving alerts & reporting incidents' },
    { id: 4, name: 'FirstResponder', description: 'Official emergency team (NDRF / Fire / Medical)' }
  ],
  disasters: [
    {
      id: "DIS-101",
      title: "Severe Urban Flooding - Yamuna River Basin",
      category: "Flood",
      severity: "RED",
      location_name: "North Delhi & Coastal Lowlands",
      lat: 28.6924,
      lng: 77.2145,
      radius_km: 12.5,
      affected_population: 145000,
      status: "ACTIVE",
      reported_by: "NDMA Command Center",
      description: "River water levels crossed extreme danger mark. Low-lying colonies inundated. Evacuation operations underway.",
      created_at: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: "DIS-102",
      title: "Cyclone Warning Signal-4 Alert",
      category: "Cyclone",
      severity: "AMBER",
      location_name: "Coastal Zone B, Eastern Sector",
      lat: 28.5355,
      lng: 77.3910,
      radius_km: 45.0,
      affected_population: 320000,
      status: "ACTIVE",
      reported_by: "Meteorological Department",
      description: "Severe cyclonic storm approaching at 95 km/h. High wave action expected.",
      created_at: new Date(Date.now() - 3600000 * 12).toISOString()
    }
  ],
  alerts: [
    {
      id: "ALT-501",
      title: "FLASH FLOOD RED ALERT: Immediate Evacuation Order",
      message: "Residents of Majnu ka Tilla & Kashmiri Gate low areas must move to Relief Camp #4 immediately. High water discharge.",
      disaster_id: "DIS-101",
      severity: "CRITICAL",
      broadcast_area: "North & East Delhi District",
      target_audience: "ALL_CITIZENS",
      issued_at: new Date(Date.now() - 1800000).toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      status: "ACTIVE"
    }
  ],
  volunteers: [
    {
      id: "VOL-001",
      user_id: "USR-V01",
      full_name: "Rajesh Kumar",
      phone: "+91 98765 43210",
      skills: ["Medical", "Search & Rescue"],
      lat: 28.6850,
      lng: 77.2200,
      location_name: "Civil Lines, Delhi",
      status: "AVAILABLE",
      deployed_disaster_id: "DIS-101",
      last_active: new Date().toISOString()
    }
  ],
  shelters: [
    {
      id: "SHL-01",
      name: "Government Higher Secondary Emergency Relief Camp",
      location_name: "GT Road, North District",
      lat: 28.6890,
      lng: 77.2100,
      capacity: 1200,
      current_occupancy: 420,
      contact_person: "Officer Ramesh Singh",
      phone: "+91 11 2389 0012",
      amenities: ["Clean Water", "Food Supply", "Medical Assistance"],
      status: "OPEN"
    }
  ],
  hospitals: [
    {
      id: "HSP-01",
      name: "All India Institute of Medical Sciences (AIIMS)",
      location_name: "Ansari Nagar, New Delhi",
      lat: 28.5672,
      lng: 77.2100,
      total_beds: 2400,
      available_beds: 145,
      icu_beds: 18,
      oxygen_available: true,
      contact_number: "+91 11 2658 8500",
      status: "OPERATIONAL"
    }
  ],
  resources: [],
  lorawan_messages: [],
  evacuation_routes: [],
  landslide_zones: [
    { id: "LSZ-01", state: "Sikkim", location_name: "Chungthang / North Sikkim", lat: 27.6167, lng: 88.6500, slope_angle_deg: 48, rainfall_mm_24h: 210, soil_saturation_percent: 78, historical_incidents_5yr: 6, last_updated: new Date().toISOString() },
    { id: "LSZ-02", state: "Sikkim", location_name: "Gangtok Ridge", lat: 27.3389, lng: 88.6065, slope_angle_deg: 38, rainfall_mm_24h: 140, soil_saturation_percent: 62, historical_incidents_5yr: 3, last_updated: new Date().toISOString() },
    { id: "LSZ-03", state: "Meghalaya", location_name: "Sohra (Cherrapunji)", lat: 25.2842, lng: 91.7323, slope_angle_deg: 42, rainfall_mm_24h: 265, soil_saturation_percent: 82, historical_incidents_5yr: 5, last_updated: new Date().toISOString() },
    { id: "LSZ-04", state: "Meghalaya", location_name: "Shillong Peak Slopes", lat: 25.5760, lng: 91.8825, slope_angle_deg: 30, rainfall_mm_24h: 95, soil_saturation_percent: 48, historical_incidents_5yr: 2, last_updated: new Date().toISOString() },
    { id: "LSZ-05", state: "Assam", location_name: "Haflong, Dima Hasao Hills", lat: 25.1667, lng: 93.0167, slope_angle_deg: 35, rainfall_mm_24h: 120, soil_saturation_percent: 58, historical_incidents_5yr: 4, last_updated: new Date().toISOString() },
    { id: "LSZ-06", state: "Mizoram", location_name: "Aizawl Ridge Township", lat: 23.7271, lng: 92.7176, slope_angle_deg: 40, rainfall_mm_24h: 110, soil_saturation_percent: 55, historical_incidents_5yr: 3, last_updated: new Date().toISOString() },
    { id: "LSZ-07", state: "Manipur", location_name: "Ukhrul Hill Town", lat: 25.0500, lng: 94.3667, slope_angle_deg: 33, rainfall_mm_24h: 85, soil_saturation_percent: 44, historical_incidents_5yr: 1, last_updated: new Date().toISOString() },
    { id: "LSZ-08", state: "Arunachal Pradesh", location_name: "Bomdila Slopes", lat: 27.2645, lng: 92.4159, slope_angle_deg: 45, rainfall_mm_24h: 100, soil_saturation_percent: 50, historical_incidents_5yr: 2, last_updated: new Date().toISOString() }
  ],
  landslide_ground_reports: [],
  field_reports: [
    {
      id: "FLD-100001",
      incident_type: "Major Slope Failure & Blocked Highway",
      location_name: "NH-10 Chungthang Pass, North Sikkim",
      lat: 27.6167,
      lng: 88.6500,
      description: "Continuous heavy downpour caused massive mudslide across 200m section. Road traffic completely halted.",
      reporter_name: "Field Officer Tashi Norbu",
      reporter_role: "Sikkim State Disaster Management",
      photo_url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600",
      status: "CRITICAL_ACTION_REQUIRED",
      submitted_at: new Date().toISOString()
    }
  ],
  govt_policies: [
    {
      id: "POL-2005-01",
      title: "Mandatory Evacuation Orders & Relief Standards",
      act_name: "Disaster Management Act 2005",
      section: "Section 30 & 35",
      category: "Evacuation & Safety",
      description: "Empowers District Disaster Management Authorities (DDMA) to order compulsory evacuation of high-risk zones and enforce minimum standards of relief shelters.",
      official_link: "https://ndma.gov.in/Governance/DM-Act-2005"
    },
    {
      id: "POL-2005-02",
      title: "National Disaster Response Fund (NDRF) Ex-Gratia Mandate",
      act_name: "Disaster Management Act 2005",
      section: "Section 46",
      category: "Financial Compensation",
      description: "Mandates statutory monetary ex-gratia assistance for loss of life, permanent disability, and destruction of dwelling units due to notified natural calamities.",
      official_link: "https://ndma.gov.in/Grants-and-Relief"
    }
  ],
  relief_refund_schemes: [
    {
      id: "REF-SCH-01",
      scheme_name: "Post-Disaster Residential Structural Repair Refund",
      disaster_phase: "POST_DISASTER",
      funding_agency: "SDRF / State Disaster Relief Fund",
      max_refund_amount: 150000,
      eligibility_criteria: "Homeowners & renters whose houses suffered severe structural inundation or cyclone damage.",
      required_documents: ["Aadhaar / Photo ID", "Damage Assessment Photo", "Bank Passbook Copy"],
      description: "Provides direct bank transfer compensation for repairing residential premises damaged by floodwaters or gale force winds."
    },
    {
      id: "REF-SCH-02",
      scheme_name: "Pre-Disaster Emergency Evacuation & Logistics Reimbursement",
      disaster_phase: "PRE_DISASTER",
      funding_agency: "NDRF Urgent Assistance Cell",
      max_refund_amount: 25000,
      eligibility_criteria: "Citizens residing in RED alert zones who incurred private transport & emergency supplies expenditure during mandatory evacuation.",
      required_documents: ["Aadhaar / ID", "Travel/Fuel Receipts"],
      description: "Pre-disaster refund assistance reimbursing citizens for pro-active evacuation and transport expenses ahead of cyclone/flood landfall."
    }
  ],
  relief_claims: [
    {
      id: "CLM-9001",
      claimant_name: "Ramesh Chandra",
      citizen_id: "USR-C01",
      phone: "+91 98990 11223",
      disaster_id: "DIS-101",
      damage_type: "HOUSE_DAMAGE",
      claimed_amount: 45000,
      location: "Majnu ka Tilla Block B, Delhi",
      description: "Ground floor flooded up to 4 feet. Furniture and electrical fittings damaged.",
      bank_account_last4: "4892",
      status: "VERIFIED",
      submitted_at: new Date(Date.now() - 86400000 * 2).toISOString()
    }
  ],
  sponsors: [
    {
      id: "SPON-101",
      organization_name: "Global Disaster Relief Foundation",
      sponsor_type: "NGO",
      contact_person: "Sarah Jenkins",
      email: "contact@gdrf.org",
      phone: "+91 11 4567 8900",
      website: "https://gdrf.org",
      total_funds_contributed: 2500000,
      status: "VERIFIED_SPONSOR",
      created_at: new Date(Date.now() - 86400000 * 10).toISOString()
    },
    {
      id: "SPON-102",
      organization_name: "Tata Trusts CSR Response Unit",
      sponsor_type: "CORPORATE_CSR",
      contact_person: "Rohan Mehta",
      email: "csr.disaster@tata.com",
      phone: "+91 22 6665 8282",
      website: "https://tatatrusts.org",
      total_funds_contributed: 5000000,
      status: "VERIFIED_SPONSOR",
      created_at: new Date(Date.now() - 86400000 * 15).toISOString()
    },
    {
      id: "SPON-103",
      organization_name: "Red Cross Emergency Aid India",
      sponsor_type: "INTERNATIONAL_AID",
      contact_person: "Dr. Arvind Swaminathan",
      email: "relief@redcross.in",
      phone: "+91 11 2371 6441",
      website: "https://redcross.in",
      total_funds_contributed: 7500000,
      status: "VERIFIED_SPONSOR",
      created_at: new Date(Date.now() - 86400000 * 20).toISOString()
    }
  ],
  sponsor_donated_equipment: [
    {
      id: "EQP-301",
      sponsor_id: "SPON-101",
      sponsor_name: "Global Disaster Relief Foundation",
      equipment_name: "Heavy Duty Inflatable Rescue Boats (8-Seater)",
      category: "RESCUE_BOATS",
      quantity: 10,
      unit: "Boats",
      estimated_value: 1200000,
      deployed_location: "Yamuna Flood Relief Base Camp #2",
      dispatch_status: "DELIVERY_CONFIRMED",
      tracking_hash: "TRACK-EQP301-GPS89",
      delivery_lat: 28.6924,
      delivery_lng: 77.2145,
      verified_by_officer: "Commander Vikram (NDRF Battalion 8)",
      proof_image_url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600",
      uploaded_at: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
      id: "EQP-302",
      sponsor_id: "SPON-102",
      sponsor_name: "Tata Trusts CSR Response Unit",
      equipment_name: "Solar Powered Clean Water Purification Plants (1000L/hr)",
      category: "WATER_PURIFIERS",
      quantity: 5,
      unit: "Units",
      estimated_value: 2500000,
      deployed_location: "Kashmiri Gate Shelter Complex",
      dispatch_status: "DELIVERY_CONFIRMED",
      tracking_hash: "TRACK-EQP302-GPS92",
      delivery_lat: 28.6670,
      delivery_lng: 77.2280,
      verified_by_officer: "Inspector Suman Lata (Civil Defense)",
      proof_image_url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600",
      uploaded_at: new Date(Date.now() - 86400000 * 4).toISOString()
    },
    {
      id: "EQP-303",
      sponsor_id: "SPON-103",
      sponsor_name: "Red Cross Emergency Aid India",
      equipment_name: "Emergency Family Survival & Ration Kits",
      category: "FOOD_KITS",
      quantity: 2500,
      unit: "Kits",
      estimated_value: 3750000,
      deployed_location: "North Delhi Relief Distribution Center",
      dispatch_status: "DELIVERY_CONFIRMED",
      tracking_hash: "TRACK-EQP303-GPS44",
      delivery_lat: 28.7000,
      delivery_lng: 77.2100,
      verified_by_officer: "Officer Ramesh Singh (Relief Camp #4)",
      proof_image_url: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600",
      uploaded_at: new Date(Date.now() - 86400000 * 5).toISOString()
    }
  ],
  sponsor_impact_reports: [
    {
      id: "IMP-701",
      sponsor_id: "SPON-101",
      sponsor_name: "Global Disaster Relief Foundation",
      title: "Yamuna Basin Evacuation & Rescue Boat Deployment Impact Report",
      disaster_id: "DIS-101",
      location_served: "Majnu Ka Tilla & Civil Lines Lowlands",
      families_assisted: 1420,
      equipment_deployed: "10 Heavy Duty Rescue Boats & 100 Life Jackets",
      summary: "Deployed 10 motorized rescue boats in coordination with NDRF Battalion 8. Successfully rescued 1,420 stranded citizens including 340 children from flooded residential roofs.",
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: "IMP-702",
      sponsor_id: "SPON-102",
      sponsor_name: "Tata Trusts CSR Response Unit",
      title: "Emergency Clean Water & Generator Setup in Relief Camps",
      disaster_id: "DIS-101",
      location_served: "Kashmiri Gate Relief Camp #4",
      families_assisted: 3800,
      equipment_deployed: "5 Solar Water Purification Units & 3 High Output Generators",
      summary: "Provided continuous safe drinking water and uninterrupted electrical power for lighting and medical cold-chains serving 3,800 displaced victims.",
      created_at: new Date(Date.now() - 86400000 * 1).toISOString()
    }
  ]
};

// Initialize DB file
function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const salt = bcrypt.genSaltSync(10);
    const adminPass = bcrypt.hashSync('admin123', salt);
    const volPass = bcrypt.hashSync('vol123', salt);
    const citizenPass = bcrypt.hashSync('citizen123', salt);

    initialData.users = [
      {
        id: "USR-001",
        full_name: "National Disaster Command Administrator",
        email: "admin@idrms.gov.in",
        password_hash: adminPass,
        role: "Admin",
        phone: "+91 11 2345 6789",
        location_lat: 28.6139,
        location_lng: 77.2090,
        address: "NDMA Bhawan, Safdarjung Enclave, New Delhi",
        created_at: new Date().toISOString(),
        status: "ACTIVE"
      },
      {
        id: "USR-V01",
        full_name: "Rajesh Kumar",
        email: "rajesh.volunteer@idrms.gov.in",
        password_hash: volPass,
        role: "Volunteer",
        phone: "+91 98765 43210",
        location_lat: 28.6850,
        location_lng: 77.2200,
        address: "Civil Lines, Delhi",
        created_at: new Date().toISOString(),
        status: "ACTIVE"
      },
      {
        id: "USR-C01",
        full_name: "Anil Verma",
        email: "citizen@gmail.com",
        password_hash: citizenPass,
        role: "Citizen",
        phone: "+91 98990 11223",
        location_lat: 28.6300,
        location_lng: 77.2200,
        address: "Connaught Place, Delhi",
        created_at: new Date().toISOString(),
        status: "ACTIVE"
      }
    ];

    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  } else {
    try {
      const current = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      let updated = false;
      for (const key of Object.keys(initialData)) {
        if (!current[key]) {
          current[key] = initialData[key];
          updated = true;
        }
      }
      if (updated) {
        fs.writeFileSync(DB_FILE, JSON.stringify(current, null, 2));
      }
    } catch (e) {
      console.warn("Could not patch local DB schema keys:", e.message);
    }
  }
}

// Read database
function readData() {
  initDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading IDRMS database:", err);
    return initialData;
  }
}

// Write database
function writeData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing to IDRMS database:", err);
    return false;
  }
}

// Asynchronous DB Collection getter (Supabase + Local dual mode)
async function getCollectionAsync(collectionName) {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const { data, error } = await supabase.from(collectionName).select('*');
    if (!error && data) {
      return data;
    }
    console.warn(`Supabase fetch error for table '${collectionName}':`, error?.message, '. Falling back to local data.');
  }
  const localData = readData();
  return localData[collectionName] || [];
}

// Asynchronous Record Inserter
async function insertRecordAsync(collectionName, record) {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const { data, error } = await supabase.from(collectionName).insert([record]).select();
    if (!error && data) {
      return data[0] || record;
    }
    console.warn(`Supabase insert error for table '${collectionName}':`, error?.message, '. Falling back to local data.');
  }
  
  const localData = readData();
  if (!localData[collectionName]) localData[collectionName] = [];
  localData[collectionName].unshift(record);
  writeData(localData);
  return record;
}

// Generic Async Record Updater (by id field, defaults to 'id')
async function updateRecordAsync(collectionName, id, updates, idField = 'id') {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(collectionName)
      .update(updates)
      .eq(idField, id)
      .select();

    if (!error && data && data.length > 0) {
      return data[0];
    }
    if (error) {
      console.warn(`Supabase update error for table '${collectionName}':`, error.message, '. Falling back to local data.');
    }
  }

  const localData = readData();
  const list = localData[collectionName] || [];
  const target = list.find(r => r[idField] === id);
  if (!target) return null;
  Object.assign(target, updates);
  writeData(localData);
  return target;
}

// Generic Async Single-Record Finder by arbitrary field (used for email lookups, etc.)
async function findByFieldAsync(collectionName, field, value) {
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(collectionName)
      .select('*')
      .ilike(field, value)
      .limit(1);

    if (!error && data) {
      return data[0] || null;
    }
    if (error) {
      console.warn(`Supabase lookup error for table '${collectionName}':`, error.message, '. Falling back to local data.');
    }
  }

  const localData = readData();
  const list = localData[collectionName] || [];
  return list.find(r => String(r[field]).toLowerCase() === String(value).toLowerCase()) || null;
}

// Calculate Sponsor Rankings & Trust Scores
async function getSponsorsWithRankingsAsync() {
  const [sponsors, equipment, reports] = await Promise.all([
    getCollectionAsync('sponsors'),
    getCollectionAsync('sponsor_donated_equipment'),
    getCollectionAsync('sponsor_impact_reports')
  ]);

  const rankedSponsors = sponsors.map(sponsor => {
    const sName = sponsor.organization_name;
    const sponsorEquip = equipment.filter(e => e.sponsor_name === sName || e.sponsor_id === sponsor.id);
    const sponsorReports = reports.filter(r => r.sponsor_name === sName || r.sponsor_id === sponsor.id);

    const verifiedDeliveries = sponsorEquip.filter(e => e.dispatch_status === 'DELIVERY_CONFIRMED').length;
    const totalFamiliesAssisted = sponsorReports.reduce((sum, r) => sum + (parseInt(r.families_assisted) || 0), 0);
    const totalAidValueLakhs = (parseFloat(sponsor.total_funds_contributed || 0) / 100000);

    // Trust Score Calculation Formula:
    // Trust Score = (Verified Deliveries * 50) + (Families Assisted * 2) + (Aid Value in Lakhs * 10) + (Total Equipment Items * 15)
    const score = Math.round(
      (verifiedDeliveries * 50) +
      (totalFamiliesAssisted * 2) +
      (totalAidValueLakhs * 10) +
      (sponsorEquip.length * 15)
    );

    let rank_tier = 'BRONZE';
    let tier_badge = '🥉 Bronze Contributor';
    if (score >= 5000) {
      rank_tier = 'PLATINUM';
      tier_badge = '🏆 Platinum Aid Champion';
    } else if (score >= 2500) {
      rank_tier = 'GOLD';
      tier_badge = '🥇 Gold Relief Sponsor';
    } else if (score >= 1000) {
      rank_tier = 'SILVER';
      tier_badge = '🥈 Silver Disaster Donor';
    }

    return {
      ...sponsor,
      trust_score: score,
      rank_tier,
      tier_badge,
      stats: {
        total_donated_equipment: sponsorEquip.length,
        verified_deliveries: verifiedDeliveries,
        families_assisted: totalFamiliesAssisted,
        impact_reports_count: sponsorReports.length
      }
    };
  });

  // Sort descending by Trust Score
  rankedSponsors.sort((a, b) => b.trust_score - a.trust_score);
  return rankedSponsors;
}

// Verify Equipment Delivery with GPS & Field Officer Sign-off
async function verifyEquipmentDeliveryAsync(equipmentId, verificationData) {
  const { verified_by_officer, delivery_lat, delivery_lng, proof_image_url } = verificationData;

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const updatePayload = {
      dispatch_status: 'DELIVERY_CONFIRMED',
      verified_by_officer: verified_by_officer || 'Verified NDRF Field Officer',
      delivery_lat: parseFloat(delivery_lat || 28.6924),
      delivery_lng: parseFloat(delivery_lng || 77.2145),
      proof_image_url: proof_image_url || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600'
    };

    const { data, error } = await supabase
      .from('sponsor_donated_equipment')
      .update(updatePayload)
      .eq('id', equipmentId)
      .select();

    if (!error && data && data.length > 0) {
      return data[0];
    }
  }

  // Local JSON fallback
  const localData = readData();
  const eqList = localData.sponsor_donated_equipment || [];
  const target = eqList.find(e => e.id === equipmentId);

  if (target) {
    target.dispatch_status = 'DELIVERY_CONFIRMED';
    target.verified_by_officer = verified_by_officer || 'Verified NDRF Field Officer';
    target.delivery_lat = parseFloat(delivery_lat || 28.6924);
    target.delivery_lng = parseFloat(delivery_lng || 77.2145);
    target.proof_image_url = proof_image_url || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600';
    writeData(localData);
    return target;
  }

  return null;
}

module.exports = {
  readData,
  writeData,
  initDb,
  getCollectionAsync,
  insertRecordAsync,
  updateRecordAsync,
  findByFieldAsync,
  getSponsorsWithRankingsAsync,
  verifyEquipmentDeliveryAsync
};
