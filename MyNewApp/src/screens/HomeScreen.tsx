import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useWebSocket, AnomalyResult } from '../connection/WebsocketManager';
import LiveChart from '../components/LiveChart';

const HomeScreen = () => {
  const { isConnected, latestData, connectionStatus, reconnect, sendMessage } = useWebSocket();
  const [dataHistory, setDataHistory] = useState<AnomalyResult[]>([]);
  const [stats, setStats] = useState({
    totalReadings: 0,
    anomaliesDetected: 0,
    averageVoltage: 0,
    lastUpdateTime: null as Date | null,
  });

  // Update data history when new data arrives
  useEffect(() => {
    if (latestData) {
      setDataHistory(prev => {
        const newHistory = [...prev, latestData];
        // Keep only last 100 readings for performance
        return newHistory.slice(-100);
      });

      // Update stats
      setStats(prev => ({
        totalReadings: prev.totalReadings + 1,
        anomaliesDetected: prev.anomaliesDetected + (latestData.is_anomaly ? 1 : 0),
        averageVoltage: ((prev.averageVoltage * prev.totalReadings) + latestData.voltage) / (prev.totalReadings + 1),
        lastUpdateTime: new Date(),
      }));
    }
  }, [latestData]);

  const handleReconnect = () => {
    Alert.alert(
      'Reconnect WebSocket',
      'Are you sure you want to reconnect?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reconnect', onPress: reconnect },
      ]
    );
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#4CAF50';
      case 'connecting':
        return '#FF9800';
      case 'error':
        return '#F44336';
      case 'disconnected':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection Error';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Anomaly Detection Dashboard</Text>
      
      {/* Connection Status */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.status}>{getStatusText()}</Text>
        {!isConnected && (
          <TouchableOpacity style={styles.reconnectButton} onPress={handleReconnect}>
            <Text style={styles.reconnectText}>Reconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Current Reading */}
      {latestData && (
        <View style={styles.currentReadingContainer}>
          <Text style={styles.sectionTitle}>Current Reading</Text>
          <Text style={styles.metric}>
            Voltage: {latestData.voltage.toFixed(3)} V
          </Text>
          <Text style={[
            styles.metric, 
            { color: latestData.is_anomaly ? '#F44336' : '#4CAF50' }
          ]}>
            Status: {latestData.is_anomaly ? '⚠️ ANOMALY DETECTED' : '✅ Normal'}
          </Text>
          <Text style={styles.subMetric}>
            Anomaly Score: {(latestData.anomaly_score * 100).toFixed(1)}%
          </Text>
          <Text style={styles.subMetric}>
            Confidence: {(latestData.confidence * 100).toFixed(1)}%
          </Text>
          <Text style={styles.subMetric}>
            Last Update: {stats.lastUpdateTime?.toLocaleTimeString() || 'N/A'}
          </Text>
        </View>
      )}

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Session Statistics</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statItem}>
            Total Readings: {stats.totalReadings}
          </Text>
          <Text style={styles.statItem}>
            Anomalies: {stats.anomaliesDetected}
          </Text>
        </View>
        <Text style={styles.statItem}>
          Average Voltage: {stats.averageVoltage.toFixed(3)} V
        </Text>
        <Text style={styles.statItem}>
          Anomaly Rate: {stats.totalReadings > 0 ? 
            ((stats.anomaliesDetected / stats.totalReadings) * 100).toFixed(1) : 0}%
        </Text>
      </View>

      {/* Live Chart */}
      <View style={styles.chartContainer}>
        <LiveChart data={dataHistory} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  reconnectButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  reconnectText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  currentReadingContainer: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  metric: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  subMetric: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
    color: '#666',
  },
  statsContainer: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  chartContainer: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 8,
  },
});

export default HomeScreen;