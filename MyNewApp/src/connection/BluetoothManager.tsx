/*
import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { View, Button, Text, ScrollView } from 'react-native';
import WebSocketService from '../services/WebSocketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BluetoothDevice } from '../types/bluetoothdevice';

const LAST_DEVICE_KEY = '@last_bluetooth_device';

async function saveLastDevice(device: BluetoothDevice) {
  await AsyncStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(device));
}
async function getLastDevice(): Promise<BluetoothDevice | null> {
  const stored = await AsyncStorage.getItem(LAST_DEVICE_KEY);
  return stored ? JSON.parse(stored) : null;
}

export const BluetoothContext = createContext({
  isConnected: false,
  latestRaw: '',
  showDevicePicker: () => { }
});

export const BluetoothProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setConnected] = useState(false);
  const [latestRaw, setLatestRaw] = useState('');
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    WebSocketService.setOnConnectionChange(setConnected);
    WebSocketService.setOnData((data: string) => setLatestRaw(data));

    async function tryAutoConnect() {
      const lastDevice = await getLastDevice();
      if (lastDevice) {
        try {
          await WebSocketService.connect(lastDevice);
        } catch (err) {
          console.warn('Auto-connect failed:', err);
          setShowPicker(true);
        }
      } else {
        setShowPicker(true);
      }
    }

    tryAutoConnect();

    return () => {
      WebSocketService.disconnect();
    };
  }, []);

  async function listDevices() {
    try {
      const paired = await WebSocketService.listPairedDevices();
      setDevices(paired);
    } catch (error) {
      console.error('Error listing devices:', error);
    }
  }

  async function handleDeviceSelect(device: BluetoothDevice) {
    try {
      await WebSocketService.connect(device);
      await saveLastDevice(device);
      setShowPicker(false);
    } catch (err) {
      console.error('Device connection failed:', err);
    }
  }

  return (
    <BluetoothContext.Provider value={{ isConnected, latestRaw, showDevicePicker: () => setShowPicker(true) }}>
      {children}
      {showPicker && (
        <View style={{ padding: 16 }}>
          <Button title="Refresh Devices" onPress={listDevices} />
          <ScrollView style={{ marginTop: 10 }}>
            {devices.map(device => (
              <View key={device.id} style={{ marginVertical: 5 }}>
                <Button
                  title={device.name || device.id}
                  onPress={() => handleDeviceSelect(device)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </BluetoothContext.Provider>
  );
};
*/