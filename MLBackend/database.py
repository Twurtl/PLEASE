# MLBackend/database.py
from sqlalchemy import create_engine, Column, String, Text, Float, Boolean, DateTime, JSON, ForeignKey
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

# Database Models - Matching user's required schema with MySQL

class User(Base):
    __tablename__ = "users"

    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    username = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    models = relationship("Model", back_populates="user", cascade="all, delete-orphan")
    logs = relationship("Log", back_populates="user", cascade="all, delete-orphan")
    configurations = relationship("Configuration", back_populates="user", cascade="all, delete-orphan")


class Model(Base):
    __tablename__ = "models"

    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=True)  # Nullable for preset models
    name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    framework = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=False)
    is_preset = Column(Boolean, default=False)

    # Relationships
    user = relationship("User", back_populates="models")
    logs = relationship("Log", back_populates="model", cascade="all, delete-orphan")
    configurations = relationship("Configuration", back_populates="model", cascade="all, delete-orphan")


class Log(Base):
    __tablename__ = "logs"

    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    model_id = Column(CHAR(36), ForeignKey('models.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    input_snapshot = Column(JSON, nullable=False)
    prediction_result = Column(JSON, nullable=False)
    confidence_score = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    model = relationship("Model", back_populates="logs")
    user = relationship("User", back_populates="logs")


class Configuration(Base):
    __tablename__ = "configurations"

    id = Column(CHAR(36), primary_key=True, default=generate_uuid)
    user_id = Column(CHAR(36), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    model_id = Column(CHAR(36), ForeignKey('models.id', ondelete='CASCADE'), nullable=False)
    settings_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="configurations")
    model = relationship("Model", back_populates="configurations")


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
    def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()

    @staticmethod
    def get_user_models(db: Session, user_id: str) -> List[Model]:
        return db.query(Model).filter(Model.user_id == user_id, Model.is_active == True).all()


class ModelService:
    @staticmethod
    def create_model(db: Session, user_id: str, name: str, file_path: str, framework: str = 'tensorflow') -> Model:
        # Ensure user models are stored in the correct directory
        if not file_path.startswith('models/users/'):
            file_path = f"models/users/{user_id}/{file_path.split('/')[-1]}"
        
        model = Model(
            user_id=user_id,
            name=name,
            file_path=file_path,
            framework=framework,
            is_preset=False
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model
    
    @staticmethod
    def create_preset_model(db: Session, name: str, file_path: str, framework: str = 'tensorflow') -> Model:
        model = Model(
            user_id=None,  # Preset models don't belong to a specific user
            name=name,
            file_path=file_path,
            framework=framework,
            is_preset=True
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model

    @staticmethod
    def get_model_by_id(db: Session, model_id: str) -> Optional[Model]:
        return db.query(Model).filter(Model.id == model_id).first()

    @staticmethod
    def get_user_models(db: Session, user_id: str) -> List[Model]:
        # Get both user-specific models and preset models
        user_models = db.query(Model).filter(Model.user_id == user_id).all()
        preset_models = db.query(Model).filter(Model.is_preset == True).all()
        return user_models + preset_models
    
    @staticmethod
    def get_preset_models(db: Session) -> List[Model]:
        return db.query(Model).filter(Model.is_preset == True).all()

    @staticmethod
    def set_active_model(db: Session, user_id: str, model_id: str):
        # Deactivate all user models
        db.query(Model).filter(Model.user_id == user_id).update({Model.is_active: False})
        
        # Try to find the model (could be user model or preset model)
        model = db.query(Model).filter(
            Model.id == model_id,
            (Model.user_id == user_id) | (Model.is_preset == True)
        ).first()
        
        if model:
            # For user models, set as active
            if model.user_id == user_id:
                model.is_active = True
            # For preset models, create a user-specific active record
            elif model.is_preset:
                # Don't modify the preset model, just return it
                # The active state for preset models is handled differently
                pass
            db.commit()
            return model
        return None


class LogService:
    @staticmethod
    def log_prediction(db: Session, model_id: str, user_id: str, input_data: dict, prediction: dict, confidence_score: float = None):
        log = Log(
            model_id=model_id,
            user_id=user_id,
            input_snapshot=input_data,
            prediction_result=prediction,
            confidence_score=confidence_score
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def get_user_logs(db: Session, user_id: str, limit: int = 100) -> List[Log]:
        return db.query(Log).filter(Log.user_id == user_id).order_by(Log.timestamp.desc()).limit(limit).all()


class ConfigurationService:
    @staticmethod
    def create_configuration(db: Session, user_id: str, model_id: str, settings: dict) -> Configuration:
        config = Configuration(
            user_id=user_id,
            model_id=model_id,
            settings_json=settings
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config

    @staticmethod
    def get_user_configurations(db: Session, user_id: str) -> List[Configuration]:
        return db.query(Configuration).filter(Configuration.user_id == user_id).order_by(Configuration.created_at.desc()).all()


def init_database():
    """Initialize database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
        print("✅ Database initialized with new schema")
            
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        print("\nTroubleshooting tips:")
        print("1. Make sure MySQL server is running")
        print("2. Check your database credentials in .env file")
        print("3. Ensure the 'anomaly_detection' database exists")
        print("4. Try running: CREATE DATABASE anomaly_detection;")
        print("5. Install missing dependencies: pip install -r requirements.txt")
        raise e