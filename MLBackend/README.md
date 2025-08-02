# Anomaly Detection Backend

A Flask-based backend for anomaly detection with user authentication, ML model management, and real-time data processing from Arduino sensors.

## Features

- **User Authentication**: JWT-based authentication with user registration and login
- **ML Model Management**: Train, store, and manage custom ML models per user
- **Real-time Detection**: Process Arduino sensor data in real-time
- **Database Integration**: MySQL database with user data, models, and detection logs
- **Social Features**: User posts and following system
- **WebSocket Support**: Real-time communication with React Native app

## Database Schema

The system uses MySQL with the following tables:

### Core Tables
- **users**: User accounts with authentication
- **posts**: User-generated content
- **follows**: User following relationships
- **ml_models**: Machine learning models (preset and user-trained)
- **detection_sessions**: Active detection sessions
- **detection_logs**: Detection results and predictions

## Setup Instructions

### Prerequisites

1. **MySQL Server**: Install and configure MySQL Workbench or MySQL Server
2. **Python 3.8+**: Ensure Python is installed
3. **Arduino IDE**: For uploading code to Arduino

### 1. Database Setup

#### Create MySQL Database

1. Open MySQL Workbench or MySQL command line
2. Create a new database:
```sql
CREATE DATABASE anomaly_detection;
```

#### Configure Environment Variables

Create a `.env` file in the `MLBackend` directory:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=anomaly_detection
DB_PORT=3306
JWT_SECRET_KEY=your-secret-key-change-this-in-production
```

### 2. Python Environment Setup

1. Navigate to the MLBackend directory:
```bash
cd MLBackend
```

2. Create and activate virtual environment:
```bash
python -m venv mlbackend-env
source mlbackend-env/bin/activate  # On Windows: mlbackend-env\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

### 3. Initialize Database

Run the database initialization script:
```bash
python init_db.py
```

This will:
- Create all required tables
- Set up preset ML models
- Verify database connection

### 4. Arduino Setup

1. Upload the `voltage_monitor.ino` file to your Arduino
2. Connect Arduino to your computer via USB
3. Note the serial port (e.g., `/dev/tty.usbserial-1320` on macOS/Linux)

### 5. Start the Backend

```bash
python app.py
```

The server will start on `http://localhost:8000`

## API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info

### ML Models
- `GET /models/user` - Get user's models (including presets)
- `POST /models/train` - Train a new model
- `POST /models/{id}/select` - Select a model for detection

### Detection
- `POST /detection/start` - Start anomaly detection
- `POST /detection/stop` - Stop detection
- `GET /detection/status` - Get detection status

### Social Features
- `GET /posts` - Get all posts
- `POST /posts` - Create a new post

## React Native Integration

The backend is designed to work with the React Native app. Key integration points:

### Authentication Flow
1. User registers/logs in via React Native app
2. JWT token is stored in AsyncStorage
3. All subsequent requests include the token in Authorization header

### ML Model Management
1. Users can view preset models and their custom models
2. Users can train new models using Arduino data
3. Models are stored with file paths for backend loading

### Real-time Detection
1. User selects a model in the app
2. Detection starts via API call
3. Real-time data is streamed via WebSocket
4. Results are displayed in the app

## File Structure

```
MLBackend/
├── app.py                 # Main Flask application
├── database.py            # Database models and services
├── ml_model.py            # ML model training and prediction
├── data_processor.py      # Data processing utilities
├── init_db.py             # Database initialization script
├── requirements.txt       # Python dependencies
├── config/                # Configuration files
│   └── model_config.json
├── models/                # Trained model files
│   ├── preset/           # Preset models
│   └── user/             # User-trained models
└── README.md             # This file
```

## Troubleshooting

### Database Connection Issues
- Verify MySQL server is running
- Check database credentials in `.env` file
- Ensure database `anomaly_detection` exists

### Arduino Connection Issues
- Check serial port in `app.py` (SERIAL_PORT variable)
- Verify Arduino is connected and code is uploaded
- Test serial communication with Arduino IDE

### Model Training Issues
- Ensure sufficient training data is collected
- Check file permissions for model storage
- Verify TensorFlow installation

## Security Considerations

- Change default JWT secret key in production
- Use HTTPS in production
- Implement rate limiting
- Add input validation for all endpoints
- Use environment variables for sensitive data

## Development

### Adding New Features
1. Update database models in `database.py`
2. Add new endpoints in `app.py`
3. Update React Native services accordingly
4. Test with the mobile app

### Testing
- Use Postman or curl for API testing
- Test WebSocket connections
- Verify database operations
- Test model training pipeline

## License

This project is part of the SEMW4 Anomaly Detection System.
