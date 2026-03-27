/**
 * Bluetooth Bridge Module
 * 
 * Connects to clinostats via Bluetooth Low Energy (BLE)
 * Handles GATT service discovery and characteristic reads/writes
 * 
 * Note: noble is optional. Install with: npm install noble
 */

let noble;

try {
  noble = require('noble');
} catch (e) {
  console.warn('⚠️  noble (Bluetooth) not installed. BLE connections will not work.');
  console.warn('   To enable: npm install noble');
}

const EventEmitter = require('events');

class BluetoothBridge extends EventEmitter {
  constructor(config = {}) {
    super();
    this.deviceName = config.deviceName || 'ClinoStat';
    this.serviceUUID = config.serviceUUID || '180a'; // Device Information
    this.connected = false;
    this.peripheral = null;
  }

  /**
   * Scan for nearby Bluetooth devices
   */
  async scan(timeout = 10000) {
    if (!noble) {
      throw new Error('noble module not installed. Run: npm install noble');
    }

    return new Promise((resolve) => {
      const devices = [];

      noble.on('stateChange', (state) => {
        if (state === 'poweredOn') {
          noble.startScanning([], false);
        }
      });

      noble.on('discover', (peripheral) => {
        if (peripheral.advertisement.localName?.includes(this.deviceName)) {
          devices.push({
            id: peripheral.id,
            name: peripheral.advertisement.localName,
            rssi: peripheral.rssi
          });
        }
      });

      setTimeout(() => {
        noble.stopScanning();
        resolve(devices);
      }, timeout);
    });
  }

  /**
   * Connect to a Bluetooth peripheral
   */
  async connect(peripheralId) {
    return new Promise((resolve, reject) => {
      noble.startScanning([], false);

      noble.once('discover', (peripheral) => {
        if (peripheral.id === peripheralId) {
          noble.stopScanning();

          peripheral.connect((error) => {
            if (error) {
              reject(error);
              return;
            }

            this.peripheral = peripheral;
            this.connected = true;
            console.log(`✅ Connected via Bluetooth: ${peripheral.advertisement.localName}`);
            resolve();
          });
        }
      });

      setTimeout(() => {
        reject(new Error('Bluetooth connection timeout'));
      }, 10000);
    });
  }

  /**
   * Send data via BLE write
   */
  async write(serviceUUID, charUUID, data) {
    if (!this.connected) {
      throw new Error('Not connected to Bluetooth device');
    }

    return new Promise((resolve, reject) => {
      this.peripheral.discoverServices([serviceUUID], (error, services) => {
        if (error) {
          reject(error);
          return;
        }

        services[0].discoverCharacteristics([charUUID], (error, chars) => {
          if (error) {
            reject(error);
            return;
          }

          chars[0].write(data, false, (error) => {
            if (error) {
              reject(error);
            } else {
              console.log(`📤 BLE write: ${data.toString('hex')}`);
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Read data via BLE read
   */
  async read(serviceUUID, charUUID) {
    if (!this.connected) {
      throw new Error('Not connected to Bluetooth device');
    }

    return new Promise((resolve, reject) => {
      this.peripheral.discoverServices([serviceUUID], (error, services) => {
        if (error) {
          reject(error);
          return;
        }

        services[0].discoverCharacteristics([charUUID], (error, chars) => {
          if (error) {
            reject(error);
            return;
          }

          chars[0].read((error, data) => {
            if (error) {
              reject(error);
            } else {
              console.log(`📥 BLE read: ${data.toString('hex')}`);
              resolve(data);
            }
          });
        });
      });
    });
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.peripheral) {
      this.peripheral.disconnect();
      this.connected = false;
    }
  }
}

module.exports = BluetoothBridge;
