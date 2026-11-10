require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, getCollectionAsync } = require('./db');
const { isSupabaseConfigured } = require('./supabaseClient');

const { router: authRouter } = require('./routes/auth');
const weatherRouter = require('./routes/weather');
const disastersRouter = require('./routes/disasters');
const volunteersRouter = require('./routes/volunteers');
const sheltersRouter = require('./routes/shelters');
const lorawanRouter = require('./routes/lorawan');
const policiesRouter = require('./routes/policies');
const sponsorsRouter = require('./routes/sponsors');
const landslideRouter = require('./routes/landslide');
const uploadsRouter = require('./routes/uploads');
const fieldReportsRouter = require('./routes/field-reports');
const livemapRouter = require('./routes/livemap');

const app = express();
const INITIAL_PORT = process.env.PORT || 3000;

// Initialize Database Storage
initDb();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend UI files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Explicit upload static folder
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/disasters', disastersRouter);
app.use('/api/volunteers', volunteersRouter);
app.use('/api/shelters', sheltersRouter);
app.use('/api/lorawan', lorawanRouter);
app.use('/api/policies', policiesRouter);
app.use('/api/sponsors', sponsorsRouter);
app.use('/api/landslide', landslideRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/field-reports', fieldReportsRouter);
app.use('/api/livemap', livemapRouter);

// System Health, Supabase Status & Overview API
app.get('/api/system/summary', async (req, res) => {
  try {
    const [users, disasters, alerts, volunteers, shelters, hospitals, lorawan, policies, claims, sponsors, equipment, impactReports, landslideZones, landslideReports, fieldReports] = await Promise.all([
      getCollectionAsync('users'),
      getCollectionAsync('disasters'),
      getCollectionAsync('alerts'),
      getCollectionAsync('volunteers'),
      getCollectionAsync('shelters'),
      getCollectionAsync('hospitals'),
      getCollectionAsync('lorawan_messages'),
      getCollectionAsync('govt_policies'),
      getCollectionAsync('relief_claims'),
      getCollectionAsync('sponsors'),
      getCollectionAsync('sponsor_donated_equipment'),
      getCollectionAsync('sponsor_impact_reports'),
      getCollectionAsync('landslide_zones'),
      getCollectionAsync('landslide_ground_reports'),
      getCollectionAsync('field_reports')
    ]);

    const landslideHighRisk = landslideZones.filter(z => {
      const score = Math.min(z.rainfall_mm_24h / 300, 1) * 40 + Math.min(z.slope_angle_deg / 60, 1) * 25 + Math.min(z.soil_saturation_percent / 100, 1) * 25 + Math.min(z.historical_incidents_5yr / 10, 1) * 10;
      return score >= 55;
    }).length;

    const supabaseActive = isSupabaseConfigured();

    res.json({
      system: "IDRMS - Intelligent Disaster Management System",
      status: "OPERATIONAL",
      database_mode: supabaseActive ? "SUPABASE_POSTGRESQL_LIVE" : "LOCAL_JSON_FALLBACK",
      supabase_configured: supabaseActive,
      stats: {
        registered_users: users.length,
        active_disasters: disasters.filter(d => d.status === 'ACTIVE').length,
        active_alerts: alerts.filter(a => a.status === 'ACTIVE').length,
        registered_volunteers: volunteers.length,
        open_shelters: shelters.filter(s => s.status === 'OPEN').length,
        operational_hospitals: hospitals.filter(h => h.status === 'OPERATIONAL').length,
        lorawan_packets_logged: lorawan.length,
        govt_policies_count: policies.length,
        relief_claims_count: claims.length,
        registered_sponsors_count: sponsors.length,
        donated_equipment_count: equipment.length,
        sponsor_impact_reports_count: impactReports.length,
        landslide_zones_monitored: landslideZones.length,
        landslide_high_risk_zones: landslideHighRisk,
        landslide_ground_reports_count: landslideReports.length,
        field_reports_count: fieldReports.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback for Single Page Application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start Express Server with dynamic port retry
function listenOnPort(port) {
  const server = app.listen(port, () => {
    const dbStatus = isSupabaseConfigured() ? '⚡ Supabase PostgreSQL Live' : '📁 Local JSON DB';
    console.log(`=======================================================`);
    console.log(` IDRMS Server Running on http://localhost:${port}`);
    console.log(` Database Mode: ${dbStatus}`);
    console.log(` Weather API Connected (OpenWeather & Telemetry)`);
    console.log(` Disaster Management Act 2005 & Refund Claims Active`);
    console.log(` Sponsor & NGO Equipment Upload Platform Ready`);
    console.log(` LoRaWAN Offline Gateway & Radio Mesh Receiver Ready`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = Number(port) + 1;
      console.log(`⚠️ Port ${port} in use. Trying port ${nextPort}...`);
      listenOnPort(nextPort);
    } else {
      console.error('Server listen error:', err);
    }
  });
}

listenOnPort(INITIAL_PORT);
