#!/usr/bin/env python3
"""
Script to create dummy users for testing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, User, Post, Follow, UserService, AuthService
from datetime import datetime

def create_dummy_users():
    """Create dummy users for testing"""
    
    db = SessionLocal()
    
    try:
        print("🧪 Creating dummy users...")
        
        # Check if users already exist
        existing_users = db.query(User).count()
        if existing_users > 0:
            print(f"⚠️  Found {existing_users} existing users. Skipping user creation.")
            print("   If you want to start fresh, delete users manually or use the SQL script.")
            return
        
        # Create dummy users
        users_data = [
            {
                'username': 'testuser1',
                'email': 'testuser1@example.com',
                'password': 'password123',
                'role': 'user'
            },
            {
                'username': 'testuser2', 
                'email': 'testuser2@example.com',
                'password': 'password123',
                'role': 'user'
            },
            {
                'username': 'admin',
                'email': 'admin@example.com', 
                'password': 'password123',
                'role': 'admin'
            }
        ]
        
        created_users = []
        
        for user_data in users_data:
            try:
                user = UserService.create_user(
                    db=db,
                    username=user_data['username'],
                    email=user_data['email'],
                    password=user_data['password']
                )
                user.role = user_data['role']
                created_users.append(user)
                print(f"✅ Created user: {user.username} (ID: {user.id})")
            except Exception as e:
                print(f"❌ Failed to create user {user_data['username']}: {e}")
        
        # Create some sample posts
        if len(created_users) >= 2:
            posts_data = [
                {
                    'title': 'First Detection Session',
                    'body': 'Just completed my first anomaly detection session with concrete material. The results look promising!',
                    'user_id': created_users[0].id
                },
                {
                    'title': 'Metal Analysis Results', 
                    'body': 'Analyzed metal samples today. The ML model detected several anomalies in the voltage patterns.',
                    'user_id': created_users[1].id
                },
                {
                    'title': 'System Performance',
                    'body': 'The anomaly detection system is working great with the new LSTM models.',
                    'user_id': created_users[0].id
                }
            ]
            
            for post_data in posts_data:
                try:
                    post = Post(
                        title=post_data['title'],
                        body=post_data['body'],
                        user_id=post_data['user_id'],
                        status='active',
                        created_at=datetime.utcnow()
                    )
                    db.add(post)
                    print(f"✅ Created post: {post.title}")
                except Exception as e:
                    print(f"❌ Failed to create post {post_data['title']}: {e}")
            
            # Create a follow relationship (user 1 follows user 2)
            try:
                follow = Follow(
                    following_user_id=created_users[0].id,
                    followed_user_id=created_users[1].id,
                    created_at=datetime.utcnow()
                )
                db.add(follow)
                print(f"✅ Created follow: {created_users[0].username} follows {created_users[1].username}")
            except Exception as e:
                print(f"❌ Failed to create follow relationship: {e}")
        
        # Commit all changes
        db.commit()
        
        print("\n🎯 Dummy data created successfully!")
        print(f"   Users: {len(created_users)}")
        print(f"   Posts: {len(posts_data) if len(created_users) >= 2 else 0}")
        print(f"   Follows: {1 if len(created_users) >= 2 else 0}")
        
        print("\n📋 Login credentials:")
        for user in created_users:
            print(f"   Username: {user.username}")
            print(f"   Password: password123")
            print(f"   Email: {user.email}")
            print()
        
        print("🚀 You can now test the frontend with these users!")
        
    except Exception as e:
        print(f"❌ Error creating dummy users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_dummy_users() 