import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useWebSocket } from '../connection/WebsocketManager';
import MLStatusPanel from '../components/MLStatusPanel';
import LiveChart from '../components/LiveChart';

const HomeScreen = () => {
  const {
    sendMessage,
    lastMessage,
    isConnected,
    mlStatus,
    latestData,
    connectionStatus
  } = useWebSocket();
  const [detectionRunning, setDetectionRunning] = useState(false);
  const [dataHistory, setDataHistory] = useState<any[]>([]);

  // Update data history when new data arrives
  React.useEffect(() => {
    if (latestData) {
      setDataHistory(prev => [...prev, latestData].slice(-100)); // Keep last 100 readings
    }
  }, [latestData]);

  const toggleDetection = () => {
    if (detectionRunning) {
      sendMessage({ type: 'stop_detection' });
    } else {
      sendMessage({ type: 'start_detection' });
    }
    setDetectionRunning(!detectionRunning);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Anomaly Detection</Text>

      {/* Connection Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
        </Text>
      </View>

      {/* ML Status Panel */}
      <MLStatusPanel mlStatus={mlStatus || undefined} isConnected={isConnected} />

      {/* Detection Control */}
      <TouchableOpacity
        style={[styles.button, detectionRunning ? styles.stop : styles.start]}
        onPress={toggleDetection}
        disabled={!isConnected}
      >
        <Text style={styles.buttonText}>
          {detectionRunning ? 'Stop Detection' : 'Start Detection'}
        </Text>
      </TouchableOpacity>

      {/* Live Chart */}
      {dataHistory.length > 0 && (
        <View style={styles.chartContainer}>
          <LiveChart data={dataHistory} />
        </View>
      )}

      {/* Debug Info */}
      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>Latest Server Message:</Text>
        <Text style={styles.logText}>
          {lastMessage ? JSON.stringify(lastMessage, null, 2) : 'No messages yet.'}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  statusContainer: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 10
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  start: { backgroundColor: '#28a745' },
  stop: { backgroundColor: '#dc3545' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  chartContainer: {
    marginVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10
  },
  logContainer: { padding: 10, backgroundColor: '#f9f9f9', borderRadius: 8 },
  logTitle: { fontWeight: 'bold', marginBottom: 4 },
  logText: { fontFamily: 'Courier', fontSize: 12, color: '#333' },
});

export default HomeScreen;
