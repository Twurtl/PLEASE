# app.py

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import serial
import asyncio
import json
import time
import threading
import os
from datetime import datetime
from typing import Optional
from functools import wraps

# Import your existing modules
from data_processor import DataProcessor
from ml_model import AnomalyDetector

# Import new database modules
from database import (
    get_db, init_database, User, Post, Follow, MLModel, DetectionSession, DetectionLog,
    UserService, MLModelService, SessionService, LogService, AuthService
)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
CORS(app, origins=["*"])
socketio = SocketIO(app, cors_allowed_origins="*", logger=False, engineio_logger=False)

# Global state
clients = set()
processor = DataProcessor()
current_detector = None
current_model_id = None
current_user_id = None
current_session_id = None
detection_running = False
serial_connected = False
serial_thread = None
serial_connection = None

# Serial configuration
SERIAL_PORT = '/dev/tty.usbserial-1320'  # Updated to match your port
BAUD_RATE = 9600

# Initialize database on startup
init_database()

# Authentication middleware for HTTP routes
def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        token = auth_header.split(' ')[1]
        user_id = AuthService.verify_token(token)
        if not user_id:
            return jsonify({'error': 'Invalid or expired token'}), 401
        request.user_id = int(user_id)
        return f(*args, **kwargs)
    return decorated_function

# Socket.IO Handlers
@socketio.on('connect')
def handle_connect():
    try:
        clients.add(request.sid)
        print(f"Client connected: {request.sid}")
        emit('connection_confirmed', {
            'type': 'connection_confirmed',
            'message': 'Connected to Flask server',
            'server_info': {
                'serial_connected': serial_connected,
                'detection_running': detection_running,
                'current_model_id': current_model_id
            }
        })
    except Exception as e:
        print(f"Error in connect handler: {e}")

@socketio.on('disconnect')
def handle_disconnect():
    try:
        clients.discard(request.sid)
        print(f"Client disconnected: {request.sid}")
    except Exception as e:
        print(f"Error in disconnect handler: {e}")

@socketio.on('ping')
def handle_ping():
    try:
        emit('pong', {'type': 'pong', 'timestamp': time.time()})
    except Exception as e:
        print(f"Error in ping handler: {e}")

@socketio.on('get_status')
def handle_get_status(data=None):
    try:
        emit('status_response', {
            'type': 'status_response',
            'server_status': 'running',
            'connected_clients': len(clients),
            'serial_connected': serial_connected,
            'detection_running': detection_running,
            'current_model_id': current_model_id,
            'current_session_id': current_session_id,
            'detector_info': {
                'port': SERIAL_PORT,
                'baud_rate': BAUD_RATE
            },
            'timestamp': time.time()
        })
    except Exception as e:
        print(f"Error in get_status handler: {e}")

@socketio.on('arduino_connect')
def handle_arduino_connect(data=None):
    global serial_thread, serial_connected
    try:
        print("Received Arduino connect request")
        if not serial_connected:
            try:
                serial_thread = threading.Thread(target=arduino_connection_loop, daemon=True)
                serial_thread.start()
                emit('arduino_status', {
                    'type': 'arduino_status', 
                    'connected': True,
                    'message': 'Arduino connection started', 
                    'port': SERIAL_PORT
                })
            except Exception as e:
                print(f"Error starting Arduino connection: {e}")
                emit('arduino_status', {
                    'type': 'arduino_status', 
                    'connected': False, 
                    'error': str(e)
                })
        else:
            emit('arduino_status', {
                'type': 'arduino_status', 
                'connected': True,
                'message': 'Arduino already connected', 
                'port': SERIAL_PORT
            })
    except Exception as e:
        print(f"Error in arduino_connect handler: {e}")

@socketio.on('arduino_disconnect')
def handle_arduino_disconnect(data=None):
    global serial_connected, serial_connection
    try:
        print("Received Arduino disconnect request")
        serial_connected = False
        if serial_connection:
            serial_connection.close()
            serial_connection = None
        emit('arduino_status', {
            'type': 'arduino_status', 
            'connected': False,
            'message': 'Arduino disconnection requested'
        })
    except Exception as e:
        print(f"Error in arduino_disconnect handler: {e}")

@socketio.on('start_detection')
def handle_start_detection(data=None):
    global detection_running, current_detector, current_session_id
    try:
        print("Received start detection request")

        if detection_running:
            emit('detection_status', {
                'type': 'detection_status', 
                'running': True,
                'message': 'Detection is already running'
            })
            return

        if not serial_connected:
            emit('detection_status', {
                'type': 'detection_status', 
                'running': False,
                'error': 'Arduino not connected. Connect to Arduino first.'
            })
            return

        if not current_model_id:
            emit('detection_status', {
                'type': 'detection_status', 
                'running': False,
                'error': 'No ML model selected. Please select a model first.'
            })
            return

        try:
            db = next(get_db())
            try:
                # Use guest user (ID = None) or current user
                user_id = current_user_id  # Can be None for guest users
                if user_id is None:
                    # For guest users, we might skip session creation or use a special guest session
                    print("Guest user detected - using preset model without session tracking")
                    current_session_id = None
                else:
                    session = SessionService.create_session(db, user_id, current_model_id)
                    current_session_id = session.id
                
                model = MLModelService.get_model_by_id(db, current_model_id)
                if not model:
                    emit('detection_status', {
                        'type': 'detection_status', 
                        'running': False,
                        'error': 'Selected model not found'
                    })
                    return
                
                current_detector = AnomalyDetector()
                current_detector.load_model(model.file_path)
                detection_running = True
                
                emit('detection_started', {
                    'type': 'detection_started', 
                    'running': True,
                    'message': 'ML detection started successfully',
                    'session_id': current_session_id, 
                    'model_name': model.name,
                    'is_guest': user_id is None
                })
            finally:
                db.close()
        except Exception as e:
            print(f"Error starting detection: {e}")
            emit('detection_status', {
                'type': 'detection_status', 
                'running': False, 
                'error': str(e)
            })
    except Exception as e:
        print(f"Error in start_detection handler: {e}")

@socketio.on('stop_detection')
def handle_stop_detection(data=None):
    global detection_running, current_detector, current_session_id
    try:
        print("Received stop detection request")
        if not detection_running:
            emit('detection_status', {
                'type': 'detection_status', 
                'running': False,
                'message': 'Detection is not running'
            })
            return
        
        try:
            detection_running = False
            current_detector = None
            
            # Only end session if we have one (registered users)
            if current_session_id:
                db = next(get_db())
                try:
                    SessionService.end_session(db, current_session_id)
                    current_session_id = None
                finally:
                    db.close()
            
            emit('detection_stopped', {
                'type': 'detection_stopped', 
                'running': False,
                'message': 'ML detection stopped successfully'
            })
        except Exception as e:
            print(f"Error stopping detection: {e}")
            emit('detection_status', {
                'type': 'detection_status', 
                'running': False, 
                'error': str(e)
            })
    except Exception as e:
        print(f"Error in stop_detection handler: {e}")

@socketio.on('update_threshold')
def handle_update_threshold(data):
    try:
        threshold = data.get('threshold', 0.5)
        print(f"Updating threshold to: {threshold}")
        
        if current_detector:
            current_detector.update_threshold(threshold)
        
        emit('threshold_updated', {
            'type': 'threshold_updated', 
            'threshold': threshold,
            'message': f'Threshold updated to {threshold}'
        })
    except Exception as e:
        print(f"Error in update_threshold handler: {e}")

def arduino_connection_loop():
    global serial_connected, detection_running, current_detector, current_session_id, serial_connection
    try:
        serial_connection = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        serial_connected = True
        print(f"Connected to Arduino on {SERIAL_PORT}")
        
        socketio.emit('arduino_status', {
            'type': 'arduino_status', 
            'connected': True,
            'port': SERIAL_PORT, 
            'message': 'Arduino connected successfully'
        })

        while serial_connected and serial_connection and serial_connection.is_open:
            try:
                if serial_connection.in_waiting > 0:
                    line = serial_connection.readline().decode('utf-8').strip()
                    if line:
                        try:
                            voltage = float(line)
                            timestamp = time.time()
                            
                            # Emit raw data
                            socketio.emit('arduino_raw_data', {
                                'type': 'arduino_raw_data', 
                                'voltage': voltage,
                                'timestamp': timestamp
                            })
                            
                            # Process with ML if detection is running
                            if detection_running and current_detector:
                                features = processor.process_voltage(voltage, timestamp)
                                prediction = current_detector.predict(features)
                                
                                # Log to database only if we have a session (registered users)
                                if current_session_id and current_user_id:
                                    try:
                                        db = next(get_db())
                                        try:
                                            LogService.log_prediction(
                                                db, current_session_id, current_model_id,
                                                current_user_id, voltage, features, prediction
                                            )
                                        finally:
                                            db.close()
                                    except Exception as e:
                                        print(f"Error logging to database: {e}")
                                
                                result = {
                                    'type': 'arduino_data',
                                    'voltage': voltage,
                                    'timestamp': datetime.now().isoformat(),
                                    'prediction': prediction,
                                    'ml_status': {
                                        'window_progress': prediction.get('window_progress', 0.0),
                                        'window_size': prediction.get('window_size', 50),
                                        'current_window': prediction.get('current_window', 0),
                                        'status': prediction.get('status', 'unknown'),
                                        'method': prediction.get('method', 'unknown')
                                    }
                                }
                                socketio.emit('arduino_data', result)
                                
                        except ValueError:
                            print(f"Invalid voltage reading: {line}")
                            
                time.sleep(0.01)  # Small delay to prevent overwhelming the CPU
                
            except Exception as e:
                print(f"Error reading from Arduino: {e}")
                time.sleep(1)
                
    except Exception as e:
        print(f"Error connecting to Arduino: {e}")
        serial_connected = False
        socketio.emit('arduino_status', {
            'type': 'arduino_status', 
            'connected': False,
            'error': str(e), 
            'message': 'Arduino connection failed'
        })
    finally:
        serial_connected = False
        if serial_connection and serial_connection.is_open:
            serial_connection.close()
            serial_connection = None
        socketio.emit('arduino_status', {
            'type': 'arduino_status', 
            'connected': False,
            'message': 'Arduino disconnected'
        })

# HTTP Routes for API access
@app.route('/status')
def get_status():
    return jsonify({
        "server_status": "running",
        "connected_clients": len(clients),
        "serial_connected": serial_connected,
        "detection_running": detection_running,
        "serial_port": SERIAL_PORT,
        "baud_rate": BAUD_RATE,
        "current_model_id": current_model_id,
        "current_session_id": current_session_id,
        "timestamp": time.time()
    })

@app.route('/test')
def test_endpoint():
    return jsonify({
        "status": "ok", 
        "message": "Server is running", 
        "timestamp": time.time()
    })

@app.route('/')
def root():
    return jsonify({
        "message": "Anomaly Detection Socket.IO Server",
        "connected_clients": len(clients),
        "serial_connected": serial_connected,
        "detection_running": detection_running
    })

# Set current model (for testing purposes)
@app.route('/set_model/<int:model_id>')
def set_model(model_id):
    global current_model_id
    current_model_id = model_id
    return jsonify({
        "message": f"Model set to {model_id}",
        "current_model_id": current_model_id
    })

if __name__ == '__main__':
    # Set a default model for testing - guests can use preset models
    current_model_id = 1
    current_user_id = None  # None for guest users
    
    print("Starting server with guest mode enabled")
    print(f"Default model ID: {current_model_id}")
    print("Users can connect as guests without authentication")
    
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)