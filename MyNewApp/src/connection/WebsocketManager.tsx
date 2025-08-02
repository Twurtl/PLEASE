// WebsocketManager.tsx
import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import io, { Socket } from 'socket.io-client';

// Types for our WebSocket data
export interface MLStatus {
  window_progress: number;
  window_size: number;
  current_window: number;
  status: 'warming_up' | 'ml_ready' | 'error' | 'unknown';
  method: 'ml_model' | 'rule_based' | 'unknown';
}

export interface AnomalyResult {
  anomaly_score: number;
  is_anomaly: boolean;
  confidence: number;
  timestamp: number;
  voltage: number;
  method?: string;
  features?: any;
  ml_status?: MLStatus;
}

export interface ServerStatus {
  server_status: string;
  connected_clients: number;
  serial_connected: boolean;
  detection_running: boolean;
  current_model_id?: string;
  current_session_id?: string;
  detector_info: any;
  timestamp: number;
}

export interface WebSocketContextType {
  isConnected: boolean;
  latestData: AnomalyResult | null;
  latestRaw: string | null;
  lastMessage: any | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  serverStatus: ServerStatus | null;
  serialConnected: boolean;
  detectionRunning: boolean;
  mlStatus: MLStatus | null;
  reconnect: () => void;
  sendMessage: (message: any) => void;
  updateThreshold: (threshold: number) => void;
  requestStatus: () => void;
  connectToArduino: () => void;
  disconnectFromArduino: () => void;
  startDetection: () => void;
  stopDetection: () => void;
  wsLogin: (username: string, password: string) => void;
  wsSelectModel: (modelId: string) => void;
  wsGetModels: () => void;
  wsGetHistory: () => void;
  pauseDataCollection: () => void;
  resumeDataCollection: () => void;
}

// Create the WebSocket context with proper type
const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  serverUrl?: string;
}

export const WebSocketProvider = ({
  children,
  serverUrl = 'http://localhost:8000',
}: WebSocketProviderProps): JSX.Element => {
  const [isConnected, setIsConnected] = useState(false);
  const [latestData, setLatestData] = useState<AnomalyResult | null>(null);
  const [latestRaw, setLatestRaw] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [serialConnected, setSerialConnected] = useState(false);
  const [detectionRunning, setDetectionRunning] = useState(false);
  const [mlStatus, setMlStatus] = useState<MLStatus | null>(null);
  const [lastMessage, setLastMessage] = useState<any | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  const connect = () => {
    if (socketRef.current?.connected) {
      return; // Already connected
    }

    try {
      setConnectionStatus('connecting');
      console.log('Connecting to Socket.IO server:', serverUrl);

      // Create Socket.IO connection with React Native optimized settings
      socketRef.current = io(serverUrl, {
        transports: ['polling', 'websocket'], // Allow both transports
        timeout: 10000,
        forceNew: false, // Reuse existing connection when possible
        reconnection: true, // Enable automatic reconnection
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        autoConnect: true,
        upgrade: true, // Allow upgrading to websocket
      });

      socketRef.current.on('connect', () => {
        console.log('Socket.IO connected successfully');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts

        // Request initial status
        requestStatus();
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('Socket.IO disconnected:', reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setServerStatus(null);
        setSerialConnected(false);
        setDetectionRunning(false);

        // Attempt to reconnect if it wasn't a manual disconnect
        if (reason !== 'io client disconnect' && reconnectAttemptsRef.current < maxReconnectAttempts) {
          scheduleReconnect();
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.log('Max reconnection attempts reached');
          setConnectionStatus('error');
        }
      });

      // Handle connection confirmation
      socketRef.current.on('connection_confirmed', (data: any) => {
        console.log('Connection confirmed:', data);
        if (data.server_info) {
          setSerialConnected(data.server_info.serial_connected || false);
          setDetectionRunning(data.server_info.detection_running || false);
        }
      });

      // Handle anomaly data from Arduino
      socketRef.current.on('arduino_data', (data: any) => {
        console.log('Received arduino data:', data);
        setLatestRaw(JSON.stringify(data));
        setLastMessage(data);

        if (data.prediction) {
          setLatestData({
            anomaly_score: data.prediction.anomaly_score || 0,
            is_anomaly: data.prediction.is_anomaly || false,
            confidence: data.prediction.confidence || 0,
            timestamp: data.timestamp || Date.now(),
            voltage: data.voltage || 0,
            method: data.prediction.method,
            features: data.prediction.features,
            ml_status: data.ml_status
          });

          // Update ML status separately for easy access
          if (data.ml_status) {
            setMlStatus(data.ml_status);
          }
        }
      });

      // Handle raw Arduino data
      socketRef.current.on('arduino_raw_data', (data: any) => {
        console.log('Received raw arduino data:', data);
        setLatestRaw(JSON.stringify(data));

        // Only process data if Arduino is connected and data is recent (within 2 seconds)
        const now = Date.now();
        const dataAge = now - (data.timestamp * 1000); // Convert to milliseconds
        const isRecentData = dataAge < 2000; // 2 seconds threshold

        if (data.voltage !== undefined && serialConnected && isRecentData) {
          const features = data.features || {};
          const rawDataResult: AnomalyResult = {
            anomaly_score: 0,
            is_anomaly: false,
            confidence: 0,
            timestamp: data.timestamp || Date.now(),
            voltage: data.voltage,
            method: 'data_processing',
            features: features,
            ml_status: {
              window_progress: Math.min((features.sample_count || 0) / 50, 1.0),
              window_size: 50,
              current_window: features.sample_count || 0,
              status: (features.sample_count || 0) >= 50 ? 'ml_ready' : 'warming_up',
              method: 'data_processing'
            }
          };
          setLatestData(rawDataResult);
          setLastMessage(data);
        } else if (!isRecentData) {
          console.log(`🕐 Ignoring stale data (${dataAge}ms old)`);
        }
      });

      // Handle server status updates
      socketRef.current.on('status_update', (data: any) => {
        console.log('Server status update:', data);
        updateServerStatus(data);
      });

      socketRef.current.on('status_response', (data: any) => {
        console.log('Status response:', data);
        updateServerStatus(data);
      });

      // Handle Arduino connection status
      socketRef.current.on('arduino_status', (data: any) => {
        console.log('Arduino status:', data);
        setSerialConnected(data.connected || false);
        setLastMessage(data);

        // Clear data when Arduino disconnects
        if (!data.connected) {
          setLatestData(null);
          setLatestRaw('');
          console.log('🧹 Cleared chart data due to Arduino disconnect');
        }
      });

      // Handle detection status
      socketRef.current.on('detection_status', (data: any) => {
        console.log('Detection status:', data);
        setDetectionRunning(data.running || false);
      });

      socketRef.current.on('detection_started', (data: any) => {
        console.log('Detection started:', data);
        setDetectionRunning(true);
      });

      socketRef.current.on('detection_stopped', (data: any) => {
        console.log('Detection stopped:', data);
        setDetectionRunning(false);

        // Show final analysis if available
        if (data.final_analysis) {
          const analysis = data.final_analysis;
          const title = analysis.is_anomalous ? '⚠️ Anomalous Material' : '✅ Normal Material';
          const details = `${analysis.summary}\n\nDetails:\n• Total readings: ${analysis.total_predictions}\n• Anomalous readings: ${analysis.anomaly_count} (${analysis.anomaly_percentage}%)\n• Average confidence: ${(analysis.confidence * 100).toFixed(1)}%`;

          Alert.alert(title, details);
        }
      });

      // Handle ping/pong
      socketRef.current.on('pong', (data: any) => {
        console.log('Received pong from server:', data);
      });

      // Handle WebSocket authentication
      socketRef.current.on('login_success', (data: any) => {
        console.log('WebSocket login successful:', data);
        setLastMessage(data);
      });

      socketRef.current.on('login_error', (data: any) => {
        console.log('WebSocket login error:', data);
        setLastMessage(data);
      });

      socketRef.current.on('model_selected', (data: any) => {
        console.log('✅ Model selected successfully:', data);
        console.log('Model details:', data.model);
        setLastMessage(data);
        // Show user feedback
        Alert.alert('Model Selected', `${data.model.name} is now active for anomaly detection.`);
      });

      socketRef.current.on('model_error', (data: any) => {
        console.log('Model error:', data);
        setLastMessage(data);
      });

      socketRef.current.on('models_response', (data: any) => {
        console.log('Models response:', data);
        setLastMessage(data);
      });

      socketRef.current.on('models_error', (data: any) => {
        console.log('Models error:', data);
        setLastMessage(data);
      });

      socketRef.current.on('detection_auto_stopped', (data: any) => {
        console.log('🛑 Detection auto-stopped:', data);
        setDetectionRunning(false);

        // Show final analysis if available
        if (data.final_analysis) {
          const analysis = data.final_analysis;
          const title = analysis.is_anomalous ? '⚠️ Anomalous Material' : '✅ Normal Material';
          const details = `${analysis.summary}\n\nDetails:\n• Total readings: ${analysis.total_predictions}\n• Anomalous readings: ${analysis.anomaly_count} (${analysis.anomaly_percentage}%)\n• Average confidence: ${(analysis.confidence * 100).toFixed(1)}%`;

          Alert.alert(title, details);
        } else {
          Alert.alert('Material Analysis Stopped', data.message || 'Material analysis stopped automatically');
        }
      });

      socketRef.current.on('data_collection_status', (data: any) => {
        console.log('📊 Data collection status:', data);
        setLastMessage(data);

        // Clear data when data collection is paused
        if (!data.active) {
          setLatestData(null);
          setLatestRaw('');
          console.log('🧹 Cleared chart data due to data collection pause');
        }
      });

      socketRef.current.on('connect_error', (error: any) => {
        console.error('Socket.IO connection error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        setConnectionStatus('error');

        // Schedule reconnect on connection error
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          scheduleReconnect();
        }
      });

      socketRef.current.on('error', (error: any) => {
        console.error('Socket.IO error:', error);
        setConnectionStatus('error');
      });

    } catch (error) {
      console.error('Error creating Socket.IO connection:', error);
      setConnectionStatus('error');
    }
  };

  const updateServerStatus = (data: any) => {
    setServerStatus({
      server_status: data.server_status || 'running',
      connected_clients: data.connected_clients || 0,
      serial_connected: data.serial_connected || false,
      detection_running: data.detection_running || false,
      current_model_id: data.current_model_id,
      current_session_id: data.current_session_id,
      detector_info: data.detector_info || {},
      timestamp: data.timestamp || Date.now()
    });
    setSerialConnected(data.serial_connected || false);
    setDetectionRunning(data.detection_running || false);
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttemptsRef.current += 1;
    console.log(`Scheduling reconnect attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${reconnectDelay}ms`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, reconnectDelay);
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const reconnect = () => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 1000);
  };

  const sendMessage = (message: any) => {
    if (socketRef.current?.connected) {
      try {
        socketRef.current.emit('message', message);
      } catch (error) {
        console.error('Error sending Socket.IO message:', error);
      }
    } else {
      console.warn('Socket.IO is not connected. Cannot send message:', message);
    }
  };

  const updateThreshold = (threshold: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('update_threshold', {
        threshold: Math.max(0, Math.min(1, threshold)) // Clamp between 0 and 1
      });
    }
  };

  const requestStatus = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('get_status', {
        timestamp: Date.now()
      });
    }
  };

  const connectToArduino = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('arduino_connect', {
        timestamp: Date.now()
      });
    }
  };

  const disconnectFromArduino = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('arduino_disconnect', {
        timestamp: Date.now()
      });
    }
  };

  const startDetection = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('start_detection', {
        timestamp: Date.now()
      });
    }
  };

  const stopDetection = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('stop_detection', {
        timestamp: Date.now()
      });
    }
  };

  const wsLogin = (username: string, password: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ws_login', {
        username,
        password,
        timestamp: Date.now()
      });
    }
  };

  const wsSelectModel = (modelId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ws_select_model', {
        model_id: modelId,
        timestamp: Date.now()
      });
    }
  };

  const wsGetModels = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ws_get_models', {
        timestamp: Date.now()
      });
    }
  };

  const pauseDataCollection = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('pause_data_collection');
    }
  };

  const resumeDataCollection = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('resume_data_collection');
    }
  };

  const wsGetHistory = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('get_session_history');
    }
  };

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground, reconnect if needed
        if (!isConnected && connectionStatus !== 'connecting') {
          console.log('App became active, attempting to reconnect...');
          connect();
        }
      } else if (nextAppState === 'background') {
        // App went to background, keep connection for real-time data
        console.log('App went to background, maintaining connection...');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isConnected, connectionStatus]);

  // Initial connection
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [serverUrl]);

  const contextValue: WebSocketContextType = {
    isConnected,
    latestData,
    latestRaw,
    lastMessage,
    connectionStatus,
    serverStatus,
    serialConnected,
    detectionRunning,
    mlStatus,
    reconnect,
    sendMessage,
    updateThreshold,
    requestStatus,
    connectToArduino,
    disconnectFromArduino,
    startDetection,
    stopDetection,
    wsLogin,
    wsSelectModel,
    wsGetModels,
    wsGetHistory,
    pauseDataCollection,
    resumeDataCollection,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom hook for easier access to WebSocket context
export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};