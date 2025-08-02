#!/usr/bin/env python3
"""
Database initialization script for the Anomaly Detection Backend
This script creates the MySQL database and all required tables.
"""

import os
import pymysql
from sqlalchemy import create_engine, text
from database import DATABASE_URL, Base, init_database

def create_database():
    """Create the MySQL database if it doesn't exist"""
    # Extract database name from URL
    db_name = os.getenv("DB_NAME", "anomaly_detection")
    db_host = os.getenv("DB_HOST", "localhost")
    db_user = os.getenv("DB_USER", "root")
    db_password = os.getenv("DB_PASSWORD", "Xu98040059")
    db_port = int(os.getenv("DB_PORT", "3306"))

    try:
        # Connect to MySQL server (without specifying database)
        connection = pymysql.connect(
            host=db_host,
            user=db_user,
            password=db_password,
            port=db_port,
            charset='utf8mb4'
        )
        
        cursor = connection.cursor()
        
        # Create database if it doesn't exist
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        print(f"✅ Database '{db_name}' created or already exists")
        
        cursor.close()
        connection.close()
        
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        print("\nTroubleshooting tips:")
        print("1. Make sure MySQL server is running")
        print("2. Check your MySQL credentials")
        print("3. Try connecting manually: mysql -u root -p")
        print("4. If using MySQL 8.0+, you might need to use 'mysql_native_password'")
        return False
    
    return True

def init_tables():
    """Initialize all database tables"""
    try:
        # Create engine with the database
        engine = create_engine(DATABASE_URL, echo=True)
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✅ Database connection successful")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("✅ All tables created successfully")
        
        # Initialize preset models
        init_database()
        print("✅ Preset models initialized")
        
        return True
        
    except Exception as e:
        print(f"❌ Error initializing tables: {e}")
        print("\nCommon solutions:")
        print("1. Install missing dependencies: pip install -r requirements.txt")
        print("2. Make sure 'cryptography' package is installed: pip install cryptography")
        print("3. Check MySQL user permissions")
        print("4. Try using a different MySQL user or authentication method")
        return False

def main():
    """Main initialization function"""
    print("Starting database initialization...")
    print("=" * 50)
    
    # Create database
    if not create_database():
        print("❌ Failed to create database")
        return
    
    # Initialize tables
    if not init_tables():
        print("❌ Failed to initialize tables")
        return
    
    print("\n" + "=" * 50)
    print("✅ Database initialization completed successfully!")
    print("\nYou can now start the backend with: python app.py")

if __name__ == "__main__":
    main()
