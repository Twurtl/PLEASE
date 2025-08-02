# database.py

import os
from datetime import datetime, timedelta
from typing import Optional, List
import json
import hashlib
import secrets
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from passlib.context import CryptContext
import jwt

# Database configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "anomaly_detection")
DB_PORT = os.getenv("DB_PORT", "3306")

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# SQLAlchemy setup
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-here")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Database Models


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Relationships
    models = relationship("MLModel", back_populates="owner")
    sessions = relationship("DetectionSession", back_populates="user")


class MLModel(Base):
    __tablename__ = "ml_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    # e.g., "steel", "aluminum", "composite"
    material_type = Column(String(50), nullable=False)
    file_path = Column(String(255), nullable=False)
    accuracy = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    is_preset = Column(Boolean, default=False)
    user_id = Column(Integer, ForeignKey("users.id"),
                     nullable=True)  # NULL for preset models
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Model parameters stored as JSON
    parameters = Column(JSON, nullable=True)

    # Relationships
    owner = relationship("User", back_populates="models")
    sessions = relationship("DetectionSession", back_populates="model")


class DetectionSession(Base):
    __tablename__ = "detection_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"),
                     nullable=True)  # NULL for guest sessions
    model_id = Column(Integer, ForeignKey("ml_models.id"), nullable=False)
    session_name = Column(String(100), nullable=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    total_predictions = Column(Integer, default=0)
    total_anomalies = Column(Integer, default=0)
    average_confidence = Column(Float, nullable=True)
    is_guest_session = Column(Boolean, default=False)

    # Session metadata stored as JSON
    metadata = Column(JSON, nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")
    model = relationship("MLModel", back_populates="sessions")
    logs = relationship("DetectionLog", back_populates="session")


class DetectionLog(Base):
    __tablename__ = "detection_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey(
        "detection_sessions.id"), nullable=False)
    model_id = Column(Integer, ForeignKey("ml_models.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"),
                     nullable=True)  # NULL for guest logs
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Input data
    voltage_reading = Column(Float, nullable=False)

    # Features extracted from the data (stored as JSON)
    features = Column(JSON, nullable=True)

    # Prediction results
    anomaly_score = Column(Float, nullable=False)
    is_anomaly = Column(Boolean, nullable=False)
    confidence = Column(Float, nullable=False)
    # "ml_model" or "rule_based"
    method = Column(String(50), default="ml_model")

    # Additional prediction metadata
    prediction_metadata = Column(JSON, nullable=True)

    # Relationships
    session = relationship("DetectionSession", back_populates="logs")

# Database dependency


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Service Classes


class AuthService:
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        return encoded_jwt

    @staticmethod
    def verify_token(token: str) -> Optional[str]:
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY,
                                 algorithms=[JWT_ALGORITHM])
            user_id: str = payload.get("sub")
            if user_id is None:
                return None
            return user_id
        except jwt.PyJWTError:
            return None


class UserService:
    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def create_user(db: Session, username: str, email: str, password: str) -> User:
        hashed_password = UserService.get_password_hash(password)
        db_user = User(
            username=username,
            email=email,
            hashed_password=hashed_password
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return None
        if not UserService.verify_password(password, user.hashed_password):
            return None
        return user

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_user_models(db: Session, user_id: int) -> List[MLModel]:
        return db.query(MLModel).filter(MLModel.user_id == user_id).all()

    @staticmethod
    def get_preset_models(db: Session) -> List[MLModel]:
        return db.query(MLModel).filter(MLModel.is_preset == True).all()


class MLModelService:
    @staticmethod
    def create_model(db: Session, name: str, material_type: str, file_path: str,
                     user_id: Optional[int] = None, accuracy: Optional[float] = None,
                     description: Optional[str] = None, is_preset: bool = False,
                     parameters: Optional[dict] = None) -> MLModel:
        db_model = MLModel(
            name=name,
            material_type=material_type,
            file_path=file_path,
            user_id=user_id,
            accuracy=accuracy,
            description=description,
            is_preset=is_preset,
            parameters=parameters
        )
        db.add(db_model)
        db.commit()
        db.refresh(db_model)
        return db_model

    @staticmethod
    def get_model_by_id(db: Session, model_id: int) -> Optional[MLModel]:
        return db.query(MLModel).filter(MLModel.id == model_id).first()

    @staticmethod
    def get_models_by_user(db: Session, user_id: int) -> List[MLModel]:
        return db.query(MLModel).filter(MLModel.user_id == user_id).all()

    @staticmethod
    def get_preset_models(db: Session) -> List[MLModel]:
        return db.query(MLModel).filter(MLModel.is_preset == True).all()

    @staticmethod
    def update_model_accuracy(db: Session, model_id: int, accuracy: float) -> bool:
        model = db.query(MLModel).filter(MLModel.id == model_id).first()
        if model:
            model.accuracy = accuracy
            model.updated_at = datetime.utcnow()
            db.commit()
            return True
        return False

    @staticmethod
    def delete_model(db: Session, model_id: int, user_id: int) -> bool:
        model = db.query(MLModel).filter(
            MLModel.id == model_id,
            MLModel.user_id == user_id,
            MLModel.is_preset == False
        ).first()
        if model:
            # Delete associated file
            if os.path.exists(model.file_path):
                os.remove(model.file_path)
            db.delete(model)
            db.commit()
            return True
        return False


class SessionService:
    @staticmethod
    def create_session(db: Session, user_id: Optional[int], model_id: int,
                       session_name: Optional[str] = None,
                       is_guest_session: bool = False) -> DetectionSession:
        if not session_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            session_name = f"Session_{timestamp}"

        db_session = DetectionSession(
            user_id=user_id,
            model_id=model_id,
            session_name=session_name,
            is_guest_session=is_guest_session
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        return db_session

    @staticmethod
    def get_session_by_id(db: Session, session_id: int) -> Optional[DetectionSession]:
        return db.query(DetectionSession).filter(DetectionSession.id == session_id).first()

    @staticmethod
    def get_user_sessions(db: Session, user_id: int, limit: int = 50) -> List[DetectionSession]:
        return db.query(DetectionSession)\
            .filter(DetectionSession.user_id == user_id)\
            .order_by(DetectionSession.start_time.desc())\
            .limit(limit).all()

    @staticmethod
    def end_session(db: Session, session_id: int) -> bool:
        session = db.query(DetectionSession).filter(
            DetectionSession.id == session_id).first()
        if session and not session.end_time:
            session.end_time = datetime.utcnow()

            # Calculate session statistics
            logs = db.query(DetectionLog).filter(
                DetectionLog.session_id == session_id).all()
            if logs:
                session.total_predictions = len(logs)
                session.total_anomalies = sum(
                    1 for log in logs if log.is_anomaly)
                session.average_confidence = sum(
                    log.confidence for log in logs) / len(logs)

            db.commit()
            return True
        return False

    @staticmethod
    def get_session_stats(db: Session, session_id: int) -> dict:
        session = db.query(DetectionSession).filter(
            DetectionSession.id == session_id).first()
        if not session:
            return {}

        logs = db.query(DetectionLog).filter(
            DetectionLog.session_id == session_id).all()

        stats = {
            'session_id': session.id,
            'session_name': session.session_name,
            'start_time': session.start_time.isoformat(),
            'end_time': session.end_time.isoformat() if session.end_time else None,
            'total_predictions': len(logs),
            'total_anomalies': sum(1 for log in logs if log.is_anomaly),
            'anomaly_rate': 0,
            'average_confidence': 0,
        }

        if logs:
            stats['anomaly_rate'] = stats['total_anomalies'] / \
                stats['total_predictions']
            stats['average_confidence'] = sum(
                log.confidence for log in logs) / len(logs)

        return stats


class LogService:
    @staticmethod
    def log_prediction(db: Session, session_id: int, model_id: int, user_id: Optional[int],
                       voltage: float, features: dict, prediction: dict) -> DetectionLog:
        db_log = DetectionLog(
            session_id=session_id,
            model_id=model_id,
            user_id=user_id,
            voltage_reading=voltage,
            features=features,
            anomaly_score=prediction.get('anomaly_score', 0.0),
            is_anomaly=prediction.get('is_anomaly', False),
            confidence=prediction.get('confidence', 0.0),
            method=prediction.get('method', 'ml_model'),
            prediction_metadata=prediction.get('metadata', {})
        )
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        return db_log

    @staticmethod
    def get_session_logs(db: Session, session_id: int, limit: int = 1000) -> List[DetectionLog]:
        return db.query(DetectionLog)\
            .filter(DetectionLog.session_id == session_id)\
            .order_by(DetectionLog.timestamp.desc())\
            .limit(limit).all()

    @staticmethod
    def get_recent_logs(db: Session, user_id: Optional[int] = None,
                        limit: int = 100) -> List[DetectionLog]:
        query = db.query(DetectionLog)
        if user_id:
            query = query.filter(DetectionLog.user_id == user_id)
        return query.order_by(DetectionLog.timestamp.desc()).limit(limit).all()

    @staticmethod
    def get_anomaly_logs(db: Session, session_id: Optional[int] = None,
                         user_id: Optional[int] = None, limit: int = 100) -> List[DetectionLog]:
        query = db.query(DetectionLog).filter(DetectionLog.is_anomaly == True)
        if session_id:
            query = query.filter(DetectionLog.session_id == session_id)
        if user_id:
            query = query.filter(DetectionLog.user_id == user_id)
        return query.order_by(DetectionLog.timestamp.desc()).limit(limit).all()

# Database initialization


def init_database():
    """Initialize database with preset models"""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Check if preset models already exist
        existing_presets = db.query(MLModel).filter(
            MLModel.is_preset == True).count()
        if existing_presets > 0:
            print(f"✅ Found {existing_presets} existing preset models")
            return

        # Create models directory structure
        os.makedirs("models/preset", exist_ok=True)
        os.makedirs("models/user", exist_ok=True)

        # Create preset models (you'll need to have actual model files)
        preset_models = [
            {
                "name": "Steel Fatigue Detector v1.0",
                "material_type": "steel",
                "file_path": "models/preset/steel_fatigue_v1.pkl",
                "accuracy": 0.95,
                "description": "Pre-trained model for detecting fatigue in steel structures",
                "parameters": {
                    "window_size": 50,
                    "features": ["rms", "peak", "kurtosis", "skewness"],
                    "threshold": 0.7
                }
            },
            {
                "name": "Aluminum Crack Detection v2.1",
                "material_type": "aluminum",
                "file_path": "models/preset/aluminum_crack_v2.pkl",
                "accuracy": 0.92,
                "description": "Advanced model for detecting cracks in aluminum components",
                "parameters": {
                    "window_size": 75,
                    "features": ["fft", "wavelet", "statistical"],
                    "threshold": 0.6
                }
            },
            {
                "name": "Composite Delamination Detector",
                "material_type": "composite",
                "file_path": "models/preset/composite_delamination.pkl",
                "accuracy": 0.88,
                "description": "Specialized model for detecting delamination in composite materials",
                "parameters": {
                    "window_size": 100,
                    "features": ["energy", "entropy", "correlation"],
                    "threshold": 0.65
                }
            },
            {
                "name": "General Purpose Anomaly Detector",
                "material_type": "general",
                "file_path": "models/preset/general_anomaly.pkl",
                "accuracy": 0.85,
                "description": "General-purpose model suitable for various materials and defects",
                "parameters": {
                    "window_size": 60,
                    "features": ["statistical", "frequency"],
                    "threshold": 0.5
                }
            }
        ]

        for model_data in preset_models:
            preset_model = MLModel(
                name=model_data["name"],
                material_type=model_data["material_type"],
                file_path=model_data["file_path"],
                accuracy=model_data["accuracy"],
                description=model_data["description"],
                is_preset=True,
                user_id=None,
                parameters=model_data["parameters"]
            )
            db.add(preset_model)

        db.commit()
        print(f"✅ Created {len(preset_models)} preset models")

    except Exception as e:
        print(f"❌ Error initializing preset models: {e}")
        db.rollback()
    finally:
        db.close()


# Export all models and services
__all__ = [
    'Base', 'engine', 'SessionLocal', 'get_db', 'init_database',
    'User', 'MLModel', 'DetectionSession', 'DetectionLog',
    'UserService', 'MLModelService', 'SessionService', 'LogService', 'AuthService'
]
