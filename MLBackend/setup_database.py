#!/usr/bin/env python3
"""
Setup script to initialize the database and create test data
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_database, SessionLocal, UserService, ModelService

def create_test_user():
    """Create a test user with sample model"""
    print("🔧 Creating test user...")
    
    db = SessionLocal()
    try:
        # Create test user
        username = "testuser"
        email = "test@example.com"
        password = "password123"
        
        # Check if user already exists
        existing_user = UserService.get_user_by_username(db, username)
        if existing_user:
            print(f"✅ Test user '{username}' already exists")
            user = existing_user
        else:
            user = UserService.create_user(db, username, email, password)
            print(f"✅ Created test user: {username}")
        
        # Create a sample model for the user
        existing_models = ModelService.get_user_models(db, user.id)
        if not existing_models:
            model = ModelService.create_model(
                db, 
                user.id, 
                "Sample Anomaly Model", 
                "models/sample_model.h5", 
                "tensorflow"
            )
            # Activate the model
            ModelService.set_active_model(db, user.id, model.id)
            print(f"✅ Created sample model: {model.name}")
        else:
            print(f"✅ User already has {len(existing_models)} model(s)")
        
        print(f"\n🎯 Test Credentials:")
        print(f"   Username: {username}")
        print(f"   Password: {password}")
        print(f"   Email: {email}")
        
    except Exception as e:
        print(f"❌ Error creating test user: {e}")
        db.rollback()
    finally:
        db.close()

def main():
    """Main setup function"""
    print("🚀 Setting up Anomaly Detection Database")
    print("=" * 50)
    
    try:
        # Initialize database
        init_database()
        
        # Create test data
        create_test_user()
        
        print("\n✅ Database setup completed successfully!")
        print("\n📋 Next steps:")
        print("1. Start the backend server: python app.py")
        print("2. Use the test credentials to login")
        print("3. Connect to Arduino and start detection")
        
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()