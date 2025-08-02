# data_processor.py
import numpy as np
from collections import deque
from typing import Dict, Any, List
import time
import statistics

class DataProcessor:
    def __init__(self, window_size: int = 50):
        self.window_size = window_size
        self.voltage_buffer = deque(maxlen=window_size)
        self.timestamp_buffer = deque(maxlen=window_size)
        self.sample_count = 0
        self.start_time = None
        
    def process_voltage(self, voltage: float, timestamp: float) -> Dict[str, Any]:
        """Process incoming voltage reading and return feature dictionary"""
        
        # Initialize start time on first sample
        if self.start_time is None:
            self.start_time = timestamp
        
        # Add to buffers
        self.voltage_buffer.append(voltage)
        self.timestamp_buffer.append(timestamp)
        self.sample_count += 1
        
        # Convert buffers to lists for easier processing
        voltage_list = list(self.voltage_buffer)
        timestamp_list = list(self.timestamp_buffer)
        
        # Calculate basic statistics
        features = self._calculate_statistical_features(voltage_list)
        
        # Add temporal features
        features.update(self._calculate_temporal_features(timestamp_list))
        
        # Add buffer information
        features.update({
            'sample_count': self.sample_count,
            'buffer_size': len(self.voltage_buffer),
            'window_full': len(self.voltage_buffer) >= self.window_size,
            'current_voltage': voltage,
            'current_timestamp': timestamp
        })
        
        return features
    
    def _calculate_statistical_features(self, voltage_list: List[float]) -> Dict[str, Any]:
        """Calculate statistical features from voltage readings"""
        
        if not voltage_list:
            return self._get_empty_statistical_features()
        
        try:
            voltage_array = np.array(voltage_list)
            
            # Basic statistics
            voltage_mean = float(np.mean(voltage_array))
            voltage_std = float(np.std(voltage_array))
            voltage_min = float(np.min(voltage_array))
            voltage_max = float(np.max(voltage_array))
            voltage_range = voltage_max - voltage_min
            
            # Robust statistics
            voltage_median = float(np.median(voltage_array))
            voltage_q25 = float(np.percentile(voltage_array, 25))
            voltage_q75 = float(np.percentile(voltage_array, 75))
            voltage_iqr = voltage_q75 - voltage_q25
            
            # Advanced statistics
            voltage_skewness = float(self._calculate_skewness(voltage_array))
            voltage_kurtosis = float(self._calculate_kurtosis(voltage_array))
            
            # Coefficient of variation
            voltage_cv = voltage_std / voltage_mean if voltage_mean != 0 else 0.0
            
            # Zero crossing rate (useful for AC signals)
            zero_crossings = self._calculate_zero_crossings(voltage_array)
            
            # Peak detection
            peaks_count = self._count_peaks(voltage_array)
            
            return {
                'voltage_mean': voltage_mean,
                'voltage_std': voltage_std,
                'voltage_min': voltage_min,
                'voltage_max': voltage_max,
                'voltage_range': voltage_range,
                'voltage_median': voltage_median,
                'voltage_q25': voltage_q25,
                'voltage_q75': voltage_q75,
                'voltage_iqr': voltage_iqr,
                'voltage_skewness': voltage_skewness,
                'voltage_kurtosis': voltage_kurtosis,
                'voltage_cv': voltage_cv,
                'zero_crossings': zero_crossings,
                'peaks_count': peaks_count
            }
            
        except Exception as e:
            print(f"Error calculating statistical features: {e}")
            return self._get_empty_statistical_features()
    
    def _calculate_temporal_features(self, timestamp_list: List[float]) -> Dict[str, Any]:
        """Calculate temporal features from timestamps"""
        
        if len(timestamp_list) < 2:
            return {
                'time_span': 0.0,
                'sampling_rate': 0.0,
                'time_since_start': timestamp_list[0] - self.start_time if timestamp_list and self.start_time else 0.0
            }
        
        try:
            # Time span of current window
            time_span = timestamp_list[-1] - timestamp_list[0]
            
            # Estimate sampling rate
            time_diffs = np.diff(timestamp_list)
            avg_time_diff = np.mean(time_diffs)
            sampling_rate = 1.0 / avg_time_diff if avg_time_diff > 0 else 0.0
            
            # Time since start
            time_since_start = timestamp_list[-1] - self.start_time
            
            return {
                'time_span': float(time_span),
                'sampling_rate': float(sampling_rate),
                'time_since_start': float(time_since_start),
                'avg_time_interval': float(avg_time_diff)
            }
            
        except Exception as e:
            print(f"Error calculating temporal features: {e}")
            return {
                'time_span': 0.0,
                'sampling_rate': 0.0,
                'time_since_start': 0.0,
                'avg_time_interval': 0.0
            }
    
    def _get_empty_statistical_features(self) -> Dict[str, Any]:
        """Return empty statistical features dictionary"""
        return {
            'voltage_mean': 0.0,
            'voltage_std': 0.0,
            'voltage_min': 0.0,
            'voltage_max': 0.0,
            'voltage_range': 0.0,
            'voltage_median': 0.0,
            'voltage_q25': 0.0,
            'voltage_q75': 0.0,
            'voltage_iqr': 0.0,
            'voltage_skewness': 0.0,
            'voltage_kurtosis': 0.0,
            'voltage_cv': 0.0,
            'zero_crossings': 0,
            'peaks_count': 0
        }
    
    def _calculate_skewness(self, data: np.ndarray) -> float:
        """Calculate skewness of the data"""
        try:
            if len(data) < 3:
                return 0.0
            mean = np.mean(data)
            std = np.std(data)
            if std == 0:
                return 0.0
            return np.mean(((data - mean) / std) ** 3)
        except:
            return 0.0
    
    def _calculate_kurtosis(self, data: np.ndarray) -> float:
        """Calculate kurtosis of the data"""
        try:
            if len(data) < 4:
                return 0.0
            mean = np.mean(data)
            std = np.std(data)
            if std == 0:
                return 0.0
            return np.mean(((data - mean) / std) ** 4) - 3  # Excess kurtosis
        except:
            return 0.0
    
    def _calculate_zero_crossings(self, data: np.ndarray) -> int:
        """Count zero crossings in the signal"""
        try:
            if len(data) < 2:
                return 0
            # Remove DC offset
            data_centered = data - np.mean(data)
            # Count sign changes
            zero_crossings = np.sum(np.diff(np.sign(data_centered)) != 0)
            return int(zero_crossings)
        except:
            return 0
    
    def _count_peaks(self, data: np.ndarray, min_height: float = None) -> int:
        """Count peaks in the signal"""
        try:
            if len(data) < 3:
                return 0
            
            # Simple peak detection: a point is a peak if it's higher than both neighbors
            peaks = 0
            for i in range(1, len(data) - 1):
                if data[i] > data[i-1] and data[i] > data[i+1]:
                    if min_height is None or data[i] > min_height:
                        peaks += 1
            
            return peaks
        except:
            return 0
    
    def reset(self):
        """Reset the processor state"""
        self.voltage_buffer.clear()
        self.timestamp_buffer.clear()
        self.sample_count = 0
        self.start_time = None
        print("🔄 Data processor reset")
    
    def get_current_window(self) -> Dict[str, Any]:
        """Get current window data"""
        return {
            'voltages': list(self.voltage_buffer),
            'timestamps': list(self.timestamp_buffer),
            'window_size': self.window_size,
            'current_size': len(self.voltage_buffer),
            'sample_count': self.sample_count,
            'is_full': len(self.voltage_buffer) >= self.window_size
        }
    
    def update_window_size(self, new_size: int):
        """Update the window size"""
        if new_size > 0:
            self.window_size = new_size
            # Recreate buffers with new size
            voltage_data = list(self.voltage_buffer)
            timestamp_data = list(self.timestamp_buffer)
            
            self.voltage_buffer = deque(voltage_data, maxlen=new_size)
            self.timestamp_buffer = deque(timestamp_data, maxlen=new_size)
            
            print(f"🔄 Window size updated to: {new_size}")
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get current processor statistics"""
        return {
            'total_samples': self.sample_count,
            'window_size': self.window_size,
            'buffer_utilization': len(self.voltage_buffer) / self.window_size,
            'is_window_full': len(self.voltage_buffer) >= self.window_size,
            'processing_time': time.time() - self.start_time if self.start_time else 0.0
        }