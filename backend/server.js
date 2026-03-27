/**
 * ClinoSim Pro Backend Server
 * 
 * This server bridges the web frontend with physical clinostat hardware:
 * - Receives simulation parameters from frontend
 * - Routes commands to clinostats (WiFi, Serial, Bluetooth)
 * - Streams real-time sensor data back via WebSocket
 * - Logs historical simulation data
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

// ════════════════════════════════════════════
// Configuration
// ════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ════════════════════════════════════════════
// Express App Setup
// ════════════════════════════════════════════
const app = express();

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// ════════════════════════════════════════════
// Routes
// ════════════════════════════════════════════

// API landing page so the public Railway URL is not a blank 404-style response
app.get(['/api', '/api/'], (req, res) => {
  res.json({
    service: 'ClinoSim Pro Backend',
    status: 'ok',
    endpoints: {
      health: '/api/health',
      simulation: '/api/simulation/run',
      devicesDiscover: '/api/devices/discover',
      deviceCommand: '/api/devices/:deviceId/command',
      history: '/api/data/history'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Simulation API - Run simulation in backend
app.post('/api/simulation/run', (req, res) => {
  const { mode, duration, parameters } = req.body;
  
  console.log(`📊 Simulation request: ${mode} mode for ${duration}s`);
  
  // TODO: Call Python physics engine or use JS simulation
  // For now, return mock data
  res.json({
    simulationId: `sim_${Date.now()}`,
    status: 'running',
    mode,
    duration,
    startTime: new Date(),
    url: `ws://localhost:${WS_PORT}/stream/${Date.now()}`
  });
});

// Device Discovery API - Find clinostats on local network
app.get('/api/devices/discover', async (req, res) => {
  console.log('🔍 Device discovery initiated...');
  
  // TODO: Scan local network for clinostats
  // Query mDNS, ping common ranges, check Bluetooth peripherals
  // Note: Hardware bridges require serialport/noble packages
  // Install them locally with: npm install serialport noble @serialport/parser-readline
  
  res.json({
    devices: [
      {
        id: 'wifi_001',
        type: 'WiFi',
        ip: '192.168.1.100',
        name: 'ClinoStat-Lab-1',
        status: 'offline (waiting for hardware)',
        lastSeen: new Date()
      }
    ],
    notice: 'For hardware connections, install optional dependencies: npm install serialport noble',
    timestamp: new Date()
  });
});

// Device Control API
app.post('/api/devices/:deviceId/command', (req, res) => {
  const { deviceId } = req.params;
  const { command, parameters } = req.body;
  
  console.log(`🎮 Command to ${deviceId}: ${command}`);
  
  // TODO: Route command to appropriate bridge (WiFi/Serial/BT)
  
  res.json({
    deviceId,
    command,
    status: 'sent',
    timestamp: new Date()
  });
});

// Get historical data
app.get('/api/data/history', (req, res) => {
  const { deviceId, limit = 100 } = req.query;
  
  res.json({
    deviceId,
    limit,
    data: [],
    count: 0
  });
});

// ════════════════════════════════════════════
// WebSocket Server for Real-time Data
// ════════════════════════════════════════════
const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🔌 Client connected via WebSocket');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Received:', data);
      
      // Echo back for now
      ws.send(JSON.stringify({
        type: 'ack',
        timestamp: new Date()
      }));
    } catch (e) {
      console.error('❌ WebSocket message parse error:', e);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Client disconnected');
  });
});

// Mock sensor data stream (for testing)
setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'sensor_data',
        accelerometer: {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
          z: (Math.random() - 0.5) * 2
        },
        timestamp: Date.now()
      }));
    }
  });
}, 100);

// ════════════════════════════════════════════
// Server Startup
// ════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   ClinoSim Pro Backend Server            ║
╠══════════════════════════════════════════╣
║   HTTP API:  http://localhost:${PORT}             ║
║   Status:    ✅ Running                  ║
╚══════════════════════════════════════════╝
  `);
});

server.listen(WS_PORT, () => {
  console.log(`📡 WebSocket Server listening on ws://localhost:${WS_PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close();
  process.exit(0);
});
