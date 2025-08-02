#!/usr/bin/env python3
"""
Script to clean up the database by dropping all existing tables
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, SessionLocal
from sqlalchemy import text, inspect

def clean_database():
    """Drop all existing tables to start fresh"""
    print("🧹 Cleaning up existing database tables...")
    
    db = SessionLocal()
    try:
        # Get current tables
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        print(f"Found existing tables: {existing_tables}")
        
        if existing_tables:
            # Disable foreign key checks temporarily
            db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
            
            # Drop each table
            for table in existing_tables:
                print(f"   Dropping table: {table}")
                db.execute(text(f"DROP TABLE IF EXISTS {table}"))
            
            # Re-enable foreign key checks
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            
            db.commit()
            print("✅ All existing tables dropped successfully")
        else:
            print("✅ No existing tables found")
            
    except Exception as e:
        print(f"❌ Error cleaning database: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    clean_database()