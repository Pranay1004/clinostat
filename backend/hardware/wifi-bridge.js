/**
 * WiFi Bridge Module
 * 
 * Connects to clinostats via WiFi (TCP/UDP sockets)
 * Handles command sending and sensor data streaming
 */

const dgram = require('dgram');
const net = require('net');
const EventEmitter = require('events');

class WiFiBridge extends EventEmitter {
  constructor(config = {}) {
    super();
    this.ip = config.ip || '192.168.1.100';
    this.port = config.port || 5555;
    this.timeout = config.timeout || 5000;
    this.connected = false;
    this.socket = null;
  }

  /**
   * Discover clinostats on local network via UDP broadcast
   */
  async discover(subnet = '192.168.1') {
    console.log('🔍 Scanning WiFi subnet for clinostats...');
    const results = [];
    
    // TODO: Implement UDP broadcast discovery
    // Send discovery packet to all IPs in subnet
    // Listen for responses
    
    return results;
  }

  /**
   * Connect to a clinostat via TCP socket
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.port, this.ip);
      
      this.socket.on('connect', () => {
        console.log(`✅ Connected to clinostat at ${this.ip}:${this.port}`);
        this.connected = true;
        resolve();
      });

      this.socket.on('data', (data) => {
        this.emit('data', data);
      });

      this.socket.on('error', (error) => {
        console.error('❌ WiFi connection error:', error);
        this.connected = false;
        reject(error);
      });

      this.socket.on('close', () => {
        console.log('🔌 WiFi connection closed');
        this.connected = false;
      });

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, this.timeout);
    });
  }

  /**
   * Send command to clinostat
   */
  async sendCommand(command, params = {}) {
    if (!this.connected) {
      throw new Error('Not connected to clinostat');
    }

    const payload = JSON.stringify({ command, params });
    return new Promise((resolve, reject) => {
      this.socket.write(payload + '\n', (error) => {
        if (error) reject(error);
        else {
          console.log(`📤 Sent command: ${command}`);
          resolve();
        }
      });
    });
  }

  /**
   * Stream sensor data
   */
  startStream(callback, interval = 100) {
    this.streamInterval = setInterval(() => {
      if (this.connected) {
        this.sendCommand('GET_SENSORS')
          .catch(err => console.error('Stream error:', err));
      }
    }, interval);
  }

  stopStream() {
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
    }
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.connected = false;
    }
  }
}

module.exports = WiFiBridge;
