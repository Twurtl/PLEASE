# Anomaly Detection System - Integration Summary

## ✅ Successfully Implemented Features

### 🗄️ Database Schema (MySQL with UUIDs)
- **Users Table**: UUID primary keys, username, email, password_hash, timestamps
- **Models Table**: User's trained ML models with UUID relationships
- **Logs Table**: Detection logs with JSON input/output snapshots
- **Configurations Table**: User-specific model settings

### 🔐 Authentication System
- **HTTP Endpoints**: `/auth/login`, `/auth/register`, `/auth/me`
- **WebSocket Authentication**: `ws_login`, `ws_select_model`, `ws_get_models` 
- **JWT Token Support**: Secure token-based authentication
- **Password Hashing**: bcrypt for secure password storage

### 🤝 Frontend-Backend Integration
- **React Native App**: Full authentication flow with login/register
- **WebSocket Connection**: Real-time data streaming via Socket.IO
- **Dual Auth Support**: Both HTTP and WebSocket authentication modes
- **Model Management**: User can select and activate their trained models

### 📡 Real-time Data Flow
1. **Arduino** → Serial data → **Python Backend**
2. **Backend** → ML processing → **Database logging**
3. **Backend** → WebSocket → **React Native App**
4. **App** → Real-time charts and anomaly detection display

## 🏗️ Architecture Overview

```
┌─────────────────┐    Serial    ┌─────────────────┐    WebSocket    ┌─────────────────┐
│     Arduino     │─────────────▶│  Python Backend │◀──────────────▶│  React Native   │
│   (Voltage)     │              │  (Flask+SocketIO) │                │      App        │
└─────────────────┘              └─────────────────┘                └─────────────────┘
                                           │
                                           ▼
                                 ┌─────────────────┐
                                 │  MySQL Database │
                                 │   (Users/Models │
                                 │   /Logs/Config) │
                                 └─────────────────┘
```

## 🚀 Setup Instructions

### 1. Database Setup
```bash
cd MLBackend
source mlbackend-env/bin/activate
python setup_database.py
```

### 2. Start Backend Server
```bash
python app.py
```
Server will run on: `http://localhost:8000`

### 3. Test Credentials
- **Username**: `testuser`
- **Password**: `password123`
- **Email**: `test@example.com`

### 4. React Native App
The app is configured to use **WebSocket authentication** by default:
```typescript
<LoginScreen onSuccess={handleLoginSuccess} useWebSocketAuth={true} />
```

## 🔌 API Endpoints

### Authentication (HTTP)
- `POST /auth/register` - Create new user account
- `POST /auth/login` - User login with credentials
- `GET /auth/me` - Get current user info (requires auth)

### Models (HTTP)
- `GET /models` - Get user's models (requires auth)
- `POST /models` - Create new model (requires auth)
- `POST /models/{id}/activate` - Activate model for detection

### WebSocket Events
- `ws_login` - Login via WebSocket
- `ws_select_model` - Select active model
- `ws_get_models` - Get user models
- `arduino_connect` - Connect to Arduino
- `start_detection` - Start ML detection
- `stop_detection` - Stop detection

## 📊 Data Flow Details

### Authentication Flow
1. User opens React Native app
2. App connects to WebSocket server
3. User enters credentials in login screen
4. App sends `ws_login` event with credentials
5. Backend validates and returns user data + available models
6. App allows user to select a model for detection

### Detection Flow
1. User clicks "Connect to Arduino" (WebSocket: `arduino_connect`)
2. Backend establishes serial connection to Arduino
3. User clicks "Start Detection" (WebSocket: `start_detection`)
4. Backend loads selected ML model
5. Arduino voltage data flows through:
   - Serial → Backend → ML processing → Database logging
   - Real-time results sent via WebSocket to React Native app
6. App displays real-time charts and anomaly alerts

### Data Persistence
- All detection data logged to MySQL database
- User-specific models and configurations stored
- Session tracking for analysis and history

## 🔧 Configuration Files

### Backend Environment
- `MLBackend/.env` (optional) - Database credentials
- `MLBackend/database.py` - Database configuration
- `MLBackend/app.py` - Main server application

### Frontend Configuration
- `MyNewApp/src/connection/WebsocketManager.tsx` - WebSocket setup
- `MyNewApp/src/services/AuthService.tsx` - HTTP authentication
- `MyNewApp/App.tsx` - Main app with authentication flow

## 🏃‍♂️ Running the System

### Prerequisites
- MySQL server running locally
- Python virtual environment activated
- React Native development setup

### Startup Sequence
1. **Database**: `python setup_database.py`
2. **Backend**: `python app.py` 
3. **Arduino**: Connect to `/dev/tty.usbserial-1320` (or update port in app.py)
4. **Frontend**: Start React Native app
5. **Login**: Use test credentials to authenticate
6. **Detect**: Connect Arduino → Select Model → Start Detection

## 🎯 Key Features Working

✅ **User Registration/Login** - Both HTTP and WebSocket methods  
✅ **Model Management** - Users can create, select, and activate models  
✅ **Real-time Detection** - Arduino data processed by ML models in real-time  
✅ **Data Logging** - All detections saved to database with full context  
✅ **WebSocket Communication** - Bi-directional real-time data flow  
✅ **UUID-based Schema** - Proper relational database with foreign key constraints  
✅ **Security** - JWT tokens, password hashing, input validation  

## 🔍 Troubleshooting

### Database Issues
- If foreign key errors: `python clean_database.py` then `python setup_database.py`
- Check MySQL server is running: `mysql -u root -p`

### Connection Issues  
- Verify Arduino port in `app.py`: `SERIAL_PORT = '/dev/tty.usbserial-1320'`
- Check WebSocket connection in React Native app console logs

### Authentication Issues
- Test HTTP auth endpoints with curl/Postman
- Check WebSocket auth events in browser dev tools

The system is now fully integrated and ready for testing with real Arduino hardware!