import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useWebSocket, AnomalyResult } from '../connection/WebsocketManager';
import LiveChart from '../components/LiveChart';
import MLStatusPanel from '../components/MLStatusPanel';
import ModelManager from '../components/ModelManager';

const HomeScreen = () => {
  const {
    isConnected,
    latestData,
    connectionStatus,
    serialConnected,
    detectionRunning,
    reconnect,
    updateThreshold,
    connectToArduino,
    disconnectFromArduino,
    startDetection,
    stopDetection,
    wsSelectModel,
    mlStatus,
    pauseDataCollection,
    resumeDataCollection,
    lastMessage
  } = useWebSocket();
  const [dataHistory, setDataHistory] = useState<AnomalyResult[]>([]);
  const [dataCollectionActive, setDataCollectionActive] = useState(true);
  const [stats, setStats] = useState({
    totalReadings: 0,
    anomaliesDetected: 0,
    averageVoltage: 0,
    minVoltage: Infinity,
    maxVoltage: -Infinity,
    lastUpdateTime: null as Date | null,
    sessionStartTime: new Date(),
  });

  // Listen for backend status updates
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'data_collection_status') {
        setDataCollectionActive(lastMessage.active);
        // Clear chart history when data collection is paused
        if (!lastMessage.active) {
          setDataHistory([]);
          console.log('🧹 Cleared data history due to data collection pause');
        }
      } else if (lastMessage.type === 'detection_auto_stopped') {
        // Detection was auto-stopped, the WebSocket manager already handles this
        console.log('Detection auto-stopped:', lastMessage.reason);
      } else if (lastMessage.type === 'arduino_status' && !lastMessage.connected) {
        // Clear chart history when Arduino disconnects
        setDataHistory([]);
        console.log('🧹 Cleared data history due to Arduino disconnect');
      }
    }
  }, [lastMessage]);

  // Update data history when new data arrives
  useEffect(() => {
    if (latestData) {
      console.log('New data received:', latestData);
      setDataHistory(prev => {
        const newHistory = [...prev, latestData];
        // Keep only last 200 readings for performance
        const slicedHistory = newHistory.slice(-200);
        console.log('Data history updated, length:', slicedHistory.length);
        return slicedHistory;
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

  const handleArduinoConnection = () => {
    if (serialConnected) {
      Alert.alert(
        'Disconnect Arduino',
        'Are you sure you want to disconnect from Arduino?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', onPress: disconnectFromArduino },
        ]
      );
    } else {
      connectToArduino();
    }
  };

  const handleDetectionToggle = () => {
    if (!isConnected) {
      Alert.alert('Error', 'Please connect to the server first');
      return;
    }

    if (!serialConnected) {
      Alert.alert('Error', 'Please connect to Arduino first');
      return;
    }

    if (detectionRunning) {
      Alert.alert(
        'Stop Reading',
        'Are you sure you want to stop data reading?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Stop', onPress: stopDetection },
        ]
      );
    } else {
      startDetection();
    }
  };

  const handleModelSelect = (modelId: string) => {
    wsSelectModel(modelId);
    Alert.alert('Model Selected', 'ML model has been updated for anomaly detection.');
  };

  const handlePauseData = () => {
    pauseDataCollection();
    setDataCollectionActive(false);
    Alert.alert('Data Paused', 'All Arduino data collection has been paused.');
  };

  const handleResumeData = () => {
    resumeDataCollection();
    setDataCollectionActive(true);
    Alert.alert('Data Resumed', 'Arduino data collection has been resumed.');
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

      {/* Arduino & Data Reading Controls */}
      <View style={styles.controlsContainer}>
        <Text style={styles.sectionTitle}>Hardware & Data Reading</Text>

        {/* Arduino Connection */}
        <View style={styles.controlRow}>
          <View style={styles.controlInfo}>
            <Text style={styles.controlLabel}>Arduino Connection</Text>
            <Text style={[styles.controlStatus, {
              color: serialConnected ? '#4CAF50' : '#F44336'
            }]}>
              {serialConnected ? '✅ Connected' : '❌ Disconnected'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.controlButton, {
              backgroundColor: serialConnected ? '#F44336' : '#4CAF50'
            }]}
            onPress={handleArduinoConnection}
          >
            <Text style={styles.controlButtonText}>
              {serialConnected ? 'Disconnect' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Data Reading Control */}
        <View style={styles.controlRow}>
          <View style={styles.controlInfo}>
            <Text style={styles.controlLabel}>Data Reading</Text>
            <Text style={[styles.controlStatus, {
              color: detectionRunning ? '#4CAF50' : '#FF9800'
            }]}>
              {detectionRunning ? '📊 Reading' : '⏸️ Stopped'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.controlButton, {
              backgroundColor: detectionRunning ? '#F44336' : '#4CAF50',
              opacity: (!isConnected || !serialConnected) ? 0.5 : 1
            }]}
            onPress={handleDetectionToggle}
            disabled={!isConnected || !serialConnected}
          >
            <Text style={styles.controlButtonText}>
              {detectionRunning ? 'Stop Reading' : 'Start Reading'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Data Collection Control */}
        <View style={styles.controlRow}>
          <View style={styles.controlInfo}>
            <Text style={styles.controlLabel}>Data Collection</Text>
            <Text style={[styles.controlStatus, {
              color: dataCollectionActive ? '#4CAF50' : '#FF9800'
            }]}>
              {dataCollectionActive ? '📡 Active' : '⏸️ Paused'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.controlButton, {
              backgroundColor: dataCollectionActive ? '#FF9800' : '#4CAF50',
              opacity: !serialConnected ? 0.5 : 1
            }]}
            onPress={dataCollectionActive ? handlePauseData : handleResumeData}
            disabled={!serialConnected}
          >
            <Text style={styles.controlButtonText}>
              {dataCollectionActive ? 'Pause Data' : 'Resume Data'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Info */}
        <View style={styles.statusInfo}>
          <Text style={styles.statusInfoText}>
            💡 Connect Arduino first, then start reading to begin collecting data
          </Text>
          <Text style={styles.statusInfoText}>
            🔍 Analysis examines the complete material and provides a final verdict on structural integrity
          </Text>
          <Text style={styles.statusInfoText}>
            ⏱️ Auto-stops after 30 seconds or 50 ML predictions (whichever comes first)
          </Text>
        </View>
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

      {/* ML Status Panel */}
      <MLStatusPanel mlStatus={mlStatus || undefined} isConnected={isConnected} />

      {/* Model Selection */}
      <ModelManager onModelSelect={handleModelSelect} />

      {/* Live Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.sectionTitle}>Live Data Chart</Text>
        <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          Data points: {dataHistory.length} | Last update: {stats.lastUpdateTime?.toLocaleTimeString() || 'None'}
        </Text>
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
  controlsContainer: {
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
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  controlInfo: {
    flex: 1,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  controlStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  controlButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  statusInfoText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default HomeScreen;