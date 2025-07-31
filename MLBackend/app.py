from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import json
import threading
import time
from data_processor import DataProcessor
from ml_model import AnomalyDetector
import serial
import serial.tools.list_ports

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Global variables
data_processor = DataProcessor()
anomaly_detector = AnomalyDetector()
arduino_serial = None
app_clients = set()


@app.route('/')
def index():
    return "Anomaly Detection WebSocket Server"


@socketio.on('connect')
def handle_connect():
    """Handle React Native app connection"""
    print(f"App connected: {request.sid}")
    app_clients.add(request.sid)
    emit('status', {'message': 'Connected to anomaly detection server'})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle app disconnection"""
    print(f"App disconnected: {request.sid}")
    app_clients.discard(request.sid)


@socketio.on('voltage_data')
def handle_voltage_data(data):
    """Handle voltage data from React Native app"""
    try:
        voltage = float(data.get('voltage', 0))
        timestamp = data.get('timestamp', time.time())

        # Process the voltage data
        processed_data = data_processor.process_voltage(voltage, timestamp)

        # Get anomaly prediction
        anomaly_result = anomaly_detector.predict(processed_data)

        # Send result back to app
        result = {
            'anomaly_score': anomaly_result['score'],
            'is_anomaly': anomaly_result['is_anomaly'],
            'confidence': anomaly_result['confidence'],
            'timestamp': timestamp,
            'voltage': voltage
        }

        emit('anomaly_result', result)

    except Exception as e:
        print(f"Error processing voltage data: {e}")
        emit('error', {'message': 'Error processing data'})


def start_arduino_reader():
    global arduino_serial

    arduino_port = '/dev/tty.usbserial-11320'  # Manually set your Nano's port
    baud_rate = 9600

    try:
        arduino_serial = serial.Serial(arduino_port, baud_rate, timeout=1)
        print(f"Connected to Arduino on {arduino_port}")

        while True:
            if arduino_serial.in_waiting:
                line = arduino_serial.readline().decode('utf-8').strip()
                if line:
                    try:
                        parts = line.split(',')
                        if len(parts) >= 1:
                            voltage = float(parts[0])
                            timestamp = time.time()

                            processed_data = data_processor.process_voltage(
                                voltage, timestamp)
                            anomaly_result = anomaly_detector.predict(
                                processed_data)

                            result = {
                                'anomaly_score': anomaly_result['score'],
                                'is_anomaly': anomaly_result['is_anomaly'],
                                'confidence': anomaly_result['confidence'],
                                'timestamp': timestamp,
                                'voltage': voltage
                            }

                            socketio.emit('anomaly_result', result)

                    except ValueError as e:
                        print(f"Error parsing Arduino data: {e}")

            time.sleep(0.1)

    except Exception as e:
        print(f"Arduino connection error: {e}")
    finally:
        if arduino_serial:
            arduino_serial.close()


if __name__ == '__main__':
    # Start Arduino reader in background thread
    arduino_thread = threading.Thread(target=start_arduino_reader, daemon=True)
    arduino_thread.start()

    print("Starting Anomaly Detection WebSocket Server...")
    print("Server will be available at: http://localhost:5050")
    print("WebSocket endpoint: ws://localhost:5050")

    socketio.run(app, host='0.0.0.0', port=5050, debug=True)
