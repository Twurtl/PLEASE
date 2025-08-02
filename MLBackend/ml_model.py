# ml_model.py
import numpy as np
import json
import os
from typing import Dict, Any
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.models import load_model


class AnomalyDetector:
    def __init__(self, model_path=None, config_path=None):
        """
        Initialize anomaly detector

        Args:
            model_path: Path to trained LSTM model (optional)
            config_path: Path to model configuration (optional)
        """
        self.model = None
        self.config = self._load_config(config_path)
        self.threshold = self.config.get('anomaly_threshold', 0.5)
        self.confidence_threshold = self.config.get(
            'confidence_threshold', 0.7)
        
        # Rolling window for LSTM prediction
        self.feature_window = []
        self.window_size = self.config.get('window_size', 50)

        # Load model if available
        if model_path and os.path.exists(model_path):
            self._load_model(model_path)
        else:
            print("No trained model found. Using rule-based anomaly detection.")

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict anomaly from processed features
        Returns detailed status for frontend real-time updates
        """
        if self.model:
            return self._predict_with_model(features)
        else:
            return self._predict_with_rules(features)

    def _predict_with_rules(self, features: Dict[str, Any]) -> Dict[str, Any]:
        voltage_std = features.get('voltage_std', 0)
        voltage_range = features.get('voltage_range', 0)
        voltage_skewness = abs(features.get('voltage_skewness', 0))
        voltage_kurtosis = features.get('voltage_kurtosis', 0)

        score = 0.0
        if voltage_std > 0.5:
            score += 0.3
        if voltage_range > 2.0:
            score += 0.2
        if voltage_skewness > 1.0:
            score += 0.2
        if voltage_kurtosis > 3.0:
            score += 0.2

        score = min(score, 1.0)
        is_anomaly = score > self.threshold
        confidence = min(0.8, 0.5 + (voltage_std * 0.3))

        return {
            'score': score,
            'is_anomaly': is_anomaly,
            'confidence': confidence,
            'method': 'rule_based'
        }

    def _predict_with_model(self, features: Dict[str, Any]) -> Dict[str, Any]:
        try:
            # Add features to rolling window
            feature_vector = [features[f] for f in self.config['feature_names']]
            self.feature_window.append(feature_vector)
            
            # Keep only the last window_size features
            if len(self.feature_window) > self.window_size:
                self.feature_window = self.feature_window[-self.window_size:]
            
            # Calculate window status for frontend
            window_progress = min(len(self.feature_window) / self.window_size, 1.0)
            
            # Only predict if we have enough data
            if len(self.feature_window) == self.window_size:
                # Reshape to (1, window_size, features) for LSTM
                feature_array = np.array(self.feature_window)
                feature_array = np.reshape(feature_array, (1, self.window_size, -1))
                
                prediction = self.model.predict(feature_array, verbose=0)[0][0]
                is_anomaly = prediction > self.threshold

                return {
                    'score': float(prediction),
                    'is_anomaly': bool(is_anomaly),
                    'confidence': float(prediction),
                    'method': 'ml_model',
                    'window_progress': window_progress,
                    'window_size': self.window_size,
                    'current_window': len(self.feature_window),
                    'status': 'ml_ready'
                }
            else:
                # Not enough data yet, use rule-based but show progress
                rule_prediction = self._predict_with_rules(features)
                rule_prediction.update({
                    'window_progress': window_progress,
                    'window_size': self.window_size,
                    'current_window': len(self.feature_window),
                    'status': 'warming_up'
                })
                return rule_prediction
                
        except Exception as e:
            print(f"Model prediction failed: {e}")
            rule_prediction = self._predict_with_rules(features)
            rule_prediction.update({
                'window_progress': 0.0,
                'window_size': self.window_size,
                'current_window': len(self.feature_window),
                'status': 'error'
            })
            return rule_prediction

    def train_model(self, X_train, y_train, model_save_path="backend/models/lstm_model.h5"):
        """
        Train an LSTM model and save it to disk
        """
        model = Sequential([
            LSTM(64, input_shape=(X_train.shape[1], X_train.shape[2])),
            Dense(1, activation='sigmoid')
        ])
        model.compile(optimizer=Adam(0.001),
                      loss='binary_crossentropy', metrics=['accuracy'])

        model.fit(
            X_train, y_train,
            epochs=20,
            batch_size=32,
            validation_split=0.2,
            callbacks=[EarlyStopping(patience=3)],
            verbose=1
        )

        model.save(model_save_path)
        self.model = model
        print(f"Model trained and saved to {model_save_path}")

    def _load_model(self, model_path: str):
        """
        Load a pre-trained LSTM model
        """
        try:
            self.model = load_model(model_path)
            print(f"Model loaded from {model_path}")
        except Exception as e:
            print(f"Error loading model: {e}")
            self.model = None

    def _load_config(self, config_path: str = None) -> Dict[str, Any]:
        """
        Load model configuration or use defaults
        """
        default_config = {
            'anomaly_threshold': 0.5,
            'confidence_threshold': 0.7,
            'window_size': 50,
            'sample_rate': 10,
            'feature_names': [
                'voltage_mean', 'voltage_std', 'voltage_min', 'voltage_max',
                'voltage_range', 'voltage_variance', 'voltage_skewness',
                'voltage_kurtosis', 'time_delta_mean', 'time_delta_std',
                'frequency_dominant', 'frequency_bandwidth'
            ]
        }

        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                return {**default_config, **config}
            except Exception as e:
                print(f"Error loading config: {e}")

        return default_config

    def update_threshold(self, new_threshold: float):
        """
        Update anomaly score threshold
        """
        self.threshold = max(0.0, min(1.0, new_threshold))
        print(f"Anomaly threshold updated to: {self.threshold}")

    def get_model_info(self) -> Dict[str, Any]:
        """
        Return info about the loaded model
        """
        return {
            'model_type': 'lstm' if self.model else 'rule_based',
            'threshold': self.threshold,
            'confidence_threshold': self.confidence_threshold,
            'config': self.config
        }
