/**
 * USB/Serial Bridge Module
 * 
 * Connects to clinostats via USB serial port
 * Handles AT commands and UART data streaming
 * 
 * Note: serialport is optional. Install with: npm install serialport
 */

let SerialPort, ReadlineParser;

try {
  const serialport = require('serialport');
  const { ReadlineParser: RL } = require('@serialport/parser-readline');
  SerialPort = serialport.SerialPort;
  ReadlineParser = RL;
} catch (e) {
  console.warn('⚠️  serialport not installed. USB serial connections will not work.');
  console.warn('   To enable: npm install serialport @serialport/parser-readline');
}

const EventEmitter = require('events');

class USBBridge extends EventEmitter {
  constructor(config = {}) {
    super();
    this.port = config.port || '/dev/ttyUSB0';
    this.baudRate = config.baudRate || 115200;
    this.connected = false;
    this.serialPort = null;
    this.parser = null;
  }

  /**
   * List available USB serial ports
   */
  static async listPorts() {
    return await SerialPort.list();
  }

  /**
   * Connect to clinostat via USB serial
   */
  async connect() {
    if (!SerialPort) {
      throw new Error('serialport module not installed. Run: npm install serialport @serialport/parser-readline');
    }

    return new Promise((resolve, reject) => {
      this.serialPort = new SerialPort({
        path: this.port,
        baudRate: this.baudRate,
        autoOpen: false
      });

      this.serialPort.open((error) => {
        if (error) {
          console.error('❌ Serial port error:', error);
          reject(error);
          return;
        }

        this.parser = this.serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));
        
        this.parser.on('data', (data) => {
          this.emit('data', data);
        });

        this.serialPort.on('error', (error) => {
          console.error('❌ Serial error:', error);
          this.connected = false;
          reject(error);
        });

        this.serialPort.on('close', () => {
          console.log('🔌 Serial port closed');
          this.connected = false;
        });

        console.log(`✅ Connected to clinostat via ${this.port} at ${this.baudRate} baud`);
        this.connected = true;
        resolve();
      });
    });
  }

  /**
   * Send AT command (Arduino-compatible)
   */
  async sendCommand(cmd) {
    if (!this.connected) {
      throw new Error('Not connected to clinostat');
    }

    return new Promise((resolve, reject) => {
      this.serialPort.write(cmd + '\r\n', (error) => {
        if (error) reject(error);
        else {
          console.log(`📤 Serial command: ${cmd}`);
          resolve();
        }
      });
    });
  }

  /**
   * Start motor
   */
  async startMotor(speed = 100) {
    return this.sendCommand(`AT+MOTOR=START,${speed}`);
  }

  /**
   * Stop motor
   */
  async stopMotor() {
    return this.sendCommand('AT+MOTOR=STOP');
  }

  /**
   * Get sensor readings
   */
  async getSensors() {
    return this.sendCommand('AT+SENSOR=READ');
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.serialPort && this.serialPort.isOpen) {
      this.serialPort.close();
      this.connected = false;
    }
  }
}

module.exports = USBBridge;
