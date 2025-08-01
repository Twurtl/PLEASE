# Anomaly Detection WebSocket Backend

Real-time anomaly detection backend using Flask-SocketIO for Arduino voltage monitoring.

## Setup

1. **Install Dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

2. **Connect Arduino:**

   - Upload `Arduino/voltage_monitor.ino` to your Arduino
   - Connect voltage source to A0 pin
   - Connect Arduino to computer via USB

3. **Start the Server:**

   ```bash
   source mlbackend-env/bin/activate

   python app.py
   ```

## How It Works

### Data Flow:

```
Arduino (USB) → Python Backend → WebSocket → React Native App
```

1. **Arduino** reads voltage from A0 pin every 100ms
2. **Python Backend** receives data via USB serial
3. **ML Model** processes voltage data and detects anomalies
4. **WebSocket** sends results to React Native app

### Features:

- Real-time voltage monitoring
- Rule-based anomaly detection (no ML model required)
- WebSocket communication with mobile app
- Configurable thresholds and parameters
- Automatic Arduino detection

## Configuration

Edit `config/model_config.json` to adjust:

- `anomaly_threshold`: Detection sensitivity (0-1)
- `window_size`: Number of samples for analysis
- `sample_rate`: Expected samples per second

## API Endpoints

### WebSocket Events:

- `connect`: App connects to server
- `voltage_data`: App sends voltage data
- `anomaly_result`: Server sends anomaly results

### Response Format:

```json
{
  "anomaly_score": 0.23,
  "is_anomaly": false,
  "confidence": 0.87,
  "timestamp": 1234567890,
  "voltage": 2.45
}
```

## Testing

1. **Without Arduino:**

   - Server will start without Arduino
   - Use app to send test voltage data

2. **With Arduino:**
   - Connect Arduino with voltage source
   - Server automatically detects and reads data
   - Real-time anomaly detection

## Troubleshooting

- **Arduino not found**: Check USB connection and port
- **WebSocket connection failed**: Verify server is running on port 5000
- **No anomaly detection**: Adjust thresholds in config file

## Next Steps

1. **Train LSTM Model**: Replace rule-based detection with ML model
2. **Add User Training**: Implement user-specific model training
3. **Material Profiles**: Add material-specific detection parameters
4. **Advanced Features**: Add frequency analysis, FFT, etc.
