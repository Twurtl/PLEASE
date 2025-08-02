#!/usr/bin/env python3
"""
Script to find and test Arduino connection ports
"""

import serial
import serial.tools.list_ports
import time

def find_arduino_ports():
    """Find potential Arduino ports"""
    print("🔍 Scanning for Arduino devices...")
    
    ports = serial.tools.list_ports.comports()
    arduino_ports = []
    
    for port in ports:
        port_name = port.device
        description = port.description
        
        print(f"Found port: {port_name} - {description}")
        
        # Look for common Arduino identifiers
        if any(keyword in description.lower() for keyword in [
            'arduino', 'usb', 'serial', 'ftdi', 'ch340', 'cp210x'
        ]):
            arduino_ports.append(port_name)
            print(f"  ✅ Potential Arduino port: {port_name}")
    
    return arduino_ports

def test_arduino_connection(port, baud_rate=9600):
    """Test connection to Arduino port"""
    try:
        print(f"\n🔌 Testing connection to {port} at {baud_rate} baud...")
        
        # Try to connect
        ser = serial.Serial(port, baud_rate, timeout=2)
        time.sleep(2)  # Give Arduino time to reset
        
        print(f"✅ Successfully connected to {port}")
        
        # Try to read some data
        print("📡 Listening for data (5 seconds)...")
        start_time = time.time()
        data_received = False
        
        while time.time() - start_time < 5:
            if ser.in_waiting > 0:
                try:
                    data = ser.readline().decode('utf-8').strip()
                    if data:
                        print(f"📊 Received: {data}")
                        data_received = True
                except:
                    pass
            time.sleep(0.1)
        
        ser.close()
        
        if data_received:
            print(f"✅ {port} is working and sending data!")
            return True
        else:
            print(f"⚠️  {port} connected but no data received")
            return False
            
    except Exception as e:
        print(f"❌ Failed to connect to {port}: {e}")
        return False

def main():
    print("🔧 Arduino Port Finder")
    print("=" * 40)
    
    # Find potential Arduino ports
    arduino_ports = find_arduino_ports()
    
    if not arduino_ports:
        print("\n❌ No potential Arduino ports found!")
        print("💡 Make sure your Arduino is connected via USB")
        return
    
    print(f"\n🎯 Found {len(arduino_ports)} potential Arduino port(s)")
    
    # Test each port
    working_ports = []
    for port in arduino_ports:
        if test_arduino_connection(port):
            working_ports.append(port)
    
    print("\n" + "=" * 40)
    print("📋 RESULTS:")
    
    if working_ports:
        print(f"✅ Working Arduino port(s): {working_ports}")
        print(f"\n🔧 Update your app.py with:")
        print(f"SERIAL_PORT = '{working_ports[0]}'")
    else:
        print("❌ No working Arduino ports found")
        print("\n💡 Troubleshooting tips:")
        print("1. Check USB cable connection")
        print("2. Make sure Arduino is powered on")
        print("3. Check if Arduino is sending serial data")
        print("4. Try different baud rates (9600, 115200)")
        print("5. Check Arduino IDE Serial Monitor first")

if __name__ == "__main__":
    main()