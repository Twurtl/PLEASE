#!/usr/bin/env python3
"""
Complete Model Setup Script
Runs the entire process: generate data → train models → update database
"""

import os
import sys

def main():
    """Run the complete model setup process"""
    print("🤖 Complete Model Setup")
    print("=" * 50)
    
    # Step 1: Generate training data
    print("\n📊 Step 1: Generating training data...")
    os.system("python arduino_simulator.py generate")
    
    # Step 2: Train preset models
    print("\n🧠 Step 2: Training preset models...")
    os.system("python train_preset_models.py")
    
    print("\n✅ Model setup completed!")
    print("\nYou can now:")
    print("1. Start the backend: python app.py")
    print("2. Test the backend: python test_backend.py")
    print("3. Use the React Native app to connect")

if __name__ == "__main__":
    main() 