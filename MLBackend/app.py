# app.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import serial
import asyncio
import json
import time
from data_processor import DataProcessor
from ml_model import AnomalyDetector

app = FastAPI()
clients = set()

# Serial configuration
SERIAL_PORT = '/dev/tty.usbserial-11320'
BAUD_RATE = 9600

# Components
processor = DataProcessor()
detector = AnomalyDetector(config_path="model_config.json")

# Shared serial status
serial_connected = False


async def read_from_arduino():
    global clients, serial_connected
    ser = None
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        serial_connected = True
        print(f"Connected to Arduino on {SERIAL_PORT}")

        while True:
            if ser.in_waiting > 0:
                try:
                    line = ser.readline().decode('utf-8').strip()

                    if line:
                        voltage = float(line)
                        timestamp = time.time()

                        features = processor.process_voltage(
                            voltage, timestamp)

                        if features['sample_count'] >= processor.window_size:
                            prediction = detector.predict(features)

                            message = {
                                "type": "anomaly_data",
                                "anomaly_score": prediction['score'],
                                "is_anomaly": prediction['is_anomaly'],
                                "confidence": prediction['confidence'],
                                "timestamp": timestamp,
                                "voltage": voltage,
                                "method": prediction.get('method', 'unknown'),
                                "features": features
                            }

                            disconnected_clients = set()
                            for client in clients.copy():
                                try:
                                    await client.send_json(message)
                                except Exception as e:
                                    print(f"Error sending to client: {e}")
                                    disconnected_clients.add(client)

                            clients -= disconnected_clients

                            if clients:
                                print(
                                    f"Sent: V={voltage:.3f}, Anomaly={prediction['is_anomaly']}, Score={prediction['score']:.3f}")

                except ValueError as e:
                    print(f"Invalid voltage reading: {line} - {e}")
                except Exception as e:
                    print(f"Error processing line '{line}': {e}")

            await asyncio.sleep(0.01)

    except serial.SerialException as e:
        print(f"Serial connection error: {e}")
        serial_connected = False
    except Exception as e:
        print(f"Arduino read error: {e}")
        serial_connected = False
    finally:
        if ser and ser.is_open:
            ser.close()
            print("Serial connection closed")
            serial_connected = False


@app.on_event("startup")
async def on_startup():
    asyncio.create_task(read_from_arduino())
    print("FastAPI server started, Arduino reader task created")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global clients
    client_id = id(websocket)

    try:
        await websocket.accept()
        clients.add(websocket)
        print(
            f"WebSocket client {client_id} connected. Total clients: {len(clients)}")

        await websocket.send_json({
            "type": "connection_confirmed",
            "message": "Connected to anomaly detection server",
            "timestamp": time.time(),
            "client_id": client_id,
            "server_info": {
                "serial_connected": serial_connected,
                "connected_clients": len(clients)
            }
        })

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
                print(f"Received message from client {client_id}: {data}")

                try:
                    message = json.loads(data)
                    msg_type = message.get("type")

                    if msg_type == "ping":
                        await websocket.send_json({"type": "pong", "timestamp": time.time()})
                    elif msg_type == "update_threshold":
                        new_threshold = message.get("threshold", 0.5)
                        detector.update_threshold(new_threshold)
                        await websocket.send_json({
                            "type": "threshold_updated",
                            "threshold": detector.threshold,
                            "timestamp": time.time()
                        })
                    elif msg_type == "get_status":
                        await websocket.send_json({
                            "type": "status_response",
                            "server_status": "running",
                            "connected_clients": len(clients),
                            "serial_connected": serial_connected,
                            "detector_info": detector.get_model_info(),
                            "timestamp": time.time()
                        })
                    elif msg_type == "reconnect_serial":
                        asyncio.create_task(read_from_arduino())
                        await websocket.send_json({
                            "type": "serial_reconnect_attempt",
                            "message": "Serial reconnect triggered",
                            "timestamp": time.time()
                        })
                    else:
                        print(
                            f"Unknown message type from client {client_id}: {message}")

                except json.JSONDecodeError as e:
                    print(
                        f"Invalid JSON from client {client_id}: {data} - Error: {e}")

            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "ping", "timestamp": time.time()})
                except Exception as e:
                    print(
                        f"Failed to send keepalive to client {client_id}: {e}")
                    break
            except WebSocketDisconnect:
                print(f"Client {client_id} disconnected normally")
                break
            except Exception as e:
                print(f"Error handling message from client {client_id}: {e}")
                break

    except WebSocketDisconnect:
        print(f"Client {client_id} disconnected during handshake")
    except Exception as e:
        print(f"WebSocket error for client {client_id}: {e}")
    finally:
        clients.discard(websocket)
        print(f"Client {client_id} cleanup. Remaining: {len(clients)}")


@app.get("/status")
async def get_status():
    return {
        "server_status": "running",
        "connected_clients": len(clients),
        "serial_connected": serial_connected,
        "serial_port": SERIAL_PORT,
        "baud_rate": BAUD_RATE,
        "detector_info": detector.get_model_info(),
        "timestamp": time.time()
    }


@app.get("/test")
async def test_endpoint():
    return {"status": "ok", "message": "Server is running", "timestamp": time.time()}


@app.get("/")
async def root():
    return {
        "message": "Anomaly Detection WebSocket Server",
        "connected_clients": len(clients),
        "serial_connected": serial_connected,
        "detector_info": detector.get_model_info()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
