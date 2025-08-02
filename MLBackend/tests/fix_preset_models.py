#!/usr/bin/env python3
"""
Script to fix preset models issue by recreating the ml_models table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, SessionLocal, MLModel, MLModelService
from sqlalchemy import text

def fix_preset_models():
    """Fix preset models by recreating the ml_models table"""
    
    db = SessionLocal()
    
    try:
        print("🔧 Fixing preset models issue...")
        
        # Drop and recreate the ml_models table
        print("   Dropping ml_models table...")
        db.execute(text("DROP TABLE IF EXISTS ml_models"))
        db.commit()
        
        print("   Recreating ml_models table...")
        from database import Base
        Base.metadata.create_all(bind=engine, tables=[MLModel.__table__])
        
        print("   Creating preset models...")
        MLModelService.create_preset_models(db)
        
        # Verify the models were created
        models = db.query(MLModel).all()
        print(f"✅ Successfully created {len(models)} preset models:")
        
        for model in models:
            print(f"   - {model.name} (user_id: {model.user_id}, is_preset: {model.is_preset})")
        
        print("\n🎯 Preset models fixed successfully!")
        print("   You can now run the backend without errors.")
        
    except Exception as e:
        print(f"❌ Error fixing preset models: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_preset_models() 