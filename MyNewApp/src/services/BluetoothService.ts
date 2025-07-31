import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import { BluetoothDevice } from '../types/bluetoothdevice';

class BluetoothService {
  private bleManager: BleManager;
  private connectionCallback?: (connected: boolean) => void;
  private dataCallback?: (data: string) => void;
  private dataSubscription?: Subscription;
  private connected: boolean = false;
  private currentDevice?: Device;
  private stateSubscription?: Subscription;
  private enabled: boolean = false;

  constructor() {
    this.bleManager = new BleManager();
    // Do NOT auto-enable BLE or scan on instantiation
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;

    this.stateSubscription = this.bleManager.onStateChange((state: State) => {
      console.log('BLE state changed:', state);
    }, true);
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    this.disconnect();

    if (this.stateSubscription) {
      this.stateSubscription.remove();
      this.stateSubscription = undefined;
    }

    if (this.dataSubscription) {
      this.dataSubscription.remove();
      this.dataSubscription = undefined;
    }

    this.bleManager.destroy(); // Completely teardown BLE manager
    this.bleManager = new BleManager(); // Re-create it for future use
  }

  async connect(target: BluetoothDevice) {
    if (!this.enabled) {
      console.warn('BluetoothService is disabled. Call enable() first.');
      return;
    }

    try {
      console.log('Connecting to BLE device:', target);

      const [device] = await this.bleManager.devices([target.id]);
      if (!device) throw new Error('Device not found');

      const connectedDevice = await device.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();

      this.currentDevice = connectedDevice;
      this.connected = true;
      this.connectionCallback?.(true);

      // TODO: set up data listener if needed

    } catch (error) {
      console.error('BLE connection failed:', error);
      this.connected = false;
      this.connectionCallback?.(false);
      throw error;
    }
  }

  async disconnect() {
    if (this.dataSubscription) {
      this.dataSubscription.remove();
      this.dataSubscription = undefined;
    }

    if (this.currentDevice) {
      try {
        await this.currentDevice.cancelConnection();
      } catch (error) {
        console.warn('Disconnect failed:', error);
      }
      this.currentDevice = undefined;
    }

    this.connected = false;
    this.connectionCallback?.(false);
  }

  async discoverUnpairedDevices(): Promise<BluetoothDevice[]> {
    if (!this.enabled) {
      console.warn('BluetoothService is disabled. Call enable() first.');
      return [];
    }

    const devices: BluetoothDevice[] = [];

    return new Promise((resolve) => {
      this.bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          this.bleManager.stopDeviceScan();
          resolve(devices);
          return;
        }

        if (device && device.name) {
          devices.push(this.normalizeDevice(device));
        }
      });

      setTimeout(() => {
        this.bleManager.stopDeviceScan();
        resolve(devices);
      }, 10000);
    });
  }

  setOnConnectionChange(callback: (connected: boolean) => void) {
    this.connectionCallback = callback;
  }

  setOnData(callback: (data: string) => void) {
    this.dataCallback = callback;
  }

  isConnected() {
    return this.connected;
  }

  private normalizeDevice(device: Device): BluetoothDevice {
    return {
      id: device.id,
      name: device.name || 'Unknown',
      address: device.id,
      class: undefined,
    };
  }
}

export default new BluetoothService();
