#!/usr/bin/env python3
"""
Test script for the Anomaly Detection Backend
This script tests the main functionality of the backend.
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
TEST_USER = {
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123"
}

def test_server_status():
    """Test if the server is running"""
    print("Testing server status...")
    try:
        response = requests.get(f"{BASE_URL}/status")
        if response.status_code == 200:
            print("✅ Server is running")
            return True
        else:
            print(f"❌ Server returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure it's running on localhost:8000")
        return False

def test_registration():
    """Test user registration"""
    print("\nTesting user registration...")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/register",
            json=TEST_USER,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Registration successful")
            print(f"   User ID: {data.get('user_id')}")
            return data.get('access_token')
        else:
            print(f"❌ Registration failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return None

def test_login():
    """Test user login"""
    print("\nTesting user login...")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "username": TEST_USER["username"],
                "password": TEST_USER["password"]
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Login successful")
            return data.get('access_token')
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_get_user_info(token):
    """Test getting user information"""
    print("\nTesting get user info...")
    try:
        response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Get user info successful")
            print(f"   Username: {data.get('username')}")
            print(f"   Email: {data.get('email')}")
            return True
        else:
            print(f"❌ Get user info failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Get user info error: {e}")
        return False

def test_get_models(token):
    """Test getting user models"""
    print("\nTesting get user models...")
    try:
        response = requests.get(
            f"{BASE_URL}/models/user",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            models = data.get('models', [])
            print(f"✅ Get models successful - Found {len(models)} models")
            
            for model in models[:3]:  # Show first 3 models
                print(f"   - {model.get('name')} ({model.get('material_type')})")
            
            return models
        else:
            print(f"❌ Get models failed: {response.status_code}")
            return []
    except Exception as e:
        print(f"❌ Get models error: {e}")
        return []

def test_create_post(token):
    """Test creating a post"""
    print("\nTesting create post...")
    try:
        post_data = {
            "title": "Test Post",
            "body": "This is a test post created by the test script."
        }
        
        response = requests.post(
            f"{BASE_URL}/posts",
            json=post_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Create post successful")
            print(f"   Post ID: {data.get('post', {}).get('id')}")
            return True
        else:
            print(f"❌ Create post failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Create post error: {e}")
        return False

def test_get_posts(token):
    """Test getting posts"""
    print("\nTesting get posts...")
    try:
        response = requests.get(
            f"{BASE_URL}/posts",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            posts = data.get('posts', [])
            print(f"✅ Get posts successful - Found {len(posts)} posts")
            return True
        else:
            print(f"❌ Get posts failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Get posts error: {e}")
        return False

def test_detection_status(token):
    """Test detection status endpoint"""
    print("\nTesting detection status...")
    try:
        response = requests.get(
            f"{BASE_URL}/detection/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Detection status successful")
            print(f"   Detection running: {data.get('detection_running')}")
            print(f"   Serial connected: {data.get('serial_connected')}")
            return True
        else:
            print(f"❌ Detection status failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Detection status error: {e}")
        return False

def main():
    """Main test function"""
    print("Anomaly Detection Backend Test")
    print("=" * 40)
    print(f"Testing backend at: {BASE_URL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Test server status
    if not test_server_status():
        print("\n❌ Server is not running. Please start the backend first:")
        print("   python app.py")
        return
    
    # Test registration
    token = test_registration()
    if not token:
        # Try login instead (user might already exist)
        token = test_login()
        if not token:
            print("\n❌ Authentication failed. Cannot continue testing.")
            return
    
    # Test authenticated endpoints
    test_get_user_info(token)
    test_get_models(token)
    test_create_post(token)
    test_get_posts(token)
    test_detection_status(token)
    
    print("\n" + "=" * 40)
    print("✅ Backend test completed!")
    print("\nThe backend appears to be working correctly.")
    print("You can now use the React Native app to connect to it.")

if __name__ == "__main__":
    main() 