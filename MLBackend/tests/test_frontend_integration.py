#!/usr/bin/env python3
"""
Test script to verify backend integration with frontend
"""

import requests
import json
import time

def test_backend_integration():
    """Test the main backend endpoints"""
    
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Backend Integration...")
    
    # Test 1: Server status
    try:
        response = requests.get(f"{base_url}/status")
        if response.status_code == 200:
            print("✅ Server status endpoint working")
            print(f"   Status: {response.json()}")
        else:
            print(f"❌ Server status failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Server status error: {e}")
    
    # Test 2: Root endpoint
    try:
        response = requests.get(f"{base_url}/")
        if response.status_code == 200:
            print("✅ Root endpoint working")
            print(f"   Available endpoints: {response.json().get('endpoints', {})}")
        else:
            print(f"❌ Root endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Root endpoint error: {e}")
    
    # Test 3: Test endpoint
    try:
        response = requests.get(f"{base_url}/test")
        if response.status_code == 200:
            print("✅ Test endpoint working")
            print(f"   Message: {response.json().get('message', '')}")
        else:
            print(f"❌ Test endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Test endpoint error: {e}")
    
    print("\n🎯 Frontend Integration Status:")
    print("   - Backend should be accessible at http://localhost:8000")
    print("   - Socket.IO should be available for real-time communication")
    print("   - MLStatusPanel will show rolling window progress")
    print("   - LiveChart will display real-time voltage and anomaly data")
    
    print("\n📱 To test the frontend:")
    print("   1. Start the backend: python app.py")
    print("   2. Run the React Native app")
    print("   3. Check the HomeScreen for ML status and live data")

if __name__ == "__main__":
    test_backend_integration() 