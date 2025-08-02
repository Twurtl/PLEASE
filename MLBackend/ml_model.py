# ml_model.py
import json
import numpy as np
import os
from typing import Dict, Any, Optional
import pickle
import joblib

class AnomalyDetector:
    def __init__(self, config_path: Optional[str] = None):
        self.model = None
        self.threshold = 0.5
        self.model_type = None
        self.scaler = None
        self.is_loaded = False
        self.window_size = 50
        self.current_window = 0
        self.window_progress = 0.0
        
        if config_path and os.path.exists(config_path):
            self.load_config(config_path)
    
    def load_config(self, config_path: str):
        """Load configuration from JSON file"""
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                self.threshold = config.get('threshold', 0.5)
                self.window_size = config.get('window_size', 50)
                print(f"✅ Configuration loaded from {config_path}")
        except Exception as e:
            print(f"⚠️ Could not load config from {config_path}: {e}")
    
    def load_model(self, model_path: str):
        """Load ML model from file"""
        try:
            if not os.path.exists(model_path):
                print(f"⚠️ Model file not found: {model_path}")
                print("🔄 Using rule-based detection as fallback")
                self.model = None
                self.model_type = 'rule_based'
                self.is_loaded = True
                return
            
            # Determine model type based on file extension
            file_ext = os.path.splitext(model_path)[1].lower()
            
            if file_ext == '.pkl':
                # Scikit-learn model
                self.model = joblib.load(model_path)
                self.model_type = 'sklearn'
            elif file_ext == '.h5':
                # TensorFlow/Keras model
                try:
                    import tensorflow as tf
                    self.model = tf.keras.models.load_model(model_path)
                    self.model_type = 'tensorflow'
                except ImportError:
                    print("⚠️ TensorFlow not available, using rule-based detection")
                    self.model = None
                    self.model_type = 'rule_based'
            elif file_ext == '.pt' or file_ext == '.pth':
                # PyTorch model
                try:
                    import torch
                    self.model = torch.load(model_path, map_location='cpu')
                    self.model_type = 'pytorch'
                except ImportError:
                    print("⚠️ PyTorch not available, using rule-based detection")
                    self.model = None
                    self.model_type = 'rule_based'
            else:
                print(f"⚠️ Unsupported model format: {file_ext}")
                self.model = None
                self.model_type = 'rule_based'
            
            # Try to load associated scaler if it exists
            scaler_path = model_path.replace(file_ext, '_scaler.pkl')
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
                print(f"✅ Scaler loaded from {scaler_path}")
            
            self.is_loaded = True
            print(f"✅ Model loaded successfully: {model_path} (Type: {self.model_type})")
            
        except Exception as e:
            print(f"❌ Error loading model from {model_path}: {e}")
            print("🔄 Falling back to rule-based detection")
            self.model = None
            self.model_type = 'rule_based'
            self.is_loaded = True
    
    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Make anomaly prediction based on features"""
        try:
            # Update window progress
            sample_count = features.get('sample_count', 0)
            self.current_window = sample_count
            self.window_progress = min(sample_count / self.window_size, 1.0)
            
            # Base prediction structure
            prediction = {
                'anomaly_score': 0.0,
                'is_anomaly': False,
                'confidence': 0.0,
                'method': self.model_type or 'rule_based',
                'status': 'ml_ready' if self.is_loaded else 'warming_up',
                'window_progress': self.window_progress,
                'window_size': self.window_size,
                'current_window': self.current_window
            }
            
            # Check if we have enough samples
            if sample_count < self.window_size:
                prediction['status'] = 'warming_up'
                prediction['anomaly_score'] = 0.0
                prediction['is_anomaly'] = False
                prediction['confidence'] = 0.0
                return prediction
            
            # Extract features for prediction
            if self.model and self.model_type != 'rule_based':
                prediction.update(self._ml_predict(features))
            else:
                prediction.update(self._rule_based_predict(features))
            
            prediction['status'] = 'ml_ready'
            return prediction
            
        except Exception as e:
            print(f"❌ Prediction error: {e}")
            return {
                'anomaly_score': 0.0,
                'is_anomaly': False,
                'confidence': 0.0,
                'method': 'error',
                'status': 'error',
                'window_progress': self.window_progress,
                'window_size': self.window_size,
                'current_window': self.current_window,
                'error': str(e)
            }
    
    def _ml_predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Make prediction using loaded ML model"""
        try:
            # Prepare feature vector
            feature_vector = self._prepare_features(features)
            
            if self.scaler:
                feature_vector = self.scaler.transform([feature_vector])
            else:
                feature_vector = np.array([feature_vector])
            
            if self.model_type == 'sklearn':
                # Scikit-learn model
                anomaly_score = self.model.decision_function(feature_vector)[0]
                # Normalize score to 0-1 range
                anomaly_score = max(0, min(1, (anomaly_score + 1) / 2))
                
            elif self.model_type == 'tensorflow':
                # TensorFlow/Keras model
                prediction = self.model.predict(feature_vector, verbose=0)
                anomaly_score = float(prediction[0][0])
                
            elif self.model_type == 'pytorch':
                # PyTorch model
                import torch
                with torch.no_grad():
                    tensor_input = torch.FloatTensor(feature_vector)
                    prediction = self.model(tensor_input)
                    anomaly_score = float(prediction.numpy()[0])
            else:
                # Fallback to rule-based
                return self._rule_based_predict(features)
            
            is_anomaly = anomaly_score > self.threshold
            confidence = abs(anomaly_score - self.threshold) / (1 - self.threshold) if is_anomaly else abs(anomaly_score - self.threshold) / self.threshold
            confidence = min(1.0, confidence)
            
            return {
                'anomaly_score': float(anomaly_score),
                'is_anomaly': is_anomaly,
                'confidence': float(confidence),
                'method': f'ml_model_{self.model_type}'
            }
            
        except Exception as e:
            print(f"❌ ML prediction error: {e}")
            return self._rule_based_predict(features)
    
    def _rule_based_predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback rule-based anomaly detection"""
        try:
            # Simple rule-based detection using statistical measures
            voltage_std = features.get('voltage_std', 0.0)
            voltage_mean = features.get('voltage_mean', 0.0)
            voltage_max = features.get('voltage_max', 0.0)
            voltage_min = features.get('voltage_min', 0.0)
            
            # Calculate coefficient of variation
            cv = voltage_std / voltage_mean if voltage_mean != 0 else 0
            
            # Calculate range ratio
            voltage_range = voltage_max - voltage_min
            range_ratio = voltage_range / voltage_mean if voltage_mean != 0 else 0
            
            # Simple heuristic: high variability suggests anomaly
            variability_score = min(1.0, (cv * 2 + range_ratio) / 2)
            
            # Threshold-based decision
            is_anomaly = variability_score > self.threshold
            confidence = abs(variability_score - self.threshold) / (1 - self.threshold) if is_anomaly else abs(variability_score - self.threshold) / self.threshold
            confidence = min(1.0, confidence)
            
            return {
                'anomaly_score': float(variability_score),
                'is_anomaly': is_anomaly,
                'confidence': float(confidence),
                'method': 'rule_based'
            }
            
        except Exception as e:
            print(f"❌ Rule-based prediction error: {e}")
            return {
                'anomaly_score': 0.0,
                'is_anomaly': False,
                'confidence': 0.0,
                'method': 'error'
            }
    
    def _prepare_features(self, features: Dict[str, Any]) -> list:
        """Prepare feature vector for ML model"""
        # Extract numerical features in a consistent order
        feature_vector = [
            features.get('voltage_mean', 0.0),
            features.get('voltage_std', 0.0),
            features.get('voltage_min', 0.0),
            features.get('voltage_max', 0.0),
            features.get('voltage_range', 0.0),
            features.get('voltage_median', 0.0),
            features.get('voltage_q25', 0.0),
            features.get('voltage_q75', 0.0),
            features.get('sample_count', 0.0),
            features.get('time_span', 0.0)
        ]
        return feature_vector
    
    def update_threshold(self, new_threshold: float):
        """Update anomaly detection threshold"""
        self.threshold = max(0.0, min(1.0, new_threshold))
        print(f"🔄 Threshold updated to: {self.threshold}")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model"""
        return {
            'is_loaded': self.is_loaded,
            'model_type': self.model_type,
            'threshold': self.threshold,
            'window_size': self.window_size,
            'has_scaler': self.scaler is not None,
            'current_window': self.current_window,
            'window_progress': self.window_progress
        }