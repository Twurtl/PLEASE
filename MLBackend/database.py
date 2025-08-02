# MLBackend/database.py
from sqlalchemy import create_engine, Column, String, Text, Float, Boolean, DateTime, JSON, Integer, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.dialects.mysql import CHAR
import uuid
from datetime import datetime, timedelta
from typing import Optional, List
import bcrypt
import os
import jwt
import json

# MySQL Database configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Xu98040059")
DB_NAME = os.getenv("DB_NAME", "anomaly_detection")
DB_PORT = os.getenv("DB_PORT", "3306")

# Simplified DATABASE_URL without auth_plugin
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=False,  # Set to True for SQL debugging
    connect_args={
        "charset": "utf8mb4",
        "autocommit": False,
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# JWT Configuration
SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


def generate_uuid():
    return str(uuid.uuid4())

# Database Models - Updated to match user requirements

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    role = Column(String(20), default='user')  # user, admin
    created_at = Column(DateTime, default=datetime.utcnow)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(Text)
    last_login = Column(DateTime)

    # Relationships
    posts = relationship("Post", back_populates="user")
    following = relationship("Follow", foreign_keys="Follow.following_user_id", back_populates="follower")
    followers = relationship("Follow", foreign_keys="Follow.followed_user_id", back_populates="followed")
    models = relationship("MLModel", back_populates="user")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)  # Content of the post
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    status = Column(String(20), default='active')  # active, draft, archived
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="posts")


class Follow(Base):
    __tablename__ = "follows"

    following_user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    followed_user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    follower = relationship("User", foreign_keys=[following_user_id], back_populates="following")
    followed = relationship("User", foreign_keys=[followed_user_id], back_populates="followers")


class MLModel(Base):
    __tablename__ = "ml_models"

    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)  # Nullable for preset models
    name = Column(String(100), nullable=False)
    file_path = Column(Text, nullable=False)  # Path to the trained model file
    material_type = Column(String(50), default='universal')  # concrete, wood, metal, universal, custom
    framework = Column(String(50), default='tensorflow')  # tensorflow, pytorch, etc.
    accuracy = Column(Float, nullable=True)
    training_data_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    is_preset = Column(Boolean, default=False)

    # Relationships
    user = relationship("User", back_populates="models")


class DetectionSession(Base):
    __tablename__ = "detection_sessions"

    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    model_id = Column(CHAR(36), ForeignKey('ml_models.id'), nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    total_readings = Column(Integer, default=0)
    anomalies_detected = Column(Integer, default=0)
    status = Column(String(20), default='active')  # active, completed, stopped


class DetectionLog(Base):
    __tablename__ = "detection_logs"

    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    session_id = Column(CHAR(36), ForeignKey('detection_sessions.id'))
    model_id = Column(CHAR(36), ForeignKey('ml_models.id'))
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    input_snapshot = Column(Text)
    prediction_result = Column(Text)
    confidence_score = Column(Float)
    voltage = Column(Float)
    is_anomaly = Column(Boolean)
    timestamp = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

    @staticmethod
    def create_access_token(data: dict):
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    @staticmethod
    def verify_token(token: str) -> Optional[str]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str = payload.get("sub")
            if user_id is None:
                return None
            return user_id
        except jwt.PyJWTError:
            return None


class UserService:
    @staticmethod
    def create_user(db: Session, username: str, email: str, password: str) -> User:
        hashed_password = AuthService.hash_password(password)
        user = User(username=username, email=email, password_hash=hashed_password)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
        user = db.query(User).filter(User.username == username).first()
        if user and AuthService.verify_password(password, user.password_hash):
            user.last_login = datetime.utcnow()
            db.commit()
            return user
        return None

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_user_models(db: Session, user_id: int) -> List[MLModel]:
        return db.query(MLModel).filter(MLModel.user_id == user_id, MLModel.is_active == True).all()

    @staticmethod
    def get_preset_models(db: Session) -> List[MLModel]:
        return db.query(MLModel).filter(MLModel.is_preset == True, MLModel.is_active == True).all()


class MLModelService:
    @staticmethod
    def create_model(db: Session, user_id: int, name: str, file_path: str, material_type: str = 'universal') -> MLModel:
        model = MLModel(
            user_id=user_id,
            name=name,
            file_path=file_path,
            material_type=material_type
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model

    @staticmethod
    def get_model_by_id(db: Session, model_id: str) -> Optional[MLModel]:
        return db.query(MLModel).filter(MLModel.id == model_id).first()

    @staticmethod
    def update_model_accuracy(db: Session, model_id: str, accuracy: float, training_data_count: int):
        model = db.query(MLModel).filter(MLModel.id == model_id).first()
        if model:
            model.accuracy = accuracy
            model.training_data_count = training_data_count
            db.commit()

    @staticmethod
    def create_preset_models(db: Session):
        """Create default preset models for new users"""
        preset_models = [
            {
                'name': 'Concrete Anomaly Detector',
                'material_type': 'concrete',
                'file_path': 'models/preset/concrete_model.h5',
                'is_preset': True
            },
            {
                'name': 'Wood Anomaly Detector',
                'material_type': 'wood',
                'file_path': 'models/preset/wood_model.h5',
                'is_preset': True
            },
            {
                'name': 'Metal Anomaly Detector',
                'material_type': 'metal',
                'file_path': 'models/preset/metal_model.h5',
                'is_preset': True
            },
            {
                'name': 'Universal Anomaly Detector',
                'material_type': 'universal',
                'file_path': 'models/preset/universal_model.h5',
                'is_preset': True
            }
        ]

        for model_data in preset_models:
            existing = db.query(MLModel).filter(
                MLModel.name == model_data['name'],
                MLModel.is_preset == True
            ).first()
            
            if not existing:
                # Explicitly set user_id to None for preset models
                model_data['user_id'] = None
                model = MLModel(**model_data)
                db.add(model)
        
        db.commit()


class SessionService:
    @staticmethod
    def create_session(db: Session, user_id: Optional[int], model_id: str) -> DetectionSession:
        session = DetectionSession(user_id=user_id, model_id=model_id)
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def end_session(db: Session, session_id: str):
        session = db.query(DetectionSession).filter(DetectionSession.id == session_id).first()
        if session:
            session.ended_at = datetime.utcnow()
            session.status = 'completed'
            db.commit()

    @staticmethod
    def update_session_stats(db: Session, session_id: str, total_readings: int, anomalies: int):
        session = db.query(DetectionSession).filter(DetectionSession.id == session_id).first()
        if session:
            session.total_readings = total_readings
            session.anomalies_detected = anomalies
            db.commit()


class LogService:
    @staticmethod
    def log_prediction(db: Session, session_id: str, model_id: str, user_id: Optional[int],
                       voltage: float, features: dict, prediction: dict):
        log = DetectionLog(
            session_id=session_id,
            model_id=model_id,
            user_id=user_id,
            voltage=voltage,
            input_snapshot=json.dumps(features),
            prediction_result=json.dumps(prediction),
            confidence_score=prediction.get('confidence', 0.0),
            is_anomaly=prediction.get('is_anomaly', False)
        )
        db.add(log)
        db.commit()


def init_database():
    """Initialize database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
        
        # Create preset models
        db = SessionLocal()
        try:
            MLModelService.create_preset_models(db)
            print("✅ Preset models initialized successfully")
        except Exception as e:
            print(f"⚠️  Warning: Could not create preset models: {e}")
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        print("\nTroubleshooting tips:")
        print("1. Make sure MySQL server is running")
        print("2. Check your database credentials in .env file")
        print("3. Ensure the 'anomaly_detection' database exists")
        print("4. Try running: CREATE DATABASE anomaly_detection;")
        print("5. Install missing dependencies: pip install -r requirements.txt")
        raise e
