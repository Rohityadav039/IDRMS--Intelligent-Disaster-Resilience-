// IDRMS Main Application JavaScript Engine

// Global Application State
let currentUser = JSON.parse(localStorage.getItem('idrms_user') || 'null');
let authToken = localStorage.getItem('idrms_token') || '';
let mapInstance = null;
let mapMarkers = [];
let landslideMapInstance = null;
let landslideMapMarkers = [];
let landslideZonesCache = [];
let livemapInstance = null;
let livemapLayerGroups = {};
let livemapCountdownHandle = null;
let livemapCountdownValue = 30;

const LIVEMAP_COLORS = {
  disasters: '#dc2626',
  landslide_zones: '#f97316',
  shelters: '#3b82f6',
  hospitals: '#9333ea',
  volunteers: '#10b981',
  field_reports: '#eab308',
  sponsor_equipment: '#06b6d4'
};

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initThemeToggle();
  initLeafletMap();
  initAuthEvents();
  initWeatherModule();
  initVolunteerModule();
  initLoraModule();
  initPolicyAndSponsorEvents();
  initLandslideModule();
  initLivemapModule();
  
  // Initial Data Fetching
  fetchSummaryStats();
  fetchActiveAlerts();
  fetchDisasterIncidents();
  fetchWeather('New Delhi');
  fetchVolunteers();
  fetchLoraMessages();
  fetchSheltersAndHospitals();
  fetchPoliciesAndClaims();
  fetchSponsorsEquipmentAndReports();
  fetchSponsorRankings();
  fetchLandslideZones();
  fetchLandslideAlerts();
  fetchLandslideReports();
  fetchAdminGallery();
  
  if (currentUser) {
    updateAuthUI();
    if (currentUser.role === 'Admin' || currentUser.role === 'FirstResponder') {
      fetchUsersAdminTable();
    }
  }

  document.getElementById('btn-refresh-gallery')?.addEventListener('click', () => {
    fetchAdminGallery();
  });
});

// UI Navigation Tabs
function initNavigation() {
  const tabs = ['map', 'livemap', 'policies', 'sponsors', 'weather', 'volunteers', 'lorawan', 'resources', 'landslide', 'admin'];
  
  tabs.forEach(tab => {
    const btn = document.getElementById(`tab-${tab}`);
    if (!btn) return;

    btn.addEventListener('click', () => {
      tabs.forEach(t => {
        const sec = document.getElementById(`sec-${t}`);
        const tabBtn = document.getElementById(`tab-${t}`);
        if (sec) sec.classList.add('hidden');
        if (tabBtn) {
          tabBtn.classList.remove('bg-amber-500', 'text-slate-900');
          tabBtn.classList.add('bg-slate-800', 'text-white');
        }
      });

      const activeSec = document.getElementById(`sec-${tab}`);
      if (activeSec) activeSec.classList.remove('hidden');
      
      btn.classList.remove('bg-slate-800', 'text-white');
      btn.classList.add('bg-amber-500', 'text-slate-900');

      if (tab === 'map' && mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 200);
      }
      if (tab === 'livemap') {
        if (!livemapInstance) initLivemapMap();
        setTimeout(() => livemapInstance && livemapInstance.invalidateSize(), 200);
        fetchLivemap();
        startLivemapPolling();
      } else {
        stopLivemapPolling();
      }
      if (tab === 'landslide') {
        if (!landslideMapInstance) initLandslideMap();
        setTimeout(() => landslideMapInstance && landslideMapInstance.invalidateSize(), 200);
      }
      if (tab === 'admin') {
        fetchUsersAdminTable();
        fetchAdminGallery();
      }
      if (tab === 'policies') {
        fetchPoliciesAndClaims();
      }
      if (tab === 'sponsors') {
        fetchSponsorsEquipmentAndReports();
        fetchSponsorRankings();
      }
    });
  });

  const brand = document.getElementById('nav-brand');
  if (brand) {
    brand.addEventListener('click', () => {
      document.getElementById('tab-map').click();
    });
  }
}

// Dark Mode Toggle
function initThemeToggle() {
  const btn = document.getElementById('toggle-dark-mode');
  if (btn) {
    btn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
    });
  }
}

// Leaflet GIS Map Initialization
function initLeafletMap() {
  const mapElement = document.getElementById('gis-map');
  if (!mapElement) return;

  mapInstance = L.map('gis-map').setView([28.6139, 77.2090], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors | IDRMS GIS'
  }).addTo(mapInstance);

  mapInstance.on('mousemove', (e) => {
    const coordsDisplay = document.getElementById('map-coords-display');
    if (coordsDisplay) {
      coordsDisplay.innerText = `${e.latlng.lat.toFixed(4)}° N, ${e.latlng.lng.toFixed(4)}° E`;
    }
  });

  const btnRecenter = document.getElementById('btn-recenter-map');
  if (btnRecenter) {
    btnRecenter.addEventListener('click', () => {
      mapInstance.setView([28.6139, 77.2090], 11);
    });
  }
}

// Fetch System Command Stats & Supabase Status
async function fetchSummaryStats() {
  try {
    const res = await fetch('/api/system/summary');
    const data = await res.json();
    
    const badge = document.getElementById('supabase-db-badge');
    if (badge) {
      if (data.supabase_configured) {
        badge.className = "bg-emerald-950 text-emerald-300 font-mono text-[11px] px-2.5 py-0.5 rounded border border-emerald-700 flex items-center gap-1.5 shadow";
        badge.innerHTML = `<i class="fa-solid fa-bolt text-emerald-400"></i> Supabase: Live DB`;
      } else {
        badge.className = "bg-slate-800 text-amber-300 font-mono text-[11px] px-2.5 py-0.5 rounded border border-amber-700 flex items-center gap-1.5 shadow";
        badge.innerHTML = `<i class="fa-solid fa-folder-open text-amber-400"></i> Local JSON DB (Set .env for Supabase)`;
      }
    }

    if (data.stats) {
      document.getElementById('stat-active-disasters').innerText = data.stats.active_disasters;
      document.getElementById('stat-volunteers').innerText = data.stats.registered_volunteers;
      document.getElementById('stat-shelters').innerText = data.stats.open_shelters;
      document.getElementById('stat-lorawan').innerText = data.stats.lorawan_packets_logged;
    }
  } catch (e) {
    console.error("Stats Error:", e);
  }
}

// Fetch Official Alerts
async function fetchActiveAlerts() {
  try {
    const res = await fetch('/api/disasters/alerts');
    const alerts = await res.json();
    const tickerText = document.getElementById('alert-ticker-text');
    if (tickerText && alerts.length > 0) {
      tickerText.innerHTML = alerts.map(a => `<span class="mr-12"><i class="fa-solid fa-bell text-amber-300 mr-2"></i><strong>${a.title}</strong>: ${a.message}</span>`).join('');
    }
  } catch (e) {
    console.error("Alerts Error:", e);
  }
}

// Fetch Disaster Incidents
async function fetchDisasterIncidents() {
  try {
    const res = await fetch('/api/disasters');
    const disasters = await res.json();
    const feedList = document.getElementById('incidents-feed-list');
    
    if (feedList) {
      feedList.innerHTML = disasters.map(d => `
        <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border-l-4 ${d.severity === 'RED' ? 'border-l-red-600' : (d.severity === 'AMBER' ? 'border-l-amber-500' : 'border-l-emerald-500')}">
          <div class="flex justify-between items-start">
            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${d.title}</h4>
            <span class="text-[10px] px-2 py-0.5 rounded font-black uppercase ${d.severity === 'RED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}">${d.severity}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${d.description}</p>
          <div class="mt-2 flex justify-between items-center text-[10px] text-slate-400 font-semibold">
            <span><i class="fa-solid fa-location-dot"></i> ${d.location_name}</span>
            <span>Radius: ${d.radius_km} km</span>
          </div>
        </div>
      `).join('');
    }

    if (mapInstance) {
      disasters.forEach(d => {
        const circle = L.circle([d.lat, d.lng], {
          color: 'red',
          fillColor: '#f03',
          fillOpacity: 0.4,
          radius: d.radius_km * 1000
        }).addTo(mapInstance);
        
        circle.bindPopup(`
          <div style="font-family:sans-serif;">
            <strong style="color:#dc2626;">[${d.severity} DISASTER] ${d.title}</strong><br/>
            <span>${d.description}</span><br/>
            <small>Affected Population: ${d.affected_population.toLocaleString()}</small>
          </div>
        `);
      });
    }
  } catch (e) {
    console.error("Disasters Fetch Error:", e);
  }
}

// NER Landslide Early Warning & Risk Monitoring Module
function riskColor(level) {
  if (level === 'CRITICAL') return '#DC2626';
  if (level === 'HIGH') return '#EA580C';
  if (level === 'MODERATE') return '#FBBF24';
  return '#10B981';
}

// =========================================================================
// Unified Live Map (GET /api/livemap) — single feed powering one Leaflet
// map with a layer toggle per data source, auto-refreshed every 30s.
// =========================================================================
function initLivemapModule() {
  document.querySelectorAll('#livemap-layer-toggles input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', applyLivemapLayerVisibility);
  });
  document.getElementById('btn-livemap-refresh')?.addEventListener('click', () => {
    fetchLivemap();
    livemapCountdownValue = 30;
  });
}

function initLivemapMap() {
  const el = document.getElementById('livemap-map');
  if (!el) return;

  // Centered on the North Eastern Region so the landslide + disaster layers
  // are visible by default; pan/zoom controls let responders look elsewhere.
  livemapInstance = L.map('livemap-map').setView([25.7, 92.8], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors | IDRMS Live Map'
  }).addTo(livemapInstance);

  Object.keys(LIVEMAP_COLORS).forEach(name => {
    livemapLayerGroups[name] = L.layerGroup().addTo(livemapInstance);
  });
}

async function fetchLivemap() {
  try {
    const res = await fetch('/api/livemap');
    const data = await res.json();
    if (!data.success) return;

    if (!livemapInstance) return; // map not mounted yet (tab not opened)

    Object.values(livemapLayerGroups).forEach(g => g.clearLayers());

    (data.features || []).forEach(f => {
      if (typeof f.lat !== 'number' || typeof f.lng !== 'number') return;
      const group = livemapLayerGroups[f.layer];
      if (!group) return;

      const color = LIVEMAP_COLORS[f.layer] || '#64748b';
      const marker = L.circleMarker([f.lat, f.lng], {
        radius: 8,
        fillColor: color,
        color: '#1e293b',
        weight: 1,
        fillOpacity: 0.85
      });

      const photoHtml = f.photo_url ? `<img src="${f.photo_url}" class="w-full h-20 object-cover rounded mt-1" />` : '';
      marker.bindPopup(`
        <div class="text-xs">
          <strong>${f.title || f.layer}</strong><br/>
          ${f.popup || ''}
          ${f.severity ? `<br/><span class="font-bold">${f.severity}${f.risk_score !== undefined ? ' · ' + f.risk_score + '/100' : ''}</span>` : ''}
          ${photoHtml}
        </div>
      `);
      marker.addTo(group);
    });

    applyLivemapLayerVisibility();

    const countEl = document.getElementById('livemap-feature-count');
    if (countEl) {
      const parts = Object.entries(data.counts_by_layer || {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
        .join(' · ');
      countEl.innerHTML = `<i class="fa-solid fa-layer-group mr-1"></i> ${data.total_features} live features · ${parts}`;
    }

    const genEl = document.getElementById('livemap-generated-at');
    if (genEl) genEl.innerText = `Updated ${new Date(data.generated_at).toLocaleTimeString()}`;
  } catch (err) {
    console.error('Livemap fetch error:', err);
  }
}

function applyLivemapLayerVisibility() {
  if (!livemapInstance) return;
  document.querySelectorAll('#livemap-layer-toggles input[type="checkbox"]').forEach(cb => {
    const layer = cb.dataset.layer;
    const group = livemapLayerGroups[layer];
    if (!group) return;
    if (cb.checked) {
      if (!livemapInstance.hasLayer(group)) group.addTo(livemapInstance);
    } else if (livemapInstance.hasLayer(group)) {
      livemapInstance.removeLayer(group);
    }
  });
}

function startLivemapPolling() {
  stopLivemapPolling();
  livemapCountdownValue = 30;
  livemapCountdownHandle = setInterval(() => {
    livemapCountdownValue -= 1;
    const el = document.getElementById('livemap-refresh-countdown');
    if (el) el.innerText = `${Math.max(livemapCountdownValue, 0)}s`;
    if (livemapCountdownValue <= 0) {
      livemapCountdownValue = 30;
      fetchLivemap();
    }
  }, 1000);
}

function stopLivemapPolling() {
  if (livemapCountdownHandle) clearInterval(livemapCountdownHandle);
  livemapCountdownHandle = null;
}

function initLandslideModule() {
  document.getElementById('form-landslide-report')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!authToken) {
      alert('Please log in first to submit a ground observation report.');
      return;
    }

    const zone_id = document.getElementById('lsr-zone').value;
    const observation_type = document.getElementById('lsr-type').value;
    const description = document.getElementById('lsr-desc').value;

    try {
      const res = await fetch('/api/landslide/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ zone_id, observation_type, description })
      });
      const data = await res.json();

      if (res.ok) {
        alert(data.message || 'Ground report submitted successfully!');
        document.getElementById('form-landslide-report').reset();
        fetchLandslideZones();
        fetchLandslideAlerts();
        fetchLandslideReports();
      } else {
        alert(data.error || 'Failed to submit ground report');
      }
    } catch (err) {
      alert('Server error submitting ground report');
    }
  });
}

function initLandslideMap() {
  const mapElement = document.getElementById('landslide-map');
  if (!mapElement) return;

  landslideMapInstance = L.map('landslide-map').setView([25.7, 92.8], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors | IDRMS Landslide Watch'
  }).addTo(landslideMapInstance);

  if (landslideZonesCache.length > 0) renderLandslideMapMarkers(landslideZonesCache);
}

function renderLandslideMapMarkers(zones) {
  if (!landslideMapInstance) return;

  landslideMapMarkers.forEach(m => landslideMapInstance.removeLayer(m));
  landslideMapMarkers = [];

  zones.forEach(z => {
    const marker = L.circleMarker([z.lat, z.lng], {
      radius: 10 + (z.risk_score / 10),
      color: riskColor(z.risk_level),
      fillColor: riskColor(z.risk_level),
      fillOpacity: 0.6,
      weight: 2
    }).addTo(landslideMapInstance);

    marker.bindPopup(`
      <div style="font-family:sans-serif;">
        <strong style="color:${riskColor(z.risk_level)};">[${z.risk_level} RISK] ${z.location_name}, ${z.state}</strong><br/>
        Risk Score: <strong>${z.risk_score}/100</strong><br/>
        Rainfall (24h): ${z.rainfall_mm_24h} mm | Slope: ${z.slope_angle_deg}°<br/>
        Soil Saturation: ${z.soil_saturation_percent}%
      </div>
    `);

    landslideMapMarkers.push(marker);
  });
}

async function fetchLandslideZones() {
  try {
    const res = await fetch('/api/landslide/zones');
    const data = await res.json();
    landslideZonesCache = data.zones || [];

    const grid = document.getElementById('landslide-zones-grid');
    if (grid) {
      grid.innerHTML = landslideZonesCache.map(z => `
        <div class="p-4 rounded-xl border-l-4 bg-slate-50 dark:bg-slate-800" style="border-left-color:${riskColor(z.risk_level)};">
          <div class="flex justify-between items-start mb-1">
            <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100">${z.location_name}</h4>
            <span class="text-[10px] px-2 py-0.5 rounded font-black uppercase text-white" style="background-color:${riskColor(z.risk_level)};">${z.risk_level}</span>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2">${z.state}</p>
          <div class="risk-gauge-track mb-2">
            <div class="risk-gauge-fill" style="width:${z.risk_score}%; background-color:${riskColor(z.risk_level)};"></div>
          </div>
          <div class="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
            <span>Score: ${z.risk_score}/100</span>
            <span>Rain: ${z.rainfall_mm_24h}mm</span>
            <span>Sat: ${z.soil_saturation_percent}%</span>
          </div>
        </div>
      `).join('');
    }

    const zoneSelect = document.getElementById('lsr-zone');
    if (zoneSelect) {
      zoneSelect.innerHTML = landslideZonesCache.map(z => `<option value="${z.id}">${z.location_name}, ${z.state}</option>`).join('');
    }

    if (landslideMapInstance) renderLandslideMapMarkers(landslideZonesCache);
  } catch (e) {
    console.error('Landslide Zones Fetch Error:', e);
  }
}

async function fetchLandslideAlerts() {
  try {
    const res = await fetch('/api/landslide/alerts');
    const data = await res.json();
    const banner = document.getElementById('landslide-warning-banner');
    const summary = document.getElementById('landslide-warning-summary');

    if (banner && summary) {
      if (data.warnings && data.warnings.length > 0) {
        banner.classList.remove('hidden');
        summary.innerText = data.warnings.map(w => `${w.location_name} (${w.state}): ${w.risk_level} — score ${w.risk_score}/100`).join(' · ');
      } else {
        banner.classList.add('hidden');
      }
    }
  } catch (e) {
    console.error('Landslide Alerts Fetch Error:', e);
  }
}

async function fetchLandslideReports() {
  try {
    const res = await fetch('/api/landslide/reports');
    const data = await res.json();
    const tbody = document.getElementById('landslide-reports-table-body');
    const badge = document.getElementById('landslide-report-count-badge');

    if (badge) badge.innerText = data.total || 0;

    if (tbody) {
      if (!data.reports || data.reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-xs text-slate-500 text-center">No ground reports submitted yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = data.reports.map(r => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800 text-xs">
          <td class="p-3 font-mono font-bold text-orange-600">${r.id}</td>
          <td class="p-3 font-semibold text-slate-800 dark:text-slate-100">${r.zone_location || 'NER Zone'}</td>
          <td class="p-3">${r.observation_type}</td>
          <td class="p-3">
            ${r.photo_url ? `
              <img src="${r.photo_url}" alt="Observation Photo" 
                   onclick="window.open('${r.photo_url}', '_blank')" 
                   class="h-10 w-14 object-cover rounded cursor-pointer border border-amber-400 hover:scale-110 transition-transform" />
            ` : `<span class="text-[11px] text-slate-400 italic">No Photo</span>`}
          </td>
          <td class="p-3 text-slate-600 dark:text-slate-300">${r.description || '—'}</td>
          <td class="p-3 text-slate-600 dark:text-slate-400">${r.reported_by || 'Field Reporter'} <span class="text-[10px] text-slate-400">(${r.reported_by_role || 'Volunteer'})</span></td>
          <td class="p-3 font-mono text-[11px] text-slate-500">${new Date(r.submitted_at).toLocaleString()}</td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.error('Landslide Reports Fetch Error:', e);
  }
}

// Weather Module
function initWeatherModule() {
  const btn = document.getElementById('btn-fetch-weather');
  const input = document.getElementById('weather-city-input');

  if (btn) {
    btn.addEventListener('click', () => {
      const city = input ? input.value.trim() : '';
      fetchWeather(city || 'New Delhi');
    });
  }
}

async function fetchWeather(city) {
  try {
    const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
    const data = await res.json();
    
    document.getElementById('wx-city-name').innerText = data.city;
    document.getElementById('wx-temp').innerText = `${data.temperature}°C`;
    document.getElementById('wx-condition').innerText = data.condition;
    document.getElementById('wx-feels').innerText = `${data.feels_like}°C`;
    document.getElementById('wx-humidity').innerText = `${data.humidity}%`;
    document.getElementById('wx-wind').innerText = `${data.wind_speed_kmh} km/h`;
    document.getElementById('wx-pressure').innerText = `${data.pressure_hpa} hPa`;
    document.getElementById('wx-source').innerText = data.data_source === 'OPENWEATHERMAP_LIVE' ? 'OpenWeather API Live' : 'Station Telemetry Engine';

    const forecastGrid = document.getElementById('wx-forecast-grid');
    if (forecastGrid && data.forecast) {
      forecastGrid.innerHTML = data.forecast.map(f => `
        <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center border dark:border-slate-700">
          <span class="block text-xs font-bold text-slate-500">${f.day}</span>
          <i class="fa-solid fa-cloud-showers-heavy my-2 text-blue-500 text-lg"></i>
          <span class="block text-sm font-black text-slate-800 dark:text-slate-100">${f.temp_max}° / ${f.temp_min}°</span>
          <span class="block text-[10px] text-slate-400">${f.condition}</span>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error("Weather Error:", e);
  }
}

// Volunteers Module
function initVolunteerModule() {
  const btn = document.getElementById('btn-apply-vol-filter');
  if (btn) {
    btn.addEventListener('click', () => fetchVolunteers());
  }
}

async function fetchVolunteers() {
  try {
    const skill = document.getElementById('vol-filter-skill')?.value || '';
    const res = await fetch(`/api/volunteers?skill=${encodeURIComponent(skill)}`);
    const volunteers = await res.json();
    
    const grid = document.getElementById('volunteers-cards-grid');
    if (grid) {
      grid.innerHTML = volunteers.map(v => `
        <div class="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100">${v.full_name}</h4>
              <span class="text-xs text-slate-500"><i class="fa-solid fa-phone mr-1"></i> ${v.phone}</span>
            </div>
            <span class="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">${v.status}</span>
          </div>
          <div class="flex flex-wrap gap-1">
            ${(v.skills || []).map(s => `<span class="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded">${s}</span>`).join('')}
          </div>
          <p class="text-xs text-slate-400"><i class="fa-solid fa-location-dot mr-1"></i> ${v.location_name}</p>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error("Volunteers Error:", e);
  }
}

// LoRaWAN Mesh Module
function initLoraModule() {
  const form = document.getElementById('form-send-lora');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sender_name = document.getElementById('lora-sender').value;
      const packet_type = document.getElementById('lora-packet-type').value;
      const decoded_message = document.getElementById('lora-message').value;

      try {
        const res = await fetch('/api/lorawan/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender_name, packet_type, decoded_message })
        });
        const data = await res.json();
        alert(data.message || 'LoRa Radio Packet Broadcasted!');
        document.getElementById('lora-message').value = '';
        fetchLoraMessages();
      } catch (err) {
        alert('LoRa Broadcast Error');
      }
    });
  }
}

async function fetchLoraMessages() {
  try {
    const res = await fetch('/api/lorawan/messages');
    const messages = await res.json();
    const feed = document.getElementById('lora-packets-feed');
    
    if (feed) {
      feed.innerHTML = messages.map(m => `
        <div class="p-3 bg-slate-900 text-white rounded-lg border border-amber-500/40">
          <div class="flex justify-between items-start text-xs text-amber-400 font-mono">
            <span>[${m.node_id}] devEUI: ${m.dev_eui || '70B3D57E'}</span>
            <span>RSSI: ${m.rssi_dbm} dBm | SNR: ${m.snr_db} dB</span>
          </div>
          <p class="text-xs font-bold text-white mt-1">${m.decoded_message}</p>
          <div class="mt-2 flex justify-between items-center text-[10px] text-slate-400">
            <span>Sender: ${m.sender_name}</span>
            <span>${new Date(m.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error("LoRa Fetch Error:", e);
  }
}

// Shelters & Hospitals Locator
async function fetchSheltersAndHospitals() {
  try {
    const [sheltersRes, hospitalsRes] = await Promise.all([
      fetch('/api/shelters/shelters'),
      fetch('/api/shelters/hospitals')
    ]);

    const shelters = await sheltersRes.json();
    const hospitals = await hospitalsRes.json();

    const sheltersList = document.getElementById('shelters-list');
    if (sheltersList) {
      sheltersList.innerHTML = shelters.map(s => `
        <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div class="flex justify-between items-start">
            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${s.name}</h4>
            <span class="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">${s.status}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${s.location_name}</p>
          <div class="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Capacity: ${s.current_occupancy} / ${s.capacity} Beds Occupied
          </div>
        </div>
      `).join('');
    }

    const hospitalsList = document.getElementById('hospitals-list');
    if (hospitalsList) {
      hospitalsList.innerHTML = hospitals.map(h => `
        <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div class="flex justify-between items-start">
            <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100">${h.name}</h4>
            <span class="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">${h.status}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${h.location_name} | Contact: ${h.contact_number}</p>
          <div class="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Available Beds: <strong class="text-emerald-600">${h.available_beds}</strong> | ICU Beds: <strong>${h.icu_beds}</strong>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error("Resources Fetch Error:", e);
  }
}

// Fetch DM Act 2005 Policies & Relief Claims
async function fetchPoliciesAndClaims() {
  try {
    const [polRes, claimsRes] = await Promise.all([
      fetch('/api/policies'),
      fetch('/api/policies/claims')
    ]);

    const polData = await polRes.json();
    const claimsData = await claimsRes.json();

    const polGrid = document.getElementById('policies-cards-grid');
    if (polGrid && polData.policies) {
      polGrid.innerHTML = polData.policies.map(p => `
        <div class="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-start mb-2">
              <span class="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded uppercase">${p.category}</span>
              <span class="text-xs font-mono font-bold text-blue-600">${p.section}</span>
            </div>
            <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1">${p.title}</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${p.description}</p>
          </div>
          <div class="mt-3 pt-2 border-t dark:border-slate-700 flex justify-between items-center text-[10px]">
            <span class="font-bold text-slate-400">${p.act_name}</span>
            <a href="${p.official_link || '#'}" target="_blank" class="text-blue-600 font-bold hover:underline">Official NDMA Gazette <i class="fa-solid fa-arrow-up-right-from-square"></i></a>
          </div>
        </div>
      `).join('');
    }

    const claimsBody = document.getElementById('claims-table-body');
    const badge = document.getElementById('claims-count-badge');
    if (claimsData.claims) {
      if (badge) badge.innerText = `${claimsData.claims.length} Claims Logged`;
      if (claimsBody) {
        claimsBody.innerHTML = claimsData.claims.map(c => `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800 text-xs">
            <td class="p-3 font-mono font-bold text-emerald-600">${c.id}</td>
            <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${c.claimant_name}<br/><span class="text-[10px] text-slate-400">${c.phone}</span></td>
            <td class="p-3"><span class="px-2 py-0.5 rounded font-bold text-[10px] ${c.damage_type.startsWith('PRE') ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">${c.damage_type}</span></td>
            <td class="p-3 font-black text-slate-800 dark:text-slate-100">₹${c.claimed_amount.toLocaleString()}</td>
            <td class="p-3 text-slate-600 dark:text-slate-300">${c.location}</td>
            <td class="p-3 text-slate-500 max-w-xs truncate">${c.description}</td>
            <td class="p-3"><span class="text-[10px] font-black px-2 py-0.5 rounded ${c.status === 'REFUND_DISBURSED' ? 'bg-emerald-500 text-white' : (c.status === 'VERIFIED' ? 'bg-blue-500 text-white' : 'bg-amber-400 text-slate-950')}">${c.status}</span></td>
          </tr>
        `).join('');
      }
    }
  } catch (e) {
    console.error("Policies & Claims Error:", e);
  }
}

// Fetch Sponsor Leaderboard Rankings
async function fetchSponsorRankings() {
  try {
    const res = await fetch('/api/sponsors/rankings');
    const data = await res.json();
    const tbody = document.getElementById('sponsors-leaderboard-tbody');

    if (tbody && data.rankings) {
      tbody.innerHTML = data.rankings.map((s, idx) => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800 text-xs">
          <td class="p-3">
            <span class="font-black text-xs px-2.5 py-1 rounded ${s.rank_tier === 'PLATINUM' ? 'bg-purple-100 text-purple-900 border border-purple-300' : (s.rank_tier === 'GOLD' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-200 text-slate-800')}">
              ${idx === 0 ? '👑 #1 ' : `#${idx+1} `}${s.tier_badge}
            </span>
          </td>
          <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${s.organization_name}</td>
          <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-900">${s.sponsor_type}</span></td>
          <td class="p-3 font-mono font-bold text-emerald-600"><i class="fa-solid fa-circle-check mr-1"></i> ${s.stats.verified_deliveries} / ${s.stats.total_donated_equipment} items</td>
          <td class="p-3 font-black text-slate-800 dark:text-slate-100"><i class="fa-solid fa-users text-red-500 mr-1"></i> ${s.stats.families_assisted.toLocaleString()}</td>
          <td class="p-3 font-bold text-slate-700 dark:text-slate-300">₹${(s.total_funds_contributed || 0).toLocaleString()}</td>
          <td class="p-3 font-black text-base text-cyan-600 font-mono">${s.trust_score} pts</td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.error("Rankings Fetch Error:", e);
  }
}

// Fetch Donated Equipment & Impact Reports
async function fetchSponsorsEquipmentAndReports() {
  try {
    const [equipRes, reportsRes] = await Promise.all([
      fetch('/api/sponsors/equipment'),
      fetch('/api/sponsors/impact-reports')
    ]);

    const equipData = await equipRes.json();
    const reportsData = await reportsRes.json();

    const equipGrid = document.getElementById('donated-equipment-grid');
    const equipBadge = document.getElementById('equipment-count-badge');
    if (equipData.equipment) {
      if (equipBadge) equipBadge.innerText = `${equipData.equipment.length} Equipment Logged`;
      if (equipGrid) {
        equipGrid.innerHTML = equipData.equipment.map(e => `
          <div class="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border ${e.dispatch_status === 'DELIVERY_CONFIRMED' ? 'border-emerald-500' : 'border-amber-400'} flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] bg-cyan-100 text-cyan-900 font-bold px-2 py-0.5 rounded">${e.category}</span>
                <span class="text-xs font-mono font-black px-2 py-0.5 rounded ${e.dispatch_status === 'DELIVERY_CONFIRMED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                  ${e.dispatch_status === 'DELIVERY_CONFIRMED' ? '<i class="fa-solid fa-badge-check text-emerald-600"></i> DELIVERED & VERIFIED' : '<i class="fa-solid fa-truck-fast"></i> IN TRANSIT'}
                </span>
              </div>
              <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1">${e.equipment_name}</h4>
              <p class="text-xs text-slate-500 font-semibold mb-2">Sponsor: <strong class="text-slate-700 dark:text-slate-200">${e.sponsor_name}</strong></p>
              
              <div class="text-[10px] bg-slate-900 text-slate-200 p-2 rounded font-mono mb-2">
                <span>Tracking Hash: <strong>${e.tracking_hash || 'TRACK-EQP-GPS'}</strong></span>
              </div>

              <div class="grid grid-cols-2 gap-2 text-xs bg-cyan-50/50 dark:bg-slate-900 p-2.5 rounded-lg mb-2">
                <div>Quantity: <strong>${e.quantity} ${e.unit}</strong></div>
                <div>Est. Value: <strong>₹${(e.estimated_value || 0).toLocaleString()}</strong></div>
              </div>
            </div>

            <div>
              ${e.dispatch_status === 'DELIVERY_CONFIRMED' ? `
                ${e.proof_image_url ? `
                  <img src="${e.proof_image_url}" alt="Delivery proof for ${e.equipment_name}" onclick="window.open('${e.proof_image_url}', '_blank')" class="w-full h-32 object-cover rounded-lg mb-2 cursor-zoom-in border border-emerald-300" />
                ` : ''}
                <div class="p-2 bg-emerald-50 dark:bg-slate-900 text-emerald-900 dark:text-emerald-300 rounded text-[11px] font-semibold space-y-1">
                  <div class="flex items-center gap-1"><i class="fa-solid fa-user-check text-emerald-600"></i> Verified by: <strong>${e.verified_by_officer || 'NDRF Officer'}</strong></div>
                  ${e.delivery_lat ? `<div class="font-mono text-[10px]"><i class="fa-solid fa-location-dot"></i> GPS: ${e.delivery_lat.toFixed(4)}°, ${e.delivery_lng.toFixed(4)}°</div>` : ''}
                </div>
              ` : `
                <button onclick="openVerifyModal('${e.id}', '${e.equipment_name.replace(/'/g, "\\'")}')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded text-xs shadow flex items-center justify-center gap-1">
                  <i class="fa-solid fa-clipboard-check"></i> Field Officer Delivery Sign-off
                </button>
              `}
            </div>
          </div>
        `).join('');
      }
    }

    const reportsFeed = document.getElementById('sponsor-impact-reports-feed');
    const reportsBadge = document.getElementById('impact-reports-count-badge');
    if (reportsData.reports) {
      if (reportsBadge) reportsBadge.innerText = `${reportsData.reports.length} Reports Published`;
      if (reportsFeed) {
        reportsFeed.innerHTML = reportsData.reports.map(r => `
          <div class="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border-l-4 border-l-cyan-500 shadow-sm space-y-2">
            <div class="flex justify-between items-start">
              <h4 class="font-bold text-base text-slate-800 dark:text-slate-100">${r.title}</h4>
              <span class="text-xs bg-red-100 text-red-800 font-black px-2.5 py-1 rounded-full"><i class="fa-solid fa-people-roof mr-1"></i> ${r.families_assisted} Families Assisted</span>
            </div>
            <p class="text-xs font-semibold text-cyan-600">Sponsor: ${r.sponsor_name} | Location: ${r.location_served}</p>
            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">${r.summary}</p>
            <div class="pt-2 flex justify-between items-center text-[10px] text-slate-400 font-semibold border-t dark:border-slate-700">
              <span>Equipment Deployed: ${r.equipment_deployed}</span>
              <span>Published: ${new Date(r.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (e) {
    console.error("Sponsors & Equipment Error:", e);
  }
}

// Global Open Verify Modal helper
window.openVerifyModal = function(id, name) {
  document.getElementById('verify-equip-id').value = id;
  document.getElementById('verify-equip-name-display').value = name;
  document.getElementById('modal-verify-equipment').classList.remove('hidden');
};

// Init Policy & Sponsor Form Handlers
function initPolicyAndSponsorEvents() {
  const modalClaim = document.getElementById('modal-claim');
  const modalEquip = document.getElementById('modal-sponsor-equip');
  const modalImpact = document.getElementById('modal-impact-report');
  const modalSponsorReg = document.getElementById('modal-sponsor-reg');
  const modalVerify = document.getElementById('modal-verify-equipment');

  document.getElementById('btn-open-claim-modal')?.addEventListener('click', () => modalClaim.classList.remove('hidden'));
  document.getElementById('btn-open-sponsor-equip-modal')?.addEventListener('click', () => modalEquip.classList.remove('hidden'));
  document.getElementById('btn-open-impact-report-modal')?.addEventListener('click', () => modalImpact.classList.remove('hidden'));
  document.getElementById('btn-open-sponsor-reg-modal')?.addEventListener('click', () => modalSponsorReg.classList.remove('hidden'));

  // Verify Equipment Form Submission
  document.getElementById('form-verify-equipment')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('verify-equip-id').value;
    const verified_by_officer = document.getElementById('verify-officer-name').value;
    const delivery_lat = document.getElementById('verify-lat').value;
    const delivery_lng = document.getElementById('verify-lng').value;
    const proof_image_url = document.getElementById('verify-proof-url').value;
    const proofFileInput = document.getElementById('verify-proof-file');

    const formData = new FormData();
    formData.append('verified_by_officer', verified_by_officer);
    formData.append('delivery_lat', delivery_lat);
    formData.append('delivery_lng', delivery_lng);
    if (proof_image_url) formData.append('proof_image_url', proof_image_url);
    if (proofFileInput && proofFileInput.files && proofFileInput.files[0]) {
      formData.append('proof_photo', proofFileInput.files[0]);
    }

    try {
      const res = await fetch(`/api/sponsors/equipment/${id}/verify`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        alert('Equipment delivery verified by Field Officer! Sponsor score updated.');
        modalVerify.classList.add('hidden');
        document.getElementById('form-verify-equipment').reset();
        fetchSponsorsEquipmentAndReports();
        fetchSponsorRankings();
        fetchAdminGallery();
      } else {
        alert(data.error || 'Verification error');
      }
    } catch (err) {
      alert('Server error verifying equipment delivery');
    }
  });

  // File Claim Form Handler
  document.getElementById('form-file-claim')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const claimant_name = document.getElementById('claim-name').value;
    const phone = document.getElementById('claim-phone').value;
    const damage_type = document.getElementById('claim-type').value;
    const claimed_amount = document.getElementById('claim-amount').value;
    const location = document.getElementById('claim-location').value;
    const bank_account_last4 = document.getElementById('claim-bank').value;
    const disaster_id = document.getElementById('claim-disaster-id').value;
    const description = document.getElementById('claim-desc').value;

    try {
      const res = await fetch('/api/policies/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimant_name, phone, damage_type, claimed_amount, location, bank_account_last4, disaster_id, description })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Relief claim submitted successfully!');
        modalClaim.classList.add('hidden');
        fetchPoliciesAndClaims();
      } else {
        alert(data.error || 'Claim submission error');
      }
    } catch (err) {
      alert('Server error submitting relief claim');
    }
  });

  // Upload Equipment Form Handler
  document.getElementById('form-upload-equip')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sponsor_name = document.getElementById('equip-sponsor-name').value;
    const category = document.getElementById('equip-category').value;
    const equipment_name = document.getElementById('equip-name').value;
    const quantity = document.getElementById('equip-qty').value;
    const unit = document.getElementById('equip-unit').value;
    const estimated_value = document.getElementById('equip-val').value;
    const deployed_location = document.getElementById('equip-location').value;
    const equipPhotoInput = document.getElementById('equip-photo');

    const formData = new FormData();
    formData.append('sponsor_name', sponsor_name);
    formData.append('category', category);
    formData.append('equipment_name', equipment_name);
    formData.append('quantity', quantity);
    formData.append('unit', unit);
    formData.append('estimated_value', estimated_value);
    formData.append('deployed_location', deployed_location);
    if (equipPhotoInput && equipPhotoInput.files && equipPhotoInput.files[0]) {
      formData.append('photo', equipPhotoInput.files[0]);
    }

    try {
      const res = await fetch('/api/sponsors/equipment', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Donated equipment logged successfully!');
        modalEquip.classList.add('hidden');
        document.getElementById('form-upload-equip').reset();
        fetchSponsorsEquipmentAndReports();
        fetchSponsorRankings();
        fetchAdminGallery();
      } else {
        alert(data.error || 'Equipment upload error');
      }
    } catch (err) {
      alert('Server error uploading equipment');
    }
  });

  // Submit Impact Report Form Handler
  document.getElementById('form-submit-impact')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sponsor_name = document.getElementById('impact-sponsor-name').value;
    const families_assisted = document.getElementById('impact-families').value;
    const title = document.getElementById('impact-title').value;
    const location_served = document.getElementById('impact-location').value;
    const equipment_deployed = document.getElementById('impact-equip-deployed').value;
    const summary = document.getElementById('impact-summary').value;

    try {
      const res = await fetch('/api/sponsors/impact-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsor_name, families_assisted, title, location_served, equipment_deployed, summary })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Impact report published!');
        modalImpact.classList.add('hidden');
        fetchSponsorsEquipmentAndReports();
        fetchSponsorRankings();
      } else {
        alert(data.error || 'Impact report error');
      }
    } catch (err) {
      alert('Server error submitting impact report');
    }
  });

  // Register Sponsor Form Handler
  document.getElementById('form-register-sponsor')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const organization_name = document.getElementById('sponreg-name').value;
    const sponsor_type = document.getElementById('sponreg-type').value;
    const contact_person = document.getElementById('sponreg-person').value;
    const email = document.getElementById('sponreg-email').value;
    const phone = document.getElementById('sponreg-phone').value;
    const website = document.getElementById('sponreg-website').value;

    try {
      const res = await fetch('/api/sponsors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_name, sponsor_type, contact_person, email, phone, website })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Sponsor organization registered!');
        modalSponsorReg.classList.add('hidden');
        fetchSponsorsEquipmentAndReports();
        fetchSponsorRankings();
      } else {
        alert(data.error || 'Sponsor registration error');
      }
    } catch (err) {
      alert('Server error registering sponsor');
    }
  });
}

// Admin Backend - Fetch Logged In Users Database View
async function fetchUsersAdminTable() {
  try {
    const res = await fetch('/api/auth/users', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (res.status === 401 || res.status === 403) {
      document.getElementById('admin-users-table-body').innerHTML = `
        <tr>
          <td colspan="7" class="p-4 text-xs text-amber-600 text-center font-bold">
            <i class="fa-solid fa-lock mr-1"></i> Authentication Required. Please log in with an Administrator or Command account to access user session database.
          </td>
        </tr>
      `;
      return;
    }

    const data = await res.json();
    document.getElementById('user-count-badge').innerText = data.total_users;

    const tbody = document.getElementById('admin-users-table-body');
    if (tbody && data.users) {
      tbody.innerHTML = data.users.map(u => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800 text-xs">
          <td class="p-3 font-mono font-bold text-blue-600">${u.id}</td>
          <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${u.full_name}</td>
          <td class="p-3 font-mono text-slate-600 dark:text-slate-300">${u.email}</td>
          <td class="p-3"><span class="px-2 py-0.5 rounded font-black text-[10px] ${u.role === 'Admin' ? 'bg-red-100 text-red-800' : (u.role === 'Volunteer' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800')}">${u.role}</span></td>
          <td class="p-3 text-slate-600 dark:text-slate-400">${u.phone || 'N/A'}</td>
          <td class="p-3 font-mono text-[11px] text-slate-500">${u.location_lat ? `${u.location_lat.toFixed(4)}, ${u.location_lng.toFixed(4)}` : 'Default'}</td>
          <td class="p-3"><span class="text-[10px] bg-emerald-500 text-white font-bold px-2 py-0.5 rounded">ACTIVE</span></td>
        </tr>
      `).join('');
    }
  } catch (e) {
    console.error("Admin Fetch Error:", e);
  }
}

// Admin Backend - Fetch Uploaded Photos Gallery
async function fetchAdminGallery() {
  try {
    const res = await fetch('/api/uploads/gallery');
    const data = await res.json();
    const grid = document.getElementById('admin-gallery-grid');
    const badge = document.getElementById('gallery-count-badge');

    if (badge) badge.innerText = data.total_images || 0;

    if (grid) {
      if (!data.gallery || data.gallery.length === 0) {
        grid.innerHTML = `<div class="col-span-full p-4 text-xs text-slate-500 text-center">No uploaded photo records found yet.</div>`;
        return;
      }
      grid.innerHTML = data.gallery.map(img => `
        <div class="sachet-card p-3 flex flex-col justify-between border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow rounded-xl hover:shadow-lg transition-shadow">
          <div>
            <div class="relative mb-2 overflow-hidden rounded-lg bg-slate-900 h-36">
              <img src="${img.url}" alt="${img.title}" 
                   onclick="window.open('${img.url}', '_blank')" 
                   class="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" />
              <span class="absolute top-2 left-2 bg-slate-950/80 text-white font-bold text-[10px] px-2 py-0.5 rounded border border-amber-400">
                ${img.category}
              </span>
            </div>
            <h4 class="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">${img.title}</h4>
            <p class="text-[11px] text-slate-500 truncate">${img.subtitle || 'Ground Report'}</p>
            <p class="text-[11px] text-slate-400 mt-1"><i class="fa-solid fa-location-dot mr-1 text-red-500"></i> ${img.location}</p>
            ${img.description ? `<p class="text-[11px] text-slate-600 dark:text-slate-300 mt-1 italic line-clamp-2">"${img.description}"</p>` : ''}
          </div>
          <div class="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>${new Date(img.uploaded_at).toLocaleDateString()}</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-bold"><i class="fa-solid fa-circle-check"></i> ${img.status || 'VERIFIED'}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    console.error("Admin Gallery Fetch Error:", e);
  }
}

// Authentication Modals & API Calls
function initAuthEvents() {
  const modalLogin = document.getElementById('modal-login');
  const modalRegister = document.getElementById('modal-register');

  document.getElementById('btn-open-login')?.addEventListener('click', () => modalLogin.classList.remove('hidden'));
  document.getElementById('btn-open-register')?.addEventListener('click', () => modalRegister.classList.remove('hidden'));
  document.getElementById('btn-register-vol-modal')?.addEventListener('click', () => {
    document.getElementById('reg-role').value = 'Volunteer';
    modalRegister.classList.remove('hidden');
  });

  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      modalLogin.classList.add('hidden');
      modalRegister.classList.add('hidden');
      document.getElementById('modal-claim')?.classList.add('hidden');
      document.getElementById('modal-sponsor-equip')?.classList.add('hidden');
      document.getElementById('modal-impact-report')?.classList.add('hidden');
      document.getElementById('modal-sponsor-reg')?.classList.add('hidden');
      document.getElementById('modal-verify-equipment')?.classList.add('hidden');
      document.getElementById('modal-broadcast-alert')?.classList.add('hidden');
    });
  });

  document.getElementById('btn-broadcast-alert-modal')?.addEventListener('click', () => {
    if (!authToken) {
      alert('Please log in as Admin to issue an alert broadcast.');
      return;
    }
    document.getElementById('modal-broadcast-alert').classList.remove('hidden');
  });

  document.getElementById('form-broadcast-alert')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('broadcast-title').value;
    const message = document.getElementById('broadcast-message').value;
    const severity = document.getElementById('broadcast-severity').value;
    const broadcast_area = document.getElementById('broadcast-area').value;

    try {
      const res = await fetch('/api/disasters/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ title, message, severity, broadcast_area })
      });
      const data = await res.json();

      if (res.ok) {
        alert('Alert broadcasted successfully. It is now live on the ticker.');
        document.getElementById('modal-broadcast-alert').classList.add('hidden');
        document.getElementById('form-broadcast-alert').reset();
        fetchActiveAlerts();
        fetchSummaryStats();
      } else {
        alert(data.error || 'Failed to broadcast alert. Admin login required.');
      }
    } catch (err) {
      alert('Server error broadcasting alert');
    }
  });

  // Handle Login Form Submission
  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('idrms_token', authToken);
        localStorage.setItem('idrms_user', JSON.stringify(currentUser));
        
        modalLogin.classList.add('hidden');
        updateAuthUI();
        alert(`Welcome back, ${currentUser.full_name} (${currentUser.role})`);
        fetchUsersAdminTable();
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (err) {
      alert('Login server error');
    }
  });

  // Handle Register Form Submission
  document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const full_name = document.getElementById('reg-name').value;
    const role = document.getElementById('reg-role').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;
    const phone = document.getElementById('reg-phone').value;
    const address = document.getElementById('reg-address').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name, role, email, password, phone, address })
      });
      const data = await res.json();

      if (res.ok) {
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('idrms_token', authToken);
        localStorage.setItem('idrms_user', JSON.stringify(currentUser));

        modalRegister.classList.add('hidden');
        updateAuthUI();
        alert(`Account created successfully! Logged in as ${currentUser.full_name}`);
        fetchVolunteers();
        fetchUsersAdminTable();
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (err) {
      alert('Registration server error');
    }
  });
}

function updateAuthUI() {
  const container = document.getElementById('auth-header-controls');
  if (container && currentUser) {
    container.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="text-right text-xs">
          <span class="block font-bold text-white">${currentUser.full_name}</span>
          <span class="text-[10px] text-amber-300 font-bold uppercase">${currentUser.role}</span>
        </div>
        <button id="btn-logout" class="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-bold">
          <i class="fa-solid fa-right-from-bracket mr-1"></i> Logout
        </button>
      </div>
    `;

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      localStorage.removeItem('idrms_token');
      localStorage.removeItem('idrms_user');
      authToken = '';
      currentUser = null;
      window.location.reload();
    });
  }
}
