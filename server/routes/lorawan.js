const express = require('express');
const router = express.Router();
const { getCollectionAsync, insertRecordAsync } = require('../db');

// Global simulated network connection state
let systemNetworkStatus = {
  internet_online: true,
  cellular_towers_active: true,
  lorawan_gateways: [
    { id: "GW-NORTH-DELHI-01", frequency_mhz: 865.2, status: "ACTIVE", coverage_km: 15.0, battery_percent: 94 },
    { id: "GW-EAST-DELHI-02", frequency_mhz: 865.4, status: "ACTIVE", coverage_km: 18.0, battery_percent: 88 },
    { id: "GW-SOUTH-DELHI-03", frequency_mhz: 865.8, status: "ACTIVE", coverage_km: 12.0, battery_percent: 99 }
  ],
  offline_mesh_active: true,
  last_toggle: new Date().toISOString()
};

// Convert string to simulated hex payload
function textToHex(str) {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex.toUpperCase().slice(0, 32);
}

// Get LoRaWAN network connectivity status
router.get('/status', (req, res) => {
  res.json(systemNetworkStatus);
});

// Toggle Network Outage Simulation (ON / OFF)
router.post('/toggle-outage', (req, res) => {
  systemNetworkStatus.internet_online = !systemNetworkStatus.internet_online;
  systemNetworkStatus.cellular_towers_active = systemNetworkStatus.internet_online;
  systemNetworkStatus.last_toggle = new Date().toISOString();

  res.json({
    message: systemNetworkStatus.internet_online 
      ? 'Primary Internet & Cellular Networks Restored.' 
      : 'ALERT: Cellular & Internet Outage Simulated! LoRaWAN Mesh Fallback Activated.',
    status: systemNetworkStatus
  });
});

// Get LoRaWAN Packet Logs
router.get('/messages', async (req, res) => {
  try {
    const messages = await getCollectionAsync('lorawan_messages');
    res.json({
      network_mode: systemNetworkStatus.internet_online ? "HYBRID_PRIMARY" : "OFFLINE_LORAWAN_MESH_ONLY",
      total_packets: messages.length,
      messages
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load LoRaWAN messages' });
  }
});

// Send Emergency SOS / Broadcast Packet over LoRaWAN (Works when offline)
// NOTE: this endpoint is intentionally resilient when Supabase/internet is
// unreachable — insertRecordAsync() below tries Supabase first and silently
// falls back to the local JSON store, so field SOS packets are never lost
// even during the exact network outage this feature exists to survive.
router.post('/send', async (req, res) => {
  try {
    const { sender_name, message, lat, lng, packet_type, dev_eui } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message content is required for radio packet' });
    }

    const activeGateway = systemNetworkStatus.lorawan_gateways[0].id;
    const rssi = Math.floor(Math.random() * 25) - 115; // -90 to -115 dBm
    const snr = Math.round((Math.random() * 8 + 4) * 10) / 10; // 4.0 to 12.0 dB

    const loraPacket = {
      id: `LORA-${Math.floor(1000 + Math.random() * 9000)}`,
      node_id: `LORA-NODE-${Math.floor(10 + Math.random() * 90)}`,
      gateway_id: activeGateway,
      dev_eui: dev_eui || `70B3D57E${Math.floor(10000000 + Math.random() * 90000000).toString(16).toUpperCase()}`,
      rssi_dbm: rssi,
      snr_db: snr,
      packet_type: packet_type || "SOS",
      payload_raw: textToHex(message),
      decoded_message: message,
      sender_name: sender_name || "Emergency Radio Node",
      lat: parseFloat(lat) || 28.6139,
      lng: parseFloat(lng) || 77.2090,
      network_status: systemNetworkStatus.internet_online ? "INTERNET_ONLINE" : "NETWORK_OFFLINE_MESH",
      timestamp: new Date().toISOString()
    };

    const insertedPacket = await insertRecordAsync('lorawan_messages', loraPacket);

    // If packet is SOS, also create disaster alert or log entry
    if (packet_type === "SOS") {
      await insertRecordAsync('alerts', {
        id: `ALT-LORA-${Math.floor(100 + Math.random() * 900)}`,
        title: `LoRaWAN OFFLINE SOS: ${sender_name || 'Radio Node'}`,
        message: `[Mesh Radio Packet via ${activeGateway}] ${message}`,
        disaster_id: "OFFLINE_EMERGENCY",
        severity: "CRITICAL",
        broadcast_area: "LoRa Sector 865MHz",
        target_audience: "FIRST_RESPONDERS",
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        status: "ACTIVE"
      });
    }

    res.status(201).json({
      message: "Packet transmitted successfully over LoRaWAN Sub-GHz mesh network",
      packet: insertedPacket,
      transmission_mode: systemNetworkStatus.internet_online ? "INTERNET_RELAY" : "DIRECT_LORAWAN_MESH_DISPATCH"
    });
  } catch (err) {
    console.error("LoRaWAN Send Error:", err);
    res.status(500).json({ error: "Failed to dispatch LoRaWAN packet" });
  }
});

module.exports = router;
