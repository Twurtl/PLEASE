#!/usr/bin/env python3
"""
Arduino Voltage Simulator
Generates realistic voltage readings for different materials to create training data.
"""

import time
import random
import math
import json
import os
from datetime import datetime
from typing import List, Dict, Tuple

class ArduinoSimulator:
    def __init__(self):
        # Base voltage ranges for different materials (in volts)
        self.material_voltages = {
            'concrete': {
                'base': 2.5,
                'variance': 0.3,
                'noise': 0.05,
                'frequency': 0.1  # Hz
            },
            'wood': {
                'base': 1.8,
                'variance': 0.2,
                'noise': 0.03,
                'frequency': 0.15
            },
            'metal': {
                'base': 3.2,
                'variance': 0.4,
                'noise': 0.08,
                'frequency': 0.08
            },
            'universal': {
                'base': 2.0,
                'variance': 0.25,
                'noise': 0.04,
                'frequency': 0.12
            }
        }
        
        self.sample_rate = 100  # Hz
        self.start_time = time.time()
    
    def generate_normal_voltage(self, material: str, timestamp: float = None) -> float:
        """Generate normal (non-anomalous) voltage reading for a material"""
        if timestamp is None:
            timestamp = time.time() - self.start_time
            
        config = self.material_voltages.get(material, self.material_voltages['universal'])
        
        # Base voltage with sinusoidal variation
        base_voltage = config['base']
        frequency = config['frequency']
        
        # Add sinusoidal variation to simulate natural fluctuations
        variation = config['variance'] * math.sin(2 * math.pi * frequency * timestamp)
        
        # Add random noise
        noise = random.gauss(0, config['noise'])
        
        # Add small random walk
        random_walk = random.gauss(0, 0.01)
        
        voltage = base_voltage + variation + noise + random_walk
        
        # Ensure voltage stays within reasonable bounds (0-5V for Arduino)
        voltage = max(0.0, min(5.0, voltage))
        
        return round(voltage, 3)
    
    def generate_anomaly_voltage(self, material: str, anomaly_type: str = 'spike', timestamp: float = None) -> float:
        """Generate anomalous voltage reading"""
        if timestamp is None:
            timestamp = time.time() - self.start_time
            
        normal_voltage = self.generate_normal_voltage(material, timestamp)
        
        if anomaly_type == 'spike':
            # Sudden voltage spike
            spike_magnitude = random.uniform(1.0, 2.5)
            return round(normal_voltage + spike_magnitude, 3)
        
        elif anomaly_type == 'drop':
            # Sudden voltage drop
            drop_magnitude = random.uniform(0.8, 1.5)
            return round(max(0.0, normal_voltage - drop_magnitude), 3)
        
        elif anomaly_type == 'oscillation':
            # Rapid oscillation
            oscillation = random.uniform(-1.0, 1.0) * math.sin(10 * math.pi * timestamp)
            return round(normal_voltage + oscillation, 3)
        
        elif anomaly_type == 'drift':
            # Gradual drift
            drift = random.uniform(-0.5, 0.5) * timestamp
            return round(normal_voltage + drift, 3)
        
        else:
            return normal_voltage
    
    def generate_training_dataset(self, material: str, num_samples: int = 1000, 
                                anomaly_ratio: float = 0.1) -> List[Dict]:
        """Generate a complete training dataset for a material"""
        dataset = []
        
        # Generate normal samples
        normal_samples = int(num_samples * (1 - anomaly_ratio))
        for i in range(normal_samples):
            timestamp = i / self.sample_rate
            voltage = self.generate_normal_voltage(material, timestamp)
            
            dataset.append({
                'voltage': voltage,
                'is_anomaly': False,
                'timestamp': timestamp,
                'material': material,
                'anomaly_type': None
            })
        
        # Generate anomaly samples
        anomaly_samples = num_samples - normal_samples
        anomaly_types = ['spike', 'drop', 'oscillation', 'drift']
        
        for i in range(anomaly_samples):
            timestamp = (normal_samples + i) / self.sample_rate
            anomaly_type = random.choice(anomaly_types)
            voltage = self.generate_anomaly_voltage(material, anomaly_type, timestamp)
            
            dataset.append({
                'voltage': voltage,
                'is_anomaly': True,
                'timestamp': timestamp,
                'material': material,
                'anomaly_type': anomaly_type
            })
        
        # Shuffle the dataset
        random.shuffle(dataset)
        
        return dataset
    
    def save_dataset(self, dataset: List[Dict], filename: str):
        """Save dataset to JSON file"""
        os.makedirs('training_data', exist_ok=True)
        filepath = os.path.join('training_data', filename)
        
        with open(filepath, 'w') as f:
            json.dump(dataset, f, indent=2)
        
        print(f"✅ Dataset saved to: {filepath}")
        print(f"   Total samples: {len(dataset)}")
        print(f"   Normal samples: {sum(1 for d in dataset if not d['is_anomaly'])}")
        print(f"   Anomaly samples: {sum(1 for d in dataset if d['is_anomaly'])}")
    
    def simulate_real_time(self, material: str, duration: int = 60):
        """Simulate real-time voltage readings"""
        print(f"Simulating {material} voltage readings for {duration} seconds...")
        print("Press Ctrl+C to stop")
        
        try:
            start_time = time.time()
            while time.time() - start_time < duration:
                voltage = self.generate_normal_voltage(material)
                timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
                print(f"[{timestamp}] {material.upper()}: {voltage}V")
                time.sleep(1.0 / self.sample_rate)
                
        except KeyboardInterrupt:
            print("\nSimulation stopped by user")

def create_preset_training_data():
    """Create training datasets for all preset materials"""
    simulator = ArduinoSimulator()
    
    materials = ['concrete', 'wood', 'metal', 'universal']
    
    for material in materials:
        print(f"\nGenerating training data for {material}...")
        
        # Generate dataset
        dataset = simulator.generate_training_dataset(
            material=material,
            num_samples=2000,  # 2000 samples per material
            anomaly_ratio=0.15  # 15% anomalies
        )
        
        # Save dataset
        filename = f"{material}_training_data.json"
        simulator.save_dataset(dataset, filename)
    
    print("\n✅ All preset training datasets created!")
    print("Files saved in 'training_data/' directory")

def main():
    """Main function"""
    print("Arduino Voltage Simulator")
    print("=" * 40)
    
    if len(os.sys.argv) > 1:
        command = os.sys.argv[1]
        
        if command == "generate":
            create_preset_training_data()
            
        elif command == "simulate":
            material = os.sys.argv[2] if len(os.sys.argv) > 2 else "concrete"
            duration = int(os.sys.argv[3]) if len(os.sys.argv) > 3 else 30
            
            simulator = ArduinoSimulator()
            simulator.simulate_real_time(material, duration)
            
        else:
            print("Usage:")
            print("  python arduino_simulator.py generate  # Create training datasets")
            print("  python arduino_simulator.py simulate [material] [duration]  # Real-time simulation")
    else:
        print("Usage:")
        print("  python arduino_simulator.py generate  # Create training datasets")
        print("  python arduino_simulator.py simulate [material] [duration]  # Real-time simulation")
        
        # Default: generate training data
        print("\nGenerating default training datasets...")
        create_preset_training_data()

if __name__ == "__main__":
    main() 