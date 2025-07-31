import numpy as np
import json
import os
from typing import Dict, Any

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
        self.confidence_threshold = self.config.get('confidence_threshold', 0.7)
        
        # Load model if available
        if model_path and os.path.exists(model_path):
            self._load_model(model_path)
        else:
            print("No trained model found. Using rule-based anomaly detection.")
    
    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict anomaly from processed features
        
        Args:
            features: Dictionary of processed features
            
        Returns:
            dict: Prediction results with score, anomaly flag, and confidence
        """
        if self.model:
            return self._predict_with_model(features)
        else:
            return self._predict_with_rules(features)
    
    def _predict_with_rules(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Rule-based anomaly detection (fallback when no ML model is available)
        """
        # Extract key features
        voltage_std = features.get('voltage_std', 0)
        voltage_range = features.get('voltage_range', 0)
        voltage_skewness = abs(features.get('voltage_skewness', 0))
        voltage_kurtosis = features.get('voltage_kurtosis', 0)
        
        # Simple rule-based scoring
        score = 0.0
        
        # High variance indicates potential anomaly
        if voltage_std > 0.5:
            score += 0.3
        
        # Large range indicates potential anomaly
        if voltage_range > 2.0:
            score += 0.2
        
        # High skewness indicates unusual distribution
        if voltage_skewness > 1.0:
            score += 0.2
        
        # High kurtosis indicates sharp peaks
        if voltage_kurtosis > 3.0:
            score += 0.2
        
        # Normalize score to 0-1 range
        score = min(score, 1.0)
        
        # Determine if anomaly
        is_anomaly = score > self.threshold
        
        # Calculate confidence based on feature quality
        confidence = min(0.8, 0.5 + (voltage_std * 0.3))
        
        return {
            'score': score,
            'is_anomaly': is_anomaly,
            'confidence': confidence,
            'method': 'rule_based'
        }
    
    def _predict_with_model(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        ML model-based prediction (placeholder for LSTM model)
        """
        # Convert features to model input format
        # This would be implemented when you have a trained LSTM model
        
        # Placeholder implementation
        score = 0.5  # Placeholder
        is_anomaly = score > self.threshold
        confidence = 0.8  # Placeholder
        
        return {
            'score': score,
            'is_anomaly': is_anomaly,
            'confidence': confidence,
            'method': 'ml_model'
        }
    
    def _load_model(self, model_path: str):
        """
        Load trained LSTM model
        
        Args:
            model_path: Path to the model file
        """
        try:
            # This would load your trained TensorFlow/Keras model
            # from tensorflow import keras
            # self.model = keras.models.load_model(model_path)
            print(f"Model loaded from {model_path}")
        except Exception as e:
            print(f"Error loading model: {e}")
            self.model = None
    
    def _load_config(self, config_path: str = None) -> Dict[str, Any]:
        """
        Load model configuration
        
        Args:
            config_path: Path to config file
            
        Returns:
            dict: Configuration parameters
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
        Update anomaly detection threshold
        
        Args:
            new_threshold: New threshold value (0-1)
        """
        self.threshold = max(0.0, min(1.0, new_threshold))
        print(f"Anomaly threshold updated to: {self.threshold}")
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the current model
        
        Returns:
            dict: Model information
        """
        return {
            'model_type': 'lstm' if self.model else 'rule_based',
            'threshold': self.threshold,
            'confidence_threshold': self.confidence_threshold,
            'config': self.config
        } 