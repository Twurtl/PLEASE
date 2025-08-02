import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useWebSocket } from '../connection/WebsocketManager';

interface SessionEntry {
  id: string;
  timestamp: string;
  model_name: string;
  stop_reason: string;
  analysis: {
    decision: string;
    summary: string;
    total_predictions: number;
    anomaly_count: number;
    anomaly_percentage: number;
    confidence: number;
    is_anomalous: boolean;
  };
  chart_data: Array<{
    voltage: number;
    timestamp: number;
    is_anomaly: boolean;
    confidence: number;
    anomaly_score: number;
  }>;
}

const HistoryScreen: React.FC = () => {
  const [history, setHistory] = useState<SessionEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { lastMessage, wsGetHistory } = useWebSocket();

  const fetchHistory = () => {
    console.log('Fetching session history...');
    wsGetHistory();
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Listen for history responses
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'history_response') {
        setHistory(lastMessage.sessions || []);
        setRefreshing(false);
      } else if (lastMessage.type === 'history_error') {
        Alert.alert('Error', lastMessage.error || 'Failed to load history');
        setRefreshing(false);
      }
    }
  }, [lastMessage]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const renderItem = ({ item }: { item: SessionEntry }) => {
    const analysis = item.analysis;
    const isAnomalous = analysis.is_anomalous;

    return (
      <TouchableOpacity style={styles.card} onPress={() => showSessionDetails(item)}>
        <View style={styles.cardHeader}>
          <Text style={[styles.decision, { color: isAnomalous ? '#FF3B30' : '#34C759' }]}>
            {isAnomalous ? '⚠️ ANOMALOUS' : '✅ NORMAL'}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>

        <Text style={styles.summary}>{analysis.summary}</Text>

        <View style={styles.stats}>
          <Text style={styles.statText}>Model: {item.model_name}</Text>
          <Text style={styles.statText}>
            Readings: {analysis.total_predictions} ({analysis.anomaly_percentage}% anomalous)
          </Text>
          <Text style={styles.statText}>
            Confidence: {(analysis.confidence * 100).toFixed(1)}%
          </Text>
          <Text style={styles.statText}>
            Stop Reason: {item.stop_reason.replace('_', ' ')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const showSessionDetails = (session: SessionEntry) => {
    const analysis = session.analysis;
    const details = `${analysis.summary}\n\nDetailed Statistics:\n• Total readings analyzed: ${analysis.total_predictions}\n• Anomalous readings: ${analysis.anomaly_count} (${analysis.anomaly_percentage}%)\n• Average confidence: ${(analysis.confidence * 100).toFixed(1)}%\n• Model used: ${session.model_name}\n• Data points in chart: ${session.chart_data.length}\n• Session ended: ${session.stop_reason.replace('_', ' ')}`;

    Alert.alert(
      analysis.is_anomalous ? '⚠️ Anomalous Material' : '✅ Normal Material',
      details,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Material Analysis History</Text>
      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No material analysis sessions yet</Text>
          <Text style={styles.emptySubtext}>Complete a material analysis to see history here</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1C1C1E',
  },
  list: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  decision: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 14,
    color: '#8E8E93',
  },
  summary: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 12,
    lineHeight: 20,
  },
  stats: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 8,
  },
  statText: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default HistoryScreen;
