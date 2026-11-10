-- =========================================================================
-- IDRMS - INTELLIGENT DISASTER MANAGEMENT SYSTEM (SUPABASE POSTGRESQL SCHEMA)
-- Copy and paste this script into your Supabase SQL Editor to initialize all tables
-- =========================================================================

-- Enable UUID Extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id VARCHAR(50) PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'Citizen',
  phone TEXT,
  location_lat NUMERIC(10, 6),
  location_lng NUMERIC(10, 6),
  address TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ROLES TABLE
CREATE TABLE IF NOT EXISTS public.roles (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

-- 3. DISASTERS TABLE
CREATE TABLE IF NOT EXISTS public.disasters (
  id VARCHAR(50) PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT DEFAULT 'AMBER',
  location_name TEXT NOT NULL,
  lat NUMERIC(10, 6),
  lng NUMERIC(10, 6),
  radius_km NUMERIC(5, 2),
  affected_population INT DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE',
  reported_by TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ALERTS TABLE
CREATE TABLE IF NOT EXISTS public.alerts (
  id VARCHAR(50) PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  disaster_id VARCHAR(50) REFERENCES public.disasters(id) ON DELETE SET NULL,
  severity TEXT DEFAULT 'WARNING',
  broadcast_area TEXT,
  target_audience TEXT DEFAULT 'ALL_CITIZENS',
  status TEXT DEFAULT 'ACTIVE',
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- 5. VOLUNTEERS TABLE
CREATE TABLE IF NOT EXISTS public.volunteers (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  skills TEXT[],
  lat NUMERIC(10, 6),
  lng NUMERIC(10, 6),
  location_name TEXT,
  status TEXT DEFAULT 'AVAILABLE',
  deployed_disaster_id VARCHAR(50) REFERENCES public.disasters(id) ON DELETE SET NULL,
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SHELTERS TABLE
CREATE TABLE IF NOT EXISTS public.shelters (
  id VARCHAR(50) PRIMARY KEY,
  name TEXT NOT NULL,
  location_name TEXT NOT NULL,
  lat NUMERIC(10, 6),
  lng NUMERIC(10, 6),
  capacity INT DEFAULT 100,
  current_occupancy INT DEFAULT 0,
  contact_person TEXT,
  phone TEXT,
  amenities TEXT[],
  status TEXT DEFAULT 'OPEN'
);

-- 7. HOSPITALS TABLE
CREATE TABLE IF NOT EXISTS public.hospitals (
  id VARCHAR(50) PRIMARY KEY,
  name TEXT NOT NULL,
  location_name TEXT NOT NULL,
  lat NUMERIC(10, 6),
  lng NUMERIC(10, 6),
  total_beds INT DEFAULT 100,
  available_beds INT DEFAULT 10,
  icu_beds INT DEFAULT 2,
  oxygen_available BOOLEAN DEFAULT TRUE,
  contact_number TEXT,
  status TEXT DEFAULT 'OPERATIONAL'
);

-- 8. RESOURCES TABLE
CREATE TABLE IF NOT EXISTS public.resources (
  id VARCHAR(50) PRIMARY KEY,
  resource_name TEXT NOT NULL,
  category TEXT NOT NULL,
  total_quantity INT DEFAULT 0,
  available_quantity INT DEFAULT 0,
  unit TEXT DEFAULT 'Units',
  location_name TEXT,
  managed_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. LORAWAN MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.lorawan_messages (
  id VARCHAR(50) PRIMARY KEY,
  node_id TEXT NOT NULL,
  gateway_id TEXT NOT NULL,
  dev_eui TEXT,
  rssi_dbm INT,
  snr_db NUMERIC(5,2),
  packet_type TEXT,
  payload_raw TEXT,
  decoded_message TEXT NOT NULL,
  sender_name TEXT,
  lat NUMERIC(10, 6),
  lng NUMERIC(10, 6),
  network_status TEXT DEFAULT 'NETWORK_OFFLINE_MESH',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 10. EVACUATION ROUTES TABLE
CREATE TABLE IF NOT EXISTS public.evacuation_routes (
  id VARCHAR(50) PRIMARY KEY,
  name TEXT NOT NULL,
  source_location TEXT NOT NULL,
  safe_zone_location TEXT NOT NULL,
  hazard_status TEXT,
  distance_km NUMERIC(5, 2)
);

-- 11. GOVERNMENT POLICIES (DISASTER MANAGEMENT ACT 2005)
CREATE TABLE IF NOT EXISTS public.govt_policies (
  id VARCHAR(50) PRIMARY KEY,
  title TEXT NOT NULL,
  act_name TEXT NOT NULL,
  section TEXT,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  official_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. RELIEF & DAMAGE REFUND SCHEMES (PRE & POST DISASTER)
CREATE TABLE IF NOT EXISTS public.relief_refund_schemes (
  id VARCHAR(50) PRIMARY KEY,
  scheme_name TEXT NOT NULL,
  disaster_phase TEXT NOT NULL, -- 'PRE_DISASTER' or 'POST_DISASTER'
  funding_agency TEXT NOT NULL,
  max_refund_amount NUMERIC(12, 2) NOT NULL,
  eligibility_criteria TEXT NOT NULL,
  required_documents TEXT[],
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. RELIEF DAMAGE CLAIMS (CITIZEN REFUND APPLICATIONS)
CREATE TABLE IF NOT EXISTS public.relief_claims (
  id VARCHAR(50) PRIMARY KEY,
  claimant_name TEXT NOT NULL,
  citizen_id VARCHAR(50) REFERENCES public.users(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  disaster_id VARCHAR(50) REFERENCES public.disasters(id) ON DELETE SET NULL,
  damage_type TEXT NOT NULL, -- 'HOUSE_DAMAGE', 'CROP_LOSS', 'MEDICAL_INJURY', 'BUSINESS_LOSS', 'PRE_EVACUATION_COST'
  claimed_amount NUMERIC(12, 2) NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  bank_account_last4 TEXT,
  status TEXT DEFAULT 'UNDER_REVIEW', -- 'UNDER_REVIEW', 'VERIFIED', 'REFUND_DISBURSED', 'REJECTED'
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. SPONSORS & NGO DIRECTORY
CREATE TABLE IF NOT EXISTS public.sponsors (
  id VARCHAR(50) PRIMARY KEY,
  organization_name TEXT NOT NULL,
  sponsor_type TEXT NOT NULL, -- 'NGO', 'CORPORATE_CSR', 'INTERNATIONAL_AID', 'INDIVIDUAL_PHILANTHROPIST'
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  website TEXT,
  total_funds_contributed NUMERIC(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'VERIFIED_SPONSOR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. SPONSOR DONATED EQUIPMENT & SUPPLIES
CREATE TABLE IF NOT EXISTS public.sponsor_donated_equipment (
  id VARCHAR(50) PRIMARY KEY,
  sponsor_id VARCHAR(50) REFERENCES public.sponsors(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'RESCUE_BOATS', 'WATER_PURIFIERS', 'POWER_GENERATORS', 'FOOD_KITS', 'RELIEF_TENTS', 'MEDICAL_SUPPLIES'
  quantity INT NOT NULL,
  unit TEXT DEFAULT 'Units',
  estimated_value NUMERIC(12, 2),
  deployed_location TEXT NOT NULL,
  dispatch_status TEXT DEFAULT 'DISPATCHED_TO_FIELD',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. SPONSOR IMPACT REPORTS (HOW THEY HELPED DISASTER VICTIMS)
CREATE TABLE IF NOT EXISTS public.sponsor_impact_reports (
  id VARCHAR(50) PRIMARY KEY,
  sponsor_id VARCHAR(50) REFERENCES public.sponsors(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  title TEXT NOT NULL,
  disaster_id VARCHAR(50) REFERENCES public.disasters(id) ON DELETE SET NULL,
  location_served TEXT NOT NULL,
  families_assisted INT DEFAULT 0,
  equipment_deployed TEXT NOT NULL,
  summary TEXT NOT NULL,
  report_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================================================
-- INITIAL SEED DATA FOR ALL IDRMS MODULES
-- =========================================================================

-- Roles Seed
INSERT INTO public.roles (id, name, description) VALUES
(1, 'Admin', 'System administrator with full command center access'),
(2, 'Volunteer', 'Field responder providing ground reports & aid'),
(3, 'Citizen', 'General citizen receiving alerts & reporting incidents'),
(4, 'FirstResponder', 'Official emergency team (NDRF / Fire / Medical)')
ON CONFLICT (id) DO NOTHING;

-- Admin & Volunteer Users Seed
INSERT INTO public.users (id, full_name, email, password_hash, role, phone, location_lat, location_lng, address) VALUES
('USR-001', 'National Disaster Command Administrator', 'admin@idrms.gov.in', '$2a$10$eEwKx7yD4HnLw69Kx7yD4e6Kx7yD4HnLw69Kx7yD4HnLw69Kx7yD4', 'Admin', '+91 11 2345 6789', 28.6139, 77.2090, 'NDMA Bhawan, Safdarjung Enclave, New Delhi'),
('USR-V01', 'Rajesh Kumar', 'rajesh.volunteer@idrms.gov.in', '$2a$10$eEwKx7yD4HnLw69Kx7yD4e6Kx7yD4HnLw69Kx7yD4HnLw69Kx7yD4', 'Volunteer', '+91 98765 43210', 28.6850, 77.2200, 'Civil Lines, Delhi'),
('USR-C01', 'Anil Verma', 'citizen@gmail.com', '$2a$10$eEwKx7yD4HnLw69Kx7yD4e6Kx7yD4HnLw69Kx7yD4HnLw69Kx7yD4', 'Citizen', '+91 98990 11223', 28.6300, 77.2200, 'Connaught Place, Delhi')
ON CONFLICT (id) DO NOTHING;

-- Disasters Seed
INSERT INTO public.disasters (id, title, category, severity, location_name, lat, lng, radius_km, affected_population, status, reported_by, description) VALUES
('DIS-101', 'Severe Urban Flooding - Yamuna River Basin', 'Flood', 'RED', 'North Delhi & Coastal Lowlands', 28.6924, 77.2145, 12.50, 145000, 'ACTIVE', 'NDMA Command Center', 'River water levels crossed extreme danger mark. Low-lying colonies inundated. Evacuation operations underway.'),
('DIS-102', 'Cyclone Warning Signal-4 Alert', 'Cyclone', 'AMBER', 'Coastal Zone B, Eastern Sector', 28.5355, 77.3910, 45.00, 320000, 'ACTIVE', 'Meteorological Department', 'Severe cyclonic storm approaching at 95 km/h. High wave action expected.')
ON CONFLICT (id) DO NOTHING;

-- Alerts Seed
INSERT INTO public.alerts (id, title, message, disaster_id, severity, broadcast_area, target_audience, status) VALUES
('ALT-501', 'FLASH FLOOD RED ALERT: Immediate Evacuation Order', 'Residents of Majnu ka Tilla & Kashmiri Gate low areas must move to Relief Camp #4 immediately. High water discharge.', 'DIS-101', 'CRITICAL', 'North & East Delhi District', 'ALL_CITIZENS', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Government Policies (DM Act 2005) Seed
INSERT INTO public.govt_policies (id, title, act_name, section, category, description, official_link) VALUES
('POL-2005-01', 'Mandatory Evacuation Orders & Relief Standards', 'Disaster Management Act 2005', 'Section 30 & 35', 'Evacuation & Safety', 'Empowers District Disaster Management Authorities (DDMA) to order compulsory evacuation of high-risk zones and enforce minimum standards of relief shelters (food, water, sanitation, and medical care).', 'https://ndma.gov.in/Governance/DM-Act-2005'),
('POL-2005-02', 'National Disaster Response Fund (NDRF) Ex-Gratia Mandate', 'Disaster Management Act 2005', 'Section 46', 'Financial Compensation', 'Mandates statutory monetary ex-gratia assistance for loss of life, permanent disability, and destruction of dwelling units due to notified natural calamities.', 'https://ndma.gov.in/Grants-and-Relief'),
('POL-2005-03', 'Critical Infrastructure & Emergency Essential Services Protection', 'Disaster Management Act 2005', 'Section 51-60', 'Offences & Compliance', 'Establishes legal penalties for obstruction of emergency response personnel, refusal to comply with DDMA directions, or hoarding of essential relief emergency commodities.', 'https://ndma.gov.in/Legal-Framework')
ON CONFLICT (id) DO NOTHING;

-- Pre & Post Relief Refund Schemes Seed
INSERT INTO public.relief_refund_schemes (id, scheme_name, disaster_phase, funding_agency, max_refund_amount, eligibility_criteria, required_documents, description) VALUES
('REF-SCH-01', 'Post-Disaster Residential Structural Repair Refund', 'POST_DISASTER', 'SDRF / State Disaster Relief Fund', 150000.00, 'Homeowners & renters whose houses suffered severe structural inundation or cyclone damage.', ARRAY['Aadhaar / Photo ID', 'Damage Assessment Photo', 'Bank Passbook Copy'], 'Provides direct bank transfer compensation for repairing residential premises damaged by floodwaters or gale force winds.'),
('REF-SCH-02', 'Pre-Disaster Emergency Evacuation & Logistics Reimbursement', 'PRE_DISASTER', 'NDRF Urgent Assistance Cell', 25000.00, 'Citizens residing in RED alert zones who incurred private transport & emergency supplies expenditure during mandatory evacuation.', ARRAY['Aadhaar / ID', 'Travel/Fuel Receipts', 'Local Sarpanch/Ward Certificate'], 'Pre-disaster refund assistance reimbursing citizens for pro-active evacuation and transport expenses ahead of cyclone/flood landfall.'),
('REF-SCH-03', 'PM Kisan Emergency Flood Crop Loss Compensation', 'POST_DISASTER', 'Ministry of Agriculture', 85000.00, 'Registered farmers with crop loss exceeding 33% due to waterlogging or unseasonal flood inundation.', ARRAY['Khasra / Land Papers', 'Crop Damage Survey Certificate'], 'Direct ex-gratia financial relief for loss of agricultural produce due to river overflow and extreme weather.')
ON CONFLICT (id) DO NOTHING;

-- Relief Claims Seed
INSERT INTO public.relief_claims (id, claimant_name, citizen_id, phone, disaster_id, damage_type, claimed_amount, location, description, bank_account_last4, status) VALUES
('CLM-9001', 'Ramesh Chandra', 'USR-C01', '+91 98990 11223', 'DIS-101', 'HOUSE_DAMAGE', 45000.00, 'Majnu ka Tilla Block B, Delhi', 'Ground floor flooded up to 4 feet. Furniture and electrical fittings damaged.', '4892', 'VERIFIED'),
('CLM-9002', 'Sunita Devi', 'USR-C01', '+91 98112 33445', 'DIS-101', 'PRE_EVACUATION_COST', 12500.00, 'Kashmiri Gate Lowland Colony', 'Paid private mini-truck for evacuating elderly family members and cattle to relief camp.', '1043', 'REFUND_DISBURSED')
ON CONFLICT (id) DO NOTHING;

-- Sponsors & NGOs Seed
INSERT INTO public.sponsors (id, organization_name, sponsor_type, contact_person, email, phone, website, total_funds_contributed, status) VALUES
('SPON-101', 'Global Disaster Relief Foundation', 'NGO', 'Sarah Jenkins', 'contact@gdrf.org', '+91 11 4567 8900', 'https://gdrf.org', 2500000.00, 'VERIFIED_SPONSOR'),
('SPON-102', 'Tata Trusts CSR Response Unit', 'CORPORATE_CSR', 'Rohan Mehta', 'csr.disaster@tata.com', '+91 22 6665 8282', 'https://tatatrusts.org', 5000000.00, 'VERIFIED_SPONSOR'),
('SPON-103', 'Red Cross Emergency Aid India', 'INTERNATIONAL_AID', 'Dr. Arvind Swaminathan', 'relief@redcross.in', '+91 11 2371 6441', 'https://redcross.in', 7500000.00, 'VERIFIED_SPONSOR')
ON CONFLICT (id) DO NOTHING;

-- Sponsor Donated Equipment Seed
INSERT INTO public.sponsor_donated_equipment (id, sponsor_id, sponsor_name, equipment_name, category, quantity, unit, estimated_value, deployed_location, dispatch_status) VALUES
('EQP-301', 'SPON-101', 'Global Disaster Relief Foundation', 'Heavy Duty Inflatable Rescue Boats (8-Seater)', 'RESCUE_BOATS', 10, 'Boats', 1200000.00, 'Yamuna Flood Relief Base Camp #2', 'DISPATCHED_TO_FIELD'),
('EQP-302', 'SPON-102', 'Tata Trusts CSR Response Unit', 'Solar Powered Clean Water Purification Plants (1000L/hr)', 'WATER_PURIFIERS', 5, 'Units', 2500000.00, 'Kashmiri Gate Shelter Complex', 'DEPLOYED_AND_ACTIVE'),
('EQP-303', 'SPON-103', 'Red Cross Emergency Aid India', 'Emergency Family Survival & Ration Kits', 'FOOD_KITS', 2500, 'Kits', 3750000.00, 'North Delhi Relief Distribution Center', 'DELIVERED_TO_VICTIMS')
ON CONFLICT (id) DO NOTHING;

-- Sponsor Impact Reports Seed
INSERT INTO public.sponsor_impact_reports (id, sponsor_id, sponsor_name, title, disaster_id, location_served, families_assisted, equipment_deployed, summary) VALUES
('IMP-701', 'SPON-101', 'Global Disaster Relief Foundation', 'Yamuna Basin Evacuation & Rescue Boat Deployment Impact Report', 'DIS-101', 'Majnu Ka Tilla & Civil Lines Lowlands', 1420, '10 Heavy Duty Rescue Boats & 100 Life Jackets', 'Deployed 10 motorized rescue boats in coordination with NDRF Battalion 8. Successfully rescued 1,420 stranded citizens including 340 children from flooded residential roofs.'),
('IMP-702', 'SPON-102', 'Tata Trusts CSR Response Unit', 'Emergency Clean Water & Generator Setup in Relief Camps', 'DIS-101', 'Kashmiri Gate Relief Camp #4', 3800, '5 Solar Water Purification Units & 3 High Output Generators', 'Provided continuous safe drinking water and uninterrupted electrical power for lighting and medical cold-chains serving 3,800 displaced victims.')
ON CONFLICT (id) DO NOTHING;


-- =========================================================================
-- LANDSLIDE EARLY WARNING & RISK MONITORING (NORTH EASTERN REGION)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.landslide_zones (
  id VARCHAR(50) PRIMARY KEY,
  state TEXT NOT NULL,
  location_name TEXT NOT NULL,
  lat NUMERIC(10, 6) NOT NULL,
  lng NUMERIC(10, 6) NOT NULL,
  slope_angle_deg NUMERIC(5, 2) DEFAULT 20,
  rainfall_mm_24h NUMERIC(6, 2) DEFAULT 40,
  soil_saturation_percent NUMERIC(5, 2) DEFAULT 40,
  historical_incidents_5yr INT DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.landslide_ground_reports (
  id VARCHAR(50) PRIMARY KEY,
  zone_id VARCHAR(50) REFERENCES public.landslide_zones(id) ON DELETE CASCADE,
  zone_location TEXT,
  observation_type TEXT NOT NULL,
  description TEXT,
  reported_by TEXT,
  reported_by_role TEXT,
  photo_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.field_reports (
  id VARCHAR(50) PRIMARY KEY,
  incident_type TEXT NOT NULL,
  location_name TEXT NOT NULL,
  lat NUMERIC(10, 6),
  lng NUMERIC(10, 6),
  description TEXT,
  reporter_name TEXT,
  reporter_role TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'REPORTED',
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.landslide_zones (id, state, location_name, lat, lng, slope_angle_deg, rainfall_mm_24h, soil_saturation_percent, historical_incidents_5yr) VALUES
('LSZ-01', 'Sikkim', 'Chungthang / North Sikkim', 27.6167, 88.6500, 48, 210, 78, 6),
('LSZ-02', 'Sikkim', 'Gangtok Ridge', 27.3389, 88.6065, 38, 140, 62, 3),
('LSZ-03', 'Meghalaya', 'Sohra (Cherrapunji)', 25.2842, 91.7323, 42, 265, 82, 5),
('LSZ-04', 'Meghalaya', 'Shillong Peak Slopes', 25.5760, 91.8825, 30, 95, 48, 2),
('LSZ-05', 'Assam', 'Haflong, Dima Hasao Hills', 25.1667, 93.0167, 35, 120, 58, 4),
('LSZ-06', 'Mizoram', 'Aizawl Ridge Township', 23.7271, 92.7176, 40, 110, 55, 3),
('LSZ-07', 'Manipur', 'Ukhrul Hill Town', 25.0500, 94.3667, 33, 85, 44, 1),
('LSZ-08', 'Arunachal Pradesh', 'Bomdila Slopes', 27.2645, 92.4159, 45, 100, 50, 2)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- MEDIA STORAGE PROVENANCE COLUMNS
-- Records whether a photo/proof image ended up in Supabase Storage or the
-- local-disk fallback (server/lib/mediaStorage.js). Optional metadata only
-- -- safe to skip if you don't care about tracking storage backend per row.
-- =========================================================================
ALTER TABLE public.sponsor_donated_equipment ADD COLUMN IF NOT EXISTS media_storage TEXT;
ALTER TABLE public.landslide_ground_reports ADD COLUMN IF NOT EXISTS media_storage TEXT;
ALTER TABLE public.field_reports ADD COLUMN IF NOT EXISTS media_storage TEXT;

-- =========================================================================
-- SUPABASE STORAGE BUCKET FOR SPONSOR / FIELD / LANDSLIDE PHOTOS
-- Run this once in the Supabase SQL editor (or create the bucket manually
-- under Storage > New Bucket, name it exactly "idrms-media" or update
-- SUPABASE_MEDIA_BUCKET in .env to match). Used by:
--   - POST /api/sponsors/equipment            (sponsor equipment photo)
--   - POST /api/sponsors/equipment/:id/verify (delivery proof photo)
--   - POST /api/landslide/reports             (ground observation photo)
--   - POST /api/field-reports                 (citizen/field hazard photo)
--
-- ASSUMPTION: bucket is public-read so dashboards/alerts can display images
-- without a signed URL round-trip. If sponsor/field photos must be private,
-- set public=false below and switch mediaStorage.js to createSignedUrl().
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('idrms-media', 'idrms-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access to every file in the bucket (needed for dashboard <img> tags)
CREATE POLICY IF NOT EXISTS "IDRMS media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'idrms-media');

-- Allow uploads from the backend. The Node server uploads using either the
-- anon key (if the bucket's insert policy allows it, as below) or the
-- service_role key (bypasses RLS entirely -- recommended for production;
-- set SUPABASE_SERVICE_ROLE_KEY in .env and server/supabaseClient.js will
-- prefer it automatically).
CREATE POLICY IF NOT EXISTS "IDRMS media authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'idrms-media');

-- =========================================================================
-- ROW LEVEL SECURITY -- MINIMUM VIABLE POLICIES
-- ASSUMPTION: RLS is left permissive (open read, open write via anon key)
-- to match the current no-Supabase-Auth design (the app does its own
-- bcrypt + JWT auth in server/routes/auth.js and talks to Postgres with the
-- anon/service key from the trusted Node backend, not from the browser).
-- If you later call Supabase directly from the browser, tighten these.
-- =========================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Service backend full access to users"
ON public.users FOR ALL USING (true) WITH CHECK (true);
