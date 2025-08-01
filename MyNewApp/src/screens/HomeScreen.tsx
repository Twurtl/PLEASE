import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useWebSocket, AnomalyResult } from '../connection/WebsocketManager';
import LiveChart from '../components/LiveChart';

const HomeScreen = () => {
  const { isConnected, latestData, connectionStatus, reconnect, updateThreshold } = useWebSocket();
  const [dataHistory, setDataHistory] = useState<AnomalyResult[]>([]);
  const [stats, setStats] = useState({
    totalReadings: 0,
    anomaliesDetected: 0,
    averageVoltage: 0,
    minVoltage: Infinity,
    maxVoltage: -Infinity,
    lastUpdateTime: null as Date | null,
    sessionStartTime: new Date(),
  });

  // Update data history when new data arrives
  useEffect(() => {
    if (latestData) {
      setDataHistory(prev => {
        const newHistory = [...prev, latestData];
        // Keep only last 200 readings for performance
        return newHistory.slice(-200);
      });

      // Update stats
      setStats(prev => ({
        totalReadings: prev.totalReadings + 1,
        anomaliesDetected: prev.anomaliesDetected + (latestData.is_anomaly ? 1 : 0),
        averageVoltage: ((prev.averageVoltage * prev.totalReadings) + latestData.voltage) / (prev.totalReadings + 1),
        minVoltage: Math.min(prev.minVoltage, latestData.voltage),
        maxVoltage: Math.max(prev.maxVoltage, latestData.voltage),
        lastUpdateTime: new Date(),
        sessionStartTime: prev.sessionStartTime,
      }));
    }
  }, [latestData]);

  const handleReconnect = () => {
    Alert.alert(
      'Reconnect WebSocket',
      'Are you sure you want to reconnect to the server?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reconnect', onPress: reconnect },
      ]
    );
  };

  const handleThresholdUpdate = () => {
    Alert.prompt(
      'Update Anomaly Threshold/Sensitivity',
      'Enter new threshold (0.0 - 1.0)',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Update', 
          onPress: (value) => {
            const threshold = parseFloat(value || '0.5');
            if (isNaN(threshold) || threshold < 0 || threshold > 1) {
              Alert.alert('Invalid Threshold', 'Please enter a value between 0.0 and 1.0');
              return;
            }
            updateThreshold(threshold);
          }
        },
      ],
      'plain-text',
      '0.5'
    );
  };

  const resetStats = () => {
    Alert.alert(
      'Reset Statistics',
      'Are you sure you want to reset all session statistics?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          onPress: () => {
            setStats({
              totalReadings: 0,
              anomaliesDetected: 0,  
              averageVoltage: 0,
              minVoltage: Infinity,
              maxVoltage: -Infinity,
              lastUpdateTime: null,
              sessionStartTime: new Date(),
            });
            setDataHistory([]);
          }
        },
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

  const formatDuration = (startTime: Date, endTime: Date) => {
    const diff = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Anomaly Detection Dashboard</Text>
      
      {/* Connection Status */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.status}>{getStatusText()}</Text>
        {!isConnected && (
          <TouchableOpacity style={styles.actionButton} onPress={handleReconnect}>
            <Text style={styles.actionButtonText}>Reconnect</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButton} onPress={handleThresholdUpdate}>
          <Text style={styles.actionButtonText}>Threshold</Text>
        </TouchableOpacity>
      </View>

      {/* Current Reading */}
      {latestData ? (
        <View style={styles.currentReadingContainer}>
          <Text style={styles.sectionTitle}>Current Reading</Text>
          <View style={styles.readingGrid}>
            <View style={styles.readingItem}>
              <Text style={styles.readingLabel}>Voltage</Text>
              <Text style={styles.readingValue}>{latestData.voltage.toFixed(3)} V</Text>
            </View>
            <View style={styles.readingItem}>
              <Text style={styles.readingLabel}>Status</Text>
              <Text style={[
                styles.readingValue, 
                { color: latestData.is_anomaly ? '#F44336' : '#4CAF50' }
              ]}>
                {latestData.is_anomaly ? '⚠️ ANOMALY' : '✅ Normal'}
              </Text>
            </View>
          </View>
          
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Anomaly Score</Text>
              <Text style={styles.metricValue}>
                {(latestData.anomaly_score * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Confidence</Text>
              <Text style={styles.metricValue}>
                {(latestData.confidence * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Method</Text>
              <Text style={styles.metricValue}>
                {latestData.method || 'N/A'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.timestamp}>
            Last Update: {stats.lastUpdateTime?.toLocaleTimeString() || 'N/A'}
          </Text>
        </View>
      ) : (
        <View style={styles.currentReadingContainer}>
          <Text style={styles.sectionTitle}>Waiting for Data...</Text>
          <Text style={styles.noDataText}>
            {isConnected ? 'Connected but no data received yet' : 'Not connected to server'}
          </Text>
        </View>
      )}

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statsHeader}>
          <Text style={styles.sectionTitle}>Session Statistics</Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetStats}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Readings</Text>
            <Text style={styles.statValue}>{stats.totalReadings}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Anomalies</Text>
            <Text style={[styles.statValue, { color: stats.anomaliesDetected > 0 ? '#F44336' : '#4CAF50' }]}>
              {stats.anomaliesDetected}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Anomaly Rate</Text>
            <Text style={styles.statValue}>
              {stats.totalReadings > 0 ? 
                ((stats.anomaliesDetected / stats.totalReadings) * 100).toFixed(1) + '%' : '0%'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Avg Voltage</Text>
            <Text style={styles.statValue}>{stats.averageVoltage.toFixed(3)} V</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Min Voltage</Text>
            <Text style={styles.statValue}>
              {stats.minVoltage !== Infinity ? stats.minVoltage.toFixed(3) + ' V' : 'N/A'}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Max Voltage</Text>
            <Text style={styles.statValue}>
              {stats.maxVoltage !== -Infinity ? stats.maxVoltage.toFixed(3) + ' V' : 'N/A'}
            </Text>
          </View>
        </View>
        
        <Text style={styles.sessionDuration}>
          Session Duration: {formatDuration(stats.sessionStartTime, stats.lastUpdateTime || new Date())}
        </Text>
      </View>

      {/* Live Chart */}
      <View style={styles.chartContainer}>
        <LiveChart data={dataHistory} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
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
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    flex: 1,
  },
  actionButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  currentReadingContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  readingGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  readingItem: {
    flex: 1,
    alignItems: 'center',
  },
  readingLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  readingValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  statsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF3B30',
    borderRadius: 6,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    marginBottom: 12,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  sessionDuration: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default HomeScreen;