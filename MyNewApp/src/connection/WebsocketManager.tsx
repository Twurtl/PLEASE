// WebsocketManager.tsx
import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Types for our WebSocket data
export interface AnomalyResult {
  anomaly_score: number;
  is_anomaly: boolean;
  confidence: number;
  timestamp: number;
  voltage: number;
  method?: string;
  features?: any;
}

export interface ServerStatus {
  server_status: string;
  connected_clients: number;
  serial_connected: boolean;
  detector_info: any;
  timestamp: number;
}

export interface WebSocketContextType {
  isConnected: boolean;
  latestData: AnomalyResult | null;
  latestRaw: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  serverStatus: ServerStatus | null;
  serialConnected: boolean;
  reconnect: () => void;
  sendMessage: (message: any) => void;
  updateThreshold: (threshold: number) => void;
  requestStatus: () => void;
  reconnectSerial: () => void;
}

// Create the WebSocket context with proper type
const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  serverUrl?: string;
}

export const WebSocketProvider = ({ 
  children, 
  serverUrl = 'ws://localhost:8000/ws',

}: WebSocketProviderProps): JSX.Element => {
  const [isConnected, setIsConnected] = useState(false);
  const [latestData, setLatestData] = useState<AnomalyResult | null>(null);
  const [latestRaw, setLatestRaw] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [serialConnected, setSerialConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      setConnectionStatus('connecting');
      console.log('Connecting to WebSocket:', serverUrl);
      
      // Create new WebSocket connection
      wsRef.current = new WebSocket(serverUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts
        
        // Start ping interval to keep connection alive
        startPingInterval();
        
        // Start periodic status requests
        startStatusInterval();
        
        // Request initial status
        requestStatus();
      };

      wsRef.current.onmessage = (event) => {
        try {
          setLatestRaw(event.data);
          const data = JSON.parse(event.data);
          console.log('Received WebSocket message:', data);
          
          // Handle different message types from the pure WebSocket server
          const messageType = data.type;
          
          switch (messageType) {
            case 'anomaly_data':
              // This is anomaly result data
              console.log('Processing anomaly data:', data);
              setLatestData({
                anomaly_score: data.anomaly_score,
                is_anomaly: data.is_anomaly,
                confidence: data.confidence,
                timestamp: data.timestamp,
                voltage: data.voltage,
                method: data.method,
                features: data.features
              } as AnomalyResult);
              break;
              
            case 'connection_confirmed':
              // Initial connection message with server info
              console.log('Connection confirmed:', data.message);
              if (data.server_info) {
                setSerialConnected(true); // Assume serial is connected on startup
              }
              break;
              
            case 'status_response':
              // Server status response
              console.log('Server status:', data);
              setServerStatus({
                server_status: data.server_status,
                connected_clients: data.connected_clients,
                serial_connected: data.serial_connected,
                detector_info: data.detector_info,
                timestamp: data.timestamp
              });
              setSerialConnected(data.serial_connected);
              break;
              
            case 'threshold_updated':
              console.log('Threshold updated:', data.threshold);
              break;
              
            case 'serial_error':
              console.error('Serial error:', data.message);
              setSerialConnected(false);
              break;
              
            case 'serial_reconnect_attempt':
              console.log('Serial reconnection attempted');
              // Request status after a delay to check if reconnection succeeded
              setTimeout(() => requestStatus(), 2000);
              break;
              
            case 'ping':
              // Respond to server ping
              sendMessage({ type: 'pong', timestamp: Date.now() });
              break;
              
            case 'pong':
              // Handle server pong response
              console.log('Received pong from server');
              break;
              
            default:
              console.log('Unknown message type:', messageType, data);
              break;
          }
          
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          console.error('Raw message:', event.data);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

      wsRef.current.onclose = (event) => {
        console.log(`WebSocket closed: code=${event.code}, reason='${event.reason}'`);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setServerStatus(null);
        setSerialConnected(false);
        stopPingInterval();
        stopStatusInterval();
        
        // Attempt to reconnect if it wasn't a manual close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          scheduleReconnect();
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.log('Max reconnection attempts reached');
          setConnectionStatus('error');
        }
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionStatus('error');
    }
  };

  const startPingInterval = () => {
    stopPingInterval(); // Clear any existing interval
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'ping', timestamp: Date.now() });
      }
    }, 30000); // Ping every 30 seconds
  };

  const stopPingInterval = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const startStatusInterval = () => {
    stopStatusInterval(); // Clear any existing interval
    statusIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        requestStatus();
      }
    }, 60000); // Request status every 60 seconds
  };

  const stopStatusInterval = () => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
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

    stopPingInterval();
    stopStatusInterval();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
  };

  const reconnect = () => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 1000);
  };

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    } else {
      console.warn('WebSocket is not connected. Cannot send message:', message);
    }
  };

  const updateThreshold = (threshold: number) => {
    sendMessage({
      type: 'update_threshold',
      threshold: Math.max(0, Math.min(1, threshold)) // Clamp between 0 and 1
    });
  };

  const requestStatus = () => {
    sendMessage({
      type: 'get_status',
      timestamp: Date.now()
    });
  };

  const reconnectSerial = () => {
    sendMessage({
      type: 'reconnect_serial',
      timestamp: Date.now()
    });
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
    connectionStatus,
    serverStatus,
    serialConnected,
    reconnect,
    sendMessage,
    updateThreshold,
    requestStatus,
    reconnectSerial,
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