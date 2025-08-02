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
    get_db, init_database, User, Model, Log, Configuration,
    UserService, ModelService, LogService, ConfigurationService, AuthService
)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
CORS(app, origins=["*"], supports_credentials=True)
socketio = SocketIO(
    app, 
    cors_allowed_origins="*", 
    cors_credentials=True,
    logger=False, 
    engineio_logger=False,
    async_mode='threading',
    ping_timeout=60,
    ping_interval=25
)

# Global state
clients = set()
processor = DataProcessor()
current_detector = None
current_model_id = None
current_user_id = None
detection_running = False
serial_connected = False
serial_thread = None
serial_connection = None
data_collection_active = True  # New flag to control data collection
sample_counter = 0  # Counter for data sampling
SAMPLE_EVERY_N = 3  # Process every 3rd data point for performance
auto_stop_timer = None  # Timer for auto-stopping detection

# Detection session tracking
detection_predictions = []  # Store all predictions during a detection session
detection_window_complete = False  # Track if we've filled the rolling window

# Session history storage (in-memory, clears on restart)
session_history = []  # Store completed detection sessions

# Serial configuration
SERIAL_PORT = '/dev/cu.usbserial-1320'  # Updated to match your port
BAUD_RATE = 9600

def analyze_detection_session():
    """
    Analyze the complete detection session and provide a final decision
    """
    global detection_predictions
    
    if not detection_predictions:
        return {
            'decision': 'insufficient_data',
            'confidence': 0.0,
            'summary': 'Not enough data collected for analysis',
            'total_predictions': 0,
            'anomaly_count': 0,
            'anomaly_percentage': 0.0
        }
    
    # Calculate statistics
    total_predictions = len(detection_predictions)
    anomaly_count = sum(1 for p in detection_predictions if p.get('is_anomaly', False))
    anomaly_percentage = (anomaly_count / total_predictions) * 100
    
    # Calculate average confidence and anomaly score
    avg_confidence = sum(p.get('confidence', 0) for p in detection_predictions) / total_predictions
    avg_anomaly_score = sum(p.get('score', 0) for p in detection_predictions) / total_predictions
    
    # Decision logic: Consider material anomalous if >20% of readings are anomalous
    # or if average anomaly score is high
    anomaly_threshold = 20.0  # 20% threshold
    score_threshold = 0.7     # High anomaly score threshold
    
    is_dataset_anomalous = (
        anomaly_percentage > anomaly_threshold or 
        avg_anomaly_score > score_threshold
    )
    
    if is_dataset_anomalous:
        decision = 'anomalous'
        summary = f'⚠️ ANOMALOUS MATERIAL DETECTED - {anomaly_percentage:.1f}% of readings were anomalous. This object/material requires inspection.'
    else:
        decision = 'normal'
        summary = f'✅ NORMAL MATERIAL - {anomaly_percentage:.1f}% anomalous readings detected. Material appears healthy.'
    
    return {
        'decision': decision,
        'confidence': avg_confidence,
        'summary': summary,
        'total_predictions': total_predictions,
        'anomaly_count': anomaly_count,
        'anomaly_percentage': round(anomaly_percentage, 1),
        'avg_anomaly_score': round(avg_anomaly_score, 3),
        'is_anomalous': is_dataset_anomalous,
        'threshold_used': anomaly_threshold
    }

def save_session_to_history(session_analysis, model_name, user_id, stop_reason):
    """
    Save completed detection session to history
    """
    global session_history
    import datetime
    
    session_data = {
        'id': f"session_{len(session_history) + 1}_{int(time.time())}",
        'timestamp': datetime.datetime.now().isoformat(),
        'user_id': user_id,
        'model_name': model_name,
        'stop_reason': stop_reason,
        'analysis': session_analysis,
        'chart_data': [
            {
                'voltage': p.get('features', {}).get('voltage_mean', 0),
                'timestamp': i,
                'is_anomaly': p.get('is_anomaly', False),
                'confidence': p.get('confidence', 0),
                'anomaly_score': p.get('score', 0)
            }
            for i, p in enumerate(detection_predictions[-50:])  # Last 50 points for chart
            if p.get('status') == 'ml_ready'
        ]
    }
    
    session_history.append(session_data)
    
    # Keep only last 10 sessions to prevent memory issues
    if len(session_history) > 10:
        session_history = session_history[-10:]
    
    print(f"💾 Saved session to history: {session_data['id']}")
    return session_data['id']

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
        request.user_id = user_id  # Keep as string (UUID)
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
    global serial_thread, serial_connected, data_collection_active
    try:
        print("🔌 Received Arduino connect request")
        
        # Reset data collection state on new connection
        data_collection_active = True
        
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
    global serial_connected, serial_connection, detection_running, data_collection_active
    try:
        print("🔌 Received Arduino disconnect request")
        
        # Stop all data activities immediately
        serial_connected = False
        detection_running = False
        data_collection_active = False
        
        # Close serial connection
        if serial_connection:
            try:
                if serial_connection.is_open:
                    serial_connection.close()
                    print("📴 Serial connection closed")
            except (OSError, AttributeError) as e:
                print(f"Warning: Error closing serial connection during disconnect: {e}")
            finally:
                serial_connection = None
        
        # Cancel any active timers
        global auto_stop_timer
        if auto_stop_timer and auto_stop_timer.is_alive():
            auto_stop_timer.cancel()
            print("⏰ Auto-stop timer cancelled")
        
        # Clear any buffered data
        global detection_predictions
        detection_predictions = []
        
        # Notify frontend immediately
        emit('arduino_status', {
            'type': 'arduino_status',
            'connected': False,
            'message': 'Arduino disconnected - all data collection stopped'
        })
        
        emit('detection_stopped', {
            'type': 'detection_stopped',
            'running': False,
            'message': 'Detection stopped due to Arduino disconnect'
        })
        
        emit('data_collection_status', {
            'type': 'data_collection_status',
            'active': False,
            'message': 'Data collection stopped due to Arduino disconnect'
        })
        
        print("✅ Arduino fully disconnected and all activities stopped")
        
    except Exception as e:
        print(f"Error in arduino_disconnect handler: {e}")

@socketio.on('start_detection')
def handle_start_detection(data=None):
    global detection_running, current_detector, auto_stop_timer
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
            if not current_user_id:
                emit('detection_status', {
                    'type': 'detection_status', 
                    'running': False,
                    'error': 'No user logged in. Please login first.'
                })
                return
            
            db = next(get_db())
            try:
                model = ModelService.get_model_by_id(db, current_model_id)
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
                
                # Reset session tracking
                global detection_predictions, detection_window_complete
                detection_predictions = []
                detection_window_complete = False
                
                # Start auto-stop timer (30 seconds default)
                import threading
                def auto_stop_detection():
                    global detection_running
                    if detection_running:
                        detection_running = False
                        
                        # Analyze the complete session before stopping
                        session_analysis = analyze_detection_session()
                        
                        # Save to history
                        if session_analysis['total_predictions'] > 0:
                            model_name = "Unknown Model"
                            if current_model_id:
                                db = next(get_db())
                                try:
                                    model = ModelService.get_model_by_id(db, current_model_id)
                                    if model:
                                        model_name = model.name
                                finally:
                                    db.close()
                            
                            session_id = save_session_to_history(
                                session_analysis, model_name, current_user_id, 'timeout'
                            )
                        
                        socketio.emit('detection_auto_stopped', {
                            'type': 'detection_auto_stopped',
                            'reason': 'timeout',
                            'message': 'Detection completed: 30 second analysis finished',
                            'final_analysis': session_analysis
                        })
                        print("⏰ Detection auto-stopped after 30 seconds")
                        print(f"📊 Final Decision: {session_analysis['summary']}")
                
                auto_stop_timer = threading.Timer(30.0, auto_stop_detection)
                auto_stop_timer.start()
                
                emit('detection_started', {
                    'type': 'detection_started', 
                    'running': True,
                    'message': 'ML detection started successfully (30s timeout)',
                    'model_name': model.name,
                    'user_id': current_user_id,
                    'auto_stop_seconds': 30
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

@socketio.on('pause_data_collection')
def handle_pause_data_collection(data=None):
    global data_collection_active
    try:
        data_collection_active = False
        emit('data_collection_status', {
            'type': 'data_collection_status',
            'active': False,
            'message': 'Data collection paused'
        })
        print("📴 Data collection paused")
    except Exception as e:
        print(f"Error pausing data collection: {e}")

@socketio.on('resume_data_collection')
def handle_resume_data_collection(data=None):
    global data_collection_active
    try:
        data_collection_active = True
        emit('data_collection_status', {
            'type': 'data_collection_status',
            'active': True,
            'message': 'Data collection resumed'
        })
        print("▶️ Data collection resumed")
    except Exception as e:
        print(f"Error resuming data collection: {e}")

@socketio.on('stop_detection')
def handle_stop_detection(data=None):
    global detection_running, current_detector
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
            
            # Analyze session if we have data
            session_analysis = analyze_detection_session()
            
            # Save to history if we have data
            if session_analysis['total_predictions'] > 0:
                model_name = "Unknown Model"
                if current_model_id:
                    db = next(get_db())
                    try:
                        model = ModelService.get_model_by_id(db, current_model_id)
                        if model:
                            model_name = model.name
                    finally:
                        db.close()
                
                session_id = save_session_to_history(
                    session_analysis, model_name, current_user_id, 'manual_stop'
                )
            
            # Cancel auto-stop timer if active
            global auto_stop_timer
            if auto_stop_timer and auto_stop_timer.is_alive():
                auto_stop_timer.cancel()
                print("⏸️ Auto-stop timer cancelled")
            
            # Clear detector and session data
            current_detector = None
            global detection_predictions
            detection_predictions = []
            
            emit('detection_stopped', {
                'type': 'detection_stopped', 
                'running': False,
                'message': 'ML detection stopped manually',
                'final_analysis': session_analysis if session_analysis['total_predictions'] > 0 else None
            })
            
            if session_analysis['total_predictions'] > 0:
                print(f"📊 Manual Stop - Final Decision: {session_analysis['summary']}")
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

# WebSocket Authentication and Model Management
@socketio.on('ws_login')
def handle_ws_login(data):
    try:
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            emit('login_error', {
                'type': 'login_error',
                'error': 'Missing username or password'
            })
            return
        
        db = next(get_db())
        try:
            user = UserService.authenticate_user(db, username, password)
            if not user:
                emit('login_error', {
                    'type': 'login_error',
                    'error': 'Invalid credentials'
                })
                return
            
            # Update global state
            global current_user_id, current_detector, current_model_id
            current_user_id = user.id
            
            # Get user's models
            models = ModelService.get_user_models(db, user.id)
            
            # Auto-load user's active model on login
            try:
                active_model = next((model for model in models if model.is_active), None)
                if not active_model and models:
                    # If no active model, use the first available model
                    active_model = models[0]
                    ModelService.set_active_model(db, user.id, active_model.id)
                
                if active_model:
                    current_model_id = active_model.id
                    # Note: Only set model ID, don't auto-load detector
                    # Model will be loaded when detection actually starts
                    print(f"📋 Selected model on login: {active_model.name} (will load when detection starts)")
            except Exception as e:
                print(f"Warning: Could not auto-load model on login: {e}")
            
            emit('login_success', {
                'type': 'login_success',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email
                },
                'models': [{
                    'id': model.id,
                    'name': model.name,
                    'file_path': model.file_path,
                    'framework': model.framework,
                    'is_active': model.is_active
                } for model in models],
                'message': 'Login successful'
            })
        finally:
            db.close()
    except Exception as e:
        print(f"WebSocket login error: {e}")
        emit('login_error', {
            'type': 'login_error',
            'error': 'Login failed'
        })

@socketio.on('ws_select_model')
def handle_ws_select_model(data):
    try:
        if not current_user_id:
            emit('model_error', {
                'type': 'model_error',
                'error': 'Please login first'
            })
            return
        
        model_id = data.get('model_id')
        if not model_id:
            emit('model_error', {
                'type': 'model_error',
                'error': 'Missing model_id'
            })
            return
        
        db = next(get_db())
        try:
            model = ModelService.set_active_model(db, current_user_id, model_id)
            if not model:
                emit('model_error', {
                    'type': 'model_error',
                    'error': 'Model not found or not owned by user'
                })
                return
            
            # Update global state
            global current_model_id, current_detector
            current_model_id = model_id
            
            # Load the selected model immediately
            try:
                current_detector = AnomalyDetector()
                current_detector.load_model(model.file_path)
                print(f"Loaded model: {model.name} from {model.file_path}")
            except Exception as e:
                print(f"Error loading model {model.name}: {e}")
                current_detector = AnomalyDetector()  # Fallback to rule-based
            
            emit('model_selected', {
                'type': 'model_selected',
                'model': {
                    'id': model.id,
                    'name': model.name,
                    'file_path': model.file_path,
                    'framework': model.framework
                },
                'message': 'Model selected successfully'
            })
        finally:
            db.close()
    except Exception as e:
        print(f"WebSocket select model error: {e}")
        emit('model_error', {
            'type': 'model_error',
            'error': 'Failed to select model'
        })

@socketio.on('ws_get_models')
def handle_ws_get_models(data=None):
    try:
        if not current_user_id:
            emit('models_error', {
                'type': 'models_error',
                'error': 'Please login first'
            })
            return
        
        db = next(get_db())
        try:
            models = ModelService.get_user_models(db, current_user_id)
            emit('models_response', {
                'type': 'models_response',
                'models': [{
                    'id': model.id,
                    'name': model.name,
                    'file_path': model.file_path,
                    'framework': model.framework,
                    'is_active': model.is_active,
                    'is_preset': model.is_preset,
                    'user_id': model.user_id
                } for model in models]
            })
        finally:
            db.close()
    except Exception as e:
        print(f"WebSocket get models error: {e}")
        emit('models_error', {
            'type': 'models_error',
            'error': 'Failed to get models'
        })

@socketio.on('get_session_history')
def handle_get_session_history(data=None):
    try:
        if not current_user_id:
            emit('history_error', {
                'type': 'history_error',
                'error': 'Please login first'
            })
            return
        
        # Filter sessions for current user
        user_sessions = [
            session for session in session_history 
            if session['user_id'] == current_user_id
        ]
        
        emit('history_response', {
            'type': 'history_response',
            'sessions': user_sessions
        })
        
    except Exception as e:
        print(f"Error getting session history: {e}")
        emit('history_error', {
            'type': 'history_error',
            'error': 'Failed to get session history'
        })

def arduino_connection_loop():
    global serial_connected, detection_running, current_detector, serial_connection
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

        while serial_connected and serial_connection and serial_connection.is_open and data_collection_active:
            try:
                # Double-check connection status before processing
                if not serial_connected or not data_collection_active:
                    print("🛑 Data collection stopped - exiting Arduino loop")
                    break
                    
                if serial_connection.in_waiting > 0:
                    line = serial_connection.readline().decode('utf-8').strip()
                    if line:
                        try:
                            voltage = float(line)
                            timestamp = time.time()
                            
                            # Sample data for performance (only process every Nth point for ML)
                            global sample_counter
                            sample_counter += 1
                            should_process_ml = (sample_counter % SAMPLE_EVERY_N == 0)
                            
                            # Always process data through DataProcessor for feature extraction
                            features = processor.process_voltage(voltage, timestamp)
                            
                            # Emit raw data with basic features
                            socketio.emit('arduino_raw_data', {
                                'type': 'arduino_raw_data', 
                                'voltage': voltage,
                                'timestamp': timestamp,
                                'features': {
                                    'voltage_mean': features.get('voltage_mean', voltage),
                                    'voltage_std': features.get('voltage_std', 0),
                                    'sample_count': features.get('sample_count', 1)
                                }
                            })
                            
                            # Process with ML ONLY if detection is running, detector is available, and we should sample this point
                            if detection_running and current_detector and should_process_ml:
                                prediction = current_detector.predict(features)
                                
                                # Store prediction for session analysis (only during detection)
                                global detection_predictions, detection_window_complete
                                if detection_running:
                                    detection_predictions.append(prediction)
                                
                                # Check if rolling window is complete
                                window_ready = prediction.get('status') == 'ml_ready'
                                if window_ready and not detection_window_complete:
                                    detection_window_complete = True
                                    print("📊 Rolling window complete - ML model is now analyzing complete material")
                                
                                # Check if we should auto-stop (after window is complete)
                                if detection_running and detection_window_complete:
                                    # Stop after collecting enough predictions (e.g., 100 predictions after window complete)
                                    window_predictions = [p for p in detection_predictions if p.get('status') == 'ml_ready']
                                    
                                    if len(window_predictions) >= 50:  # 50 full ML predictions
                                        print(f"🏁 Collected enough data ({len(window_predictions)} ML predictions). Providing final analysis...")
                                        
                                        # Analyze the complete session
                                        session_analysis = analyze_detection_session()
                                        
                                        # Save to history
                                        model_name = "Unknown Model"
                                        if current_model_id:
                                            db = next(get_db())
                                            try:
                                                model = ModelService.get_model_by_id(db, current_model_id)
                                                if model:
                                                    model_name = model.name
                                            finally:
                                                db.close()
                                        
                                        session_id = save_session_to_history(
                                            session_analysis, model_name, current_user_id, 'analysis_complete'
                                        )
                                        
                                        detection_running = False
                                        socketio.emit('detection_auto_stopped', {
                                            'type': 'detection_auto_stopped',
                                            'reason': 'analysis_complete',
                                            'prediction': prediction,
                                            'message': f'Analysis Complete: {session_analysis["summary"]}',
                                            'final_analysis': session_analysis
                                        })
                                        
                                        # Cancel timer since we're stopping due to analysis completion
                                        global auto_stop_timer
                                        if auto_stop_timer and auto_stop_timer.is_alive():
                                            auto_stop_timer.cancel()
                                        
                                        print(f"📊 Final Decision: {session_analysis['summary']}")
                                
                                # Log to database if user is logged in AND detection is running
                                if detection_running and current_user_id and current_model_id:
                                    try:
                                        db = next(get_db())
                                        try:
                                            LogService.log_prediction(
                                                db, current_model_id, current_user_id,
                                                {'voltage': voltage, 'timestamp': timestamp, 'features': features},
                                                prediction,
                                                prediction.get('confidence', 0.0)
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
                            else:
                                # No current_detector, just emit raw data processing info
                                # (This is already handled by the raw data emit above)
                                pass
                                
                        except ValueError:
                            print(f"Invalid voltage reading: {line}")
                            
                time.sleep(0.1)  # Reduced frequency - 10Hz instead of 100Hz
                
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
        if serial_connection:
            try:
                if serial_connection.is_open:
                    serial_connection.close()
            except (OSError, AttributeError) as e:
                print(f"Warning: Error closing serial connection: {e}")
            finally:
                serial_connection = None
        socketio.emit('arduino_status', {
            'type': 'arduino_status', 
            'connected': False,
            'message': 'Arduino disconnected'
        })

# Authentication HTTP Routes
@app.route('/auth/register', methods=['POST'])
def register():
    try:
        data = request.json
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not username or not email or not password:
            return jsonify({'error': 'Missing required fields'}), 400

        db = next(get_db())
        try:
            # Check if user already exists
            existing_user = UserService.get_user_by_username(db, username)
            if existing_user:
                return jsonify({'error': 'Username already exists'}), 400
            
            # Create new user
            user = UserService.create_user(db, username, email, password)
            
            # Create access token
            access_token = AuthService.create_access_token({"sub": user.id})

            return jsonify({
                'access_token': access_token,
                'user_id': user.id,
                'username': user.username,
                'message': 'User registered successfully'
            }), 201
        finally:
            db.close()
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({'error': 'Registration failed'}), 500

@app.route('/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': 'Missing username or password'}), 400

        db = next(get_db())
        try:
            user = UserService.authenticate_user(db, username, password)
            if not user:
                return jsonify({'error': 'Invalid credentials'}), 401

            # Create access token
            access_token = AuthService.create_access_token({"sub": user.id})
            
            return jsonify({
                'access_token': access_token,
                'user_id': user.id,
                'username': user.username,
                'message': 'Login successful'
            }), 200
        finally:
            db.close()
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500

@app.route('/auth/me', methods=['GET'])
@require_auth
def get_current_user():
    try:
        db = next(get_db())
        try:
            user = UserService.get_user_by_id(db, request.user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            return jsonify({
                'user_id': user.id,
                'username': user.username,
                'email': user.email,
                'created_at': user.created_at.isoformat(),
                'last_login': user.last_login.isoformat() if user.last_login else None
            }), 200
        finally:
            db.close()
    except Exception as e:
        print(f"Get current user error: {e}")
        return jsonify({'error': 'Failed to get user info'}), 500

# Models API Routes
@app.route('/models', methods=['GET'])
@require_auth
def get_user_models():
    try:
        db = next(get_db())
        try:
            models = ModelService.get_user_models(db, request.user_id)
            return jsonify({
                'models': [{
                    'id': model.id,
                    'name': model.name,
                    'file_path': model.file_path,
                    'framework': model.framework,
                    'created_at': model.created_at.isoformat(),
                    'is_active': model.is_active
                } for model in models]
            }), 200
        finally:
            db.close()
    except Exception as e:
        print(f"Get models error: {e}")
        return jsonify({'error': 'Failed to get models'}), 500

@app.route('/models', methods=['POST'])
@require_auth
def create_model():
    try:
        data = request.json
        name = data.get('name')
        file_path = data.get('file_path')
        framework = data.get('framework', 'tensorflow')
        
        if not name or not file_path:
            return jsonify({'error': 'Missing name or file_path'}), 400

        db = next(get_db())
        try:
            model = ModelService.create_model(db, request.user_id, name, file_path, framework)
            return jsonify({
                'id': model.id,
                'name': model.name,
                'file_path': model.file_path,
                'framework': model.framework,
                'created_at': model.created_at.isoformat(),
                'message': 'Model created successfully'
            }), 201
        finally:
            db.close()
    except Exception as e:
        print(f"Create model error: {e}")
        return jsonify({'error': 'Failed to create model'}), 500

@app.route('/models/<model_id>/activate', methods=['POST'])
@require_auth
def activate_model(model_id):
    try:
        db = next(get_db())
        try:
            model = ModelService.set_active_model(db, request.user_id, model_id)
            if not model:
                return jsonify({'error': 'Model not found or not owned by user'}), 404

            # Update global state for detection
            global current_model_id, current_user_id
            current_model_id = model_id
            current_user_id = request.user_id

            return jsonify({
                'message': 'Model activated successfully',
                'model_id': model.id,
                'model_name': model.name
            }), 200
        finally:
            db.close()
    except Exception as e:
        print(f"Activate model error: {e}")
        return jsonify({'error': 'Failed to activate model'}), 500

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
    print("Starting Anomaly Detection Server")
    print("Server URL: http://localhost:8000")
    print("WebSocket URL: http://localhost:8000")
    print("Users must login to use the system")
    
    socketio.run(app, host='0.0.0.0', port=8000, debug=True)