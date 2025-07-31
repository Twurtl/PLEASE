import serial
import asyncio
import websockets
import json
import time

# Replace with your serial port and baud rate
SERIAL_PORT = '/dev/ttyUSB0'   # or COM3 on Windows
BAUD_RATE = 9600

# Replace with your backend WebSocket server address
WEBSOCKET_URI = 'ws://localhost:5050'

# Function to read serial data line-by-line
def read_serial_lines(serial_conn):
    try:
        line = serial_conn.readline().decode('utf-8').strip()
        return line
    except Exception as e:
        print("Serial read error:", e)
        return None

async def forward_to_websocket():
    print("Connecting to serial port...")
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)  # Wait for Arduino to initialize
        print(f"Connected to {SERIAL_PORT} at {BAUD_RATE} baud.")
    except Exception as e:
        print("Error opening serial port:", e)
        return

    async with websockets.connect(WEBSOCKET_URI) as ws:
        print("Connected to WebSocket server.")
        while True:
            line = read_serial_lines(ser)
            if line:
                try:
                    # Validate it's a JSON string
                    data = json.loads(line)
                    print("Forwarding:", data)
                    await ws.send(json.dumps(data))
                except json.JSONDecodeError:
                    print("Invalid JSON from Arduino:", line)
                except Exception as e:
                    print("WebSocket send error:", e)
            await asyncio.sleep(0.01)  # Slight pause to prevent CPU spike

asyncio.run(forward_to_websocket())
