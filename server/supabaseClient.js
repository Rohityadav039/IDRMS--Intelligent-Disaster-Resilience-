require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
// ASSUMPTION: prefer the service_role key when present. This is a trusted
// Node backend (never exposed to the browser), so service_role lets it
// bypass RLS for both table writes (users/disasters/etc.) and Storage
// uploads (sponsor/landslide/field photos) without needing extra INSERT
// policies. Falls back to the anon key for setups that only filled that in.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;
let isConnected = false;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    isConnected = true;
    console.log('✅ Supabase Client Initialized successfully for IDRMS Backend.');
  } catch (err) {
    console.warn('⚠️ Supabase Initialization warning:', err.message);
  }
} else {
  console.log('ℹ️ Supabase environment variables missing. IDRMS will run with Local JSON Database Fallback.');
}

function getSupabase() {
  return supabase;
}

function isSupabaseConfigured() {
  return isConnected && supabase !== null;
}

module.exports = {
  supabase,
  getSupabase,
  isSupabaseConfigured
};
