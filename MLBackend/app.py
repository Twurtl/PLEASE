# app.py

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import serial
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

# Import database modules
from database import (
    get_db, init_database, User, MLModel, DetectionSession, DetectionLog,
    UserService, MLModelService, SessionService, LogService, AuthService
)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key')
CORS(app, origins=["*"])
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

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
is_guest_mode = False

# Serial configuration from environment
SERIAL_PORT = os.getenv('SERIAL_PORT', '/dev/tty.usbserial-1320')
BAUD_RATE = int(os.getenv('BAUD_RATE', '9600'))

# Initialize database on startup
init_database()

# Authentication middleware for REST endpoints


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

# REST API Endpoints


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400

    db = next(get_db())
    try:
        user = UserService.authenticate_user(db, username, password)
        if user:
            token = AuthService.create_access_token(data={"sub": str(user.id)})

            # Get available models for this user
            user_models = UserService.get_user_models(db, user.id)
            preset_models = UserService.get_preset_models(db)
            all_models = user_models + preset_models

            return jsonify({
                'access_token': token,
                'token_type': 'bearer',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email
                },
                'available_models': [
                    {
                        'id': model.id,
                        'name': model.name,
                        'material_type': model.material_type,
                        'is_preset': model.is_preset,
                        'accuracy': model.accuracy,
                        'description': model.description
                    } for model in all_models
                ]
            })
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
    finally:
        db.close()


@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not all([username, email, password]):
        return jsonify({'error': 'Username, email, and password required'}), 400

    db = next(get_db())
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()

        if existing_user:
            return jsonify({'error': 'Username or email already exists'}), 400

        user = UserService.create_user(db, username, email, password)
        token = AuthService.create_access_token(data={"sub": str(user.id)})

        return jsonify({
            'access_token': token,
            'token_type': 'bearer',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            },
            'message': 'User created successfully'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


@app.route('/api/guest/models', methods=['GET'])
def get_guest_models():
    """Get preset models for guest users"""
    db = next(get_db())
    try:
        preset_models = UserService.get_preset_models(db)

        return jsonify([
            {
                'id': model.id,
                'name': model.name,
                'material_type': model.material_type,
                'accuracy': model.accuracy,
                'is_preset': True,
                'description': model.description,
                'created_at': model.created_at.isoformat()
            } for model in preset_models
        ])
    finally:
        db.close()


@app.route('/api/models', methods=['GET'])
@require_auth
def get_models():
    db = next(get_db())
    try:
        user_models = UserService.get_user_models(db, request.user_id)
        preset_models = UserService.get_preset_models(db)
        all_models = user_models + preset_models

        return jsonify([
            {
                'id': model.id,
                'name': model.name,
                'material_type': model.material_type,
                'accuracy': model.accuracy,
                'is_preset': model.is_preset,
                'description': model.description,
                'created_at': model.created_at.isoformat()
            } for model in all_models
        ])
    finally:
        db.close()


@app.route('/api/models/upload', methods=['POST'])
@require_auth
def upload_model():
    """Upload a new ML model file"""
    if 'model_file' not in request.files:
        return jsonify({'error': 'No model file provided'}), 400

    file = request.files['model_file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Get model metadata
    name = request.form.get('name')
    material_type = request.form.get('material_type')
    description = request.form.get('description', '')

    if not all([name, material_type]):
        return jsonify({'error': 'Name and material type are required'}), 400

    try:
        # Save file
        user_models_dir = f"models/user/{request.user_id}"
        os.makedirs(user_models_dir, exist_ok=True)

        filename = f"{int(time.time())}_{file.filename}"
        file_path = os.path.join(user_models_dir, filename)
        file.save(file_path)

        # Save to database
        db = next(get_db())
        try:
            model = MLModelService.create_model(
                db, name, material_type, file_path,
                request.user_id, description=description
            )

            return jsonify({
                'id': model.id,
                'name': model.name,
                'material_type': model.material_type,
                'file_path': model.file_path,
                'message': 'Model uploaded successfully'
            })
        finally:
            db.close()

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Socket.IO Handlers


@socketio.on('connect')
def handle_connect():
    clients.add(request.sid)
    print(f"Client connected: {request.sid}")
    emit('connection_confirmed', {
        'type': 'connection_confirmed',
        'message': 'Connected to Flask server',
        'server_info': {
            'serial_connected': serial_connected,
            'detection_running': detection_running,
            'current_model_id': current_model_id,
            'is_guest_mode': is_guest_mode
        }
    })


@socketio.on('disconnect')
def handle_disconnect():
    clients.discard(request.sid)
    print(f"Client disconnected: {request.sid}")


@socketio.on('ping')
def handle_ping():
    emit('pong', {'type': 'pong', 'timestamp': time.time()})


@socketio.on('get_status')
def handle_get_status(data=None):
    emit('status_update', {
        'type': 'status_update',
        'server_status': 'running',
        'connected_clients': len(clients),
        'serial_connected': serial_connected,
        'detection_running': detection_running,
        'current_model_id': current_model_id,
        'current_session_id': current_session_id,
        'is_guest_mode': is_guest_mode,
        'detector_info': {
            'port': SERIAL_PORT,
            'baud_rate': BAUD_RATE
        },
        'timestamp': time.time()
    })


@socketio.on('arduino_connect')
def handle_arduino_connect():
    global serial_thread, serial_connected
    print("Received Arduino connect request")
    if not serial_connected:
        try:
            serial_thread = threading.Thread(
                target=arduino_connection_loop, daemon=True)
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


@socketio.on('arduino_disconnect')
def handle_arduino_disconnect():
    global serial_connected, serial_connection
    print("Received Arduino disconnect request")
    serial_connected = False
    if serial_connection:
        try:
            serial_connection.close()
        except:
            pass
        serial_connection = None
    emit('arduino_status', {
        'type': 'arduino_status',
        'connected': False,
        'message': 'Arduino disconnection requested'
    })


@socketio.on('reconnect_serial')
def handle_reconnect_serial():
    handle_arduino_disconnect()
    time.sleep(1)
    handle_arduino_connect()


@socketio.on('select_model')
def handle_select_model(data):
    global current_model_id, current_user_id, is_guest_mode
    model_id = data.get('model_id')
    user_id = data.get('user_id')  # Optional for preset models
    guest_mode = data.get('guest_mode', False)

    if not model_id:
        emit('model_selection_result', {
            'type': 'model_selection_result',
            'success': False,
            'error': 'Model ID is required'
        })
        return

    db = next(get_db())
    try:
        model = MLModelService.get_model_by_id(db, model_id)
        if not model:
            emit('model_selection_result', {
                'type': 'model_selection_result',
                'success': False,
                'error': 'Model not found'
            })
            return

        # For guest mode, only allow preset models
        if guest_mode and not model.is_preset:
            emit('model_selection_result', {
                'type': 'model_selection_result',
                'success': False,
                'error': 'Guests can only use preset models'
            })
            return

        current_model_id = model_id
        current_user_id = user_id if not guest_mode else None
        is_guest_mode = guest_mode

        emit('model_selection_result', {
            'type': 'model_selection_result',
            'success': True,
            'model': {
                'id': model.id,
                'name': model.name,
                'material_type': model.material_type,
                'is_preset': model.is_preset
            },
            'guest_mode': is_guest_mode
        })
    finally:
        db.close()


@socketio.on('start_detection')
def handle_start_detection():
    global detection_running, current_detector, current_session_id
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
            # Create session (even for guests, but with user_id = None)
            session = SessionService.create_session(
                db, current_user_id, current_model_id)
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
            # Load model from file path
            current_detector.load_model(model.file_path)
            detection_running = True

            emit('detection_status', {
                'type': 'detection_started',
                'running': True,
                'message': 'ML detection started successfully',
                'session_id': session.id,
                'model_name': model.name,
                'guest_mode': is_guest_mode
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


@socketio.on('stop_detection')
def handle_stop_detection():
    global detection_running, current_detector, current_session_id
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

        if current_session_id:
            db = next(get_db())
            try:
                SessionService.end_session(db, current_session_id)
                current_session_id = None
            finally:
                db.close()

        emit('detection_status', {
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


@socketio.on('update_threshold')
def handle_update_threshold(data):
    threshold = data.get('threshold', 0.5)
    print(f"Updating threshold to: {threshold}")

    if current_detector:
        current_detector.update_threshold(threshold)

    emit('threshold_updated', {
        'type': 'threshold_updated',
        'threshold': threshold,
        'message': f'Threshold updated to {threshold}'
    })


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
                                features = processor.process_voltage(
                                    voltage, timestamp)
                                prediction = current_detector.predict(features)

                                # Log to database (only if not in guest mode or if we want to log guest sessions)
                                if current_session_id and not is_guest_mode:
                                    db = next(get_db())
                                    try:
                                        LogService.log_prediction(
                                            db, current_session_id, current_model_id,
                                            current_user_id, voltage, features, prediction
                                        )
                                    finally:
                                        db.close()

                                result = {
                                    'type': 'arduino_data',
                                    'voltage': voltage,
                                    'timestamp': datetime.now().isoformat(),
                                    'prediction': prediction,
                                    'guest_mode': is_guest_mode,
                                    'ml_status': {
                                        'window_progress': prediction.get('window_progress', 0.0),
                                        'window_size': prediction.get('window_size', 50),
                                        'current_window': prediction.get('current_window', 0),
                                        'status': prediction.get('status', 'ml_ready'),
                                        'method': prediction.get('method', 'ml_model')
                                    }
                                }
                                socketio.emit('arduino_data', result)
                        except ValueError:
                            print(f"Invalid voltage reading: {line}")

                time.sleep(0.01)  # Small delay to prevent overwhelming
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


@app.route('/status')
def get_status():
    return jsonify({
        "server_status": "running",
        "connected_clients": len(clients),
        "serial_connected": serial_connected,
        "detection_running": detection_running,
        "serial_port": SERIAL_PORT,
        "baud_rate": BAUD_RATE,
        "is_guest_mode": is_guest_mode,
        "timestamp": time.time()
    })


@app.route('/')
def root():
    return jsonify({
        "message": "Anomaly Detection WebSocket Server",
        "connected_clients": len(clients),
        "serial_connected": serial_connected,
        "detection_running": detection_running,
        "guest_mode_available": True
    })


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)
