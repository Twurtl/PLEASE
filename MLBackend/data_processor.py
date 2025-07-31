import numpy as np
from collections import deque
import time


class DataProcessor:
    def __init__(self, window_size=50, sample_rate=10):
        """
        Initialize data processor

        Args:
            window_size: Number of samples to keep in rolling window
            sample_rate: Expected samples per second
        """
        self.window_size = window_size
        self.sample_rate = sample_rate
        self.voltage_buffer = deque(maxlen=window_size)
        self.timestamp_buffer = deque(maxlen=window_size)
        self.last_processed_time = 0

    def process_voltage(self, voltage, timestamp):
        """
        Process incoming voltage data

        Args:
            voltage: Voltage reading from sensor
            timestamp: Timestamp of the reading

        Returns:
            dict: Processed features ready for ML model
        """
        # Add to rolling buffer
        self.voltage_buffer.append(voltage)
        self.timestamp_buffer.append(timestamp)

        # Only process if we have enough data
        if len(self.voltage_buffer) < self.window_size:
            return self._get_default_features()

        # Calculate time-based features
        time_features = self._calculate_time_features()

        # Calculate statistical features
        stat_features = self._calculate_statistical_features()

        # Calculate frequency features (simplified)
        freq_features = self._calculate_frequency_features()

        # Combine all features
        features = {
            'voltage_mean': stat_features['mean'],
            'voltage_std': stat_features['std'],
            'voltage_min': stat_features['min'],
            'voltage_max': stat_features['max'],
            'voltage_range': stat_features['range'],
            'voltage_variance': stat_features['variance'],
            'voltage_skewness': stat_features['skewness'],
            'voltage_kurtosis': stat_features['kurtosis'],
            'time_delta_mean': time_features['delta_mean'],
            'time_delta_std': time_features['delta_std'],
            'frequency_dominant': freq_features['dominant_freq'],
            'frequency_bandwidth': freq_features['bandwidth'],
            'sample_count': len(self.voltage_buffer)
        }

        return features

    def _calculate_statistical_features(self):
        """Calculate statistical features from voltage buffer"""
        voltages = np.array(list(self.voltage_buffer))

        return {
            'mean': np.mean(voltages),
            'std': np.std(voltages),
            'min': np.min(voltages),
            'max': np.max(voltages),
            'range': np.max(voltages) - np.min(voltages),
            'variance': np.var(voltages),
            'skewness': self._calculate_skewness(voltages),
            'kurtosis': self._calculate_kurtosis(voltages)
        }

    def _calculate_time_features(self):
        """Calculate time-based features"""
        timestamps = np.array(list(self.timestamp_buffer))
        deltas = np.diff(timestamps)

        return {
            'delta_mean': np.mean(deltas) if len(deltas) > 0 else 0,
            'delta_std': np.std(deltas) if len(deltas) > 0 else 0
        }

    def _calculate_frequency_features(self):
        """Calculate simplified frequency features"""
        voltages = np.array(list(self.voltage_buffer))

        # Simple peak detection for dominant frequency
        # use FFT later
        peaks = self._find_peaks(voltages)
        dominant_freq = len(peaks) / (len(voltages) /
                                      self.sample_rate) if len(voltages) > 0 else 0

        return {
            'dominant_freq': dominant_freq,
            'bandwidth': np.std(voltages)  # Simplified bandwidth
        }

    def _find_peaks(self, data, threshold=0.1):
        """Simple peak detection"""
        peaks = []
        for i in range(1, len(data) - 1):
            if data[i] > data[i-1] and data[i] > data[i+1]:
                if data[i] > threshold:
                    peaks.append(i)
        return peaks

    def _calculate_skewness(self, data):
        """Calculate skewness"""
        mean = np.mean(data)
        std = np.std(data)
        if std == 0:
            return 0
        return np.mean(((data - mean) / std) ** 3)

    def _calculate_kurtosis(self, data):
        """Calculate kurtosis"""
        mean = np.mean(data)
        std = np.std(data)
        if std == 0:
            return 0
        return np.mean(((data - mean) / std) ** 4) - 3

    def _get_default_features(self):
        """Return default features when not enough data"""
        return {
            'voltage_mean': 0.0,
            'voltage_std': 0.0,
            'voltage_min': 0.0,
            'voltage_max': 0.0,
            'voltage_range': 0.0,
            'voltage_variance': 0.0,
            'voltage_skewness': 0.0,
            'voltage_kurtosis': 0.0,
            'time_delta_mean': 0.0,
            'time_delta_std': 0.0,
            'frequency_dominant': 0.0,
            'frequency_bandwidth': 0.0,
            'sample_count': len(self.voltage_buffer)
        }

    def get_raw_data(self):
        """Get raw voltage data for debugging"""
        return {
            'voltages': list(self.voltage_buffer),
            'timestamps': list(self.timestamp_buffer)
        }
