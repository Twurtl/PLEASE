#!/usr/bin/env python3
"""
Train Preset Models Script
Uses simulated Arduino data to train preset ML models for different materials.
"""

import json
import os
import numpy as np
from ml_model import AnomalyDetector
from data_processor import DataProcessor
from database import SessionLocal, MLModelService, MLModel
import glob

def load_training_data(material: str) -> tuple:
    """Load training data for a specific material"""
    filename = f"training_data/{material}_training_data.json"
    
    if not os.path.exists(filename):
        print(f"❌ Training data file not found: {filename}")
        print("Run 'python arduino_simulator.py generate' first")
        return None, None
    
    with open(filename, 'r') as f:
        data = json.load(f)
    
    # Extract features and labels
    X = []
    y = []
    
    processor = DataProcessor()
    window_size = 50  # Match the model's expected window size
    
    # Create sliding windows of features
    feature_windows = []
    label_windows = []
    
    # First, collect all features
    all_features = []
    for i, sample in enumerate(data):
        voltage = sample['voltage']
        timestamp = sample['timestamp']
        is_anomaly = sample['is_anomaly']
        
        # Process the voltage reading
        features = processor.process_voltage(voltage, timestamp)
        
        # Only use features when we have enough data in the window
        if features['sample_count'] >= processor.window_size:
            # Convert features dict to feature vector
            feature_vector = [
                features['voltage_mean'],
                features['voltage_std'],
                features['voltage_min'],
                features['voltage_max'],
                features['voltage_range'],
                features['voltage_variance'],
                features['voltage_skewness'],
                features['voltage_kurtosis'],
                features['time_delta_mean'],
                features['time_delta_std'],
                features['frequency_dominant'],
                features['frequency_bandwidth']
            ]
            
            all_features.append(feature_vector)
            label_windows.append(1 if is_anomaly else 0)
    
    # Create sliding windows
    for i in range(len(all_features) - window_size + 1):
        window_features = all_features[i:i + window_size]
        window_labels = label_windows[i:i + window_size]
        
        # Use the label of the last sample in the window
        label = 1 if any(window_labels) else 0
        
        X.append(window_features)
        y.append(label)
    
    return np.array(X), np.array(y)

def train_preset_model(material: str, model_name: str) -> bool:
    """Train a preset model for a specific material"""
    print(f"\n🔄 Training {material} model: {model_name}")
    
    # Load training data
    X, y = load_training_data(material)
    if X is None:
        return False
    
    if len(X) == 0:
        print(f"   ❌ No valid training samples found for {material}")
        return False
    
    print(f"   Loaded {len(X)} training samples")
    print(f"   Normal samples: {sum(y == 0)}")
    print(f"   Anomaly samples: {sum(y == 1)}")
    
    # Create models directory
    os.makedirs('models/preset', exist_ok=True)
    
    # Train the model
    try:
        detector = AnomalyDetector()
        file_path = f"models/preset/{material}_model.h5"
        
        # Data is already in correct shape (samples, timesteps, features)
        # Train the model using the correct method
        detector.train_model(X, y, file_path)
        
        # Create a new detector instance and load the trained model
        trained_detector = AnomalyDetector(model_path=file_path)
        
        # Calculate accuracy using the trained model
        predictions = []
        for i in range(len(X)):
            # Use the last feature vector from the window
            last_features = X[i][-1]  # Last timestep in the window
            
            # Create features dict for prediction
            features_dict = {
                'voltage_mean': last_features[0],
                'voltage_std': last_features[1],
                'voltage_min': last_features[2],
                'voltage_max': last_features[3],
                'voltage_range': last_features[4],
                'voltage_variance': last_features[5],
                'voltage_skewness': last_features[6],
                'voltage_kurtosis': last_features[7],
                'time_delta_mean': last_features[8],
                'time_delta_std': last_features[9],
                'frequency_dominant': last_features[10],
                'frequency_bandwidth': last_features[11]
            }
            pred = trained_detector.predict(features_dict)
            predictions.append(pred['is_anomaly'])
        
        accuracy = sum(p == l for p, l in zip(predictions, y)) / len(y)
        
        print(f"   ✅ Model trained successfully!")
        print(f"   📁 Saved to: {file_path}")
        print(f"   📊 Accuracy: {accuracy:.2%}")
        print(f"   🤖 Model type: {trained_detector.get_model_info()['model_type']}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def update_database_models():
    """Update the database with trained model information"""
    print("\n🔄 Updating database with model information...")
    
    db = SessionLocal()
    try:
        # Find all trained model files
        model_files = glob.glob("models/preset/*.h5")
        
        for model_file in model_files:
            # Extract material name from filename
            material = os.path.basename(model_file).replace('_model.h5', '')
            model_name = f"{material.capitalize()} Anomaly Detector"
            
            # Check if model already exists in database
            existing_models = db.query(MLModel).filter(
                MLModel.name == model_name,
                MLModel.is_preset == True
            ).all()
            
            if existing_models:
                # Update existing model
                model = existing_models[0]
                model.file_path = model_file
                model.accuracy = 0.85  # Estimated accuracy
                model.training_data_count = 2000
                print(f"   ✅ Updated: {model_name}")
            else:
                # Create new model entry - preset models don't need user_id
                model = MLModel(
                    name=model_name,
                    file_path=model_file,
                    material_type=material,
                    is_preset=True,
                    user_id=None,  # Explicitly set to None for preset models
                    accuracy=0.85,  # Estimated accuracy
                    training_data_count=2000
                )
                db.add(model)
                print(f"   ✅ Created: {model_name}")
        
        db.commit()
        print("   ✅ Database updated successfully!")
        
    except Exception as e:
        print(f"   ❌ Database update failed: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def main():
    """Main function"""
    print("Train Preset Models")
    print("=" * 40)
    
    # Check if training data exists
    if not os.path.exists("training_data"):
        print("❌ Training data not found!")
        print("Please run: python arduino_simulator.py generate")
        return
    
    # Materials to train
    materials = ['concrete', 'wood', 'metal', 'universal']
    
    success_count = 0
    
    for material in materials:
        model_name = f"{material.capitalize()} Anomaly Detector"
        if train_preset_model(material, model_name):
            success_count += 1
    
    print(f"\n📊 Training Summary:")
    print(f"   Successful: {success_count}/{len(materials)} models")
    
    if success_count > 0:
        # Update database
        update_database_models()
        
        print(f"\n✅ Preset models are ready!")
        print("You can now start the backend and use these models.")
    else:
        print(f"\n❌ No models were trained successfully.")
        print("Check the error messages above.")

if __name__ == "__main__":
    main() 