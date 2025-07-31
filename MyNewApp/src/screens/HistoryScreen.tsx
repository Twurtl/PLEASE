import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AnomalyEntry {
  timestamp: string;
  anomaly_score: number;
  confidence: number;
  dominant_frequency: number;
  model_used: string;
  recommendations: string[];
}

const STORAGE_KEY = '@anomaly_history';

const HistoryScreen: React.FC = () => {
  const [history, setHistory] = useState<AnomalyEntry[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed: AnomalyEntry[] = JSON.parse(raw);
          setHistory(parsed.reverse());
        } catch (e) {
          console.error('Failed to parse anomaly history:', e);
        }
      }
    };
    fetchHistory();
  }, []);

  const renderItem = ({ item }: { item: AnomalyEntry }) => (
    <View style={styles.card}>
      <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
      <Text>Anomaly Score: {item.anomaly_score.toFixed(2)}</Text>
      <Text>Confidence: {(item.confidence * 100).toFixed(1)}%</Text>
      <Text>Dominant Freq: {item.dominant_frequency.toFixed(1)} Hz</Text>
      <Text>Model Used: {item.model_used}</Text>
      <Text>Recommendations: {item.recommendations.join(', ')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Anomaly History</Text>
      <FlatList
        data={history}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  timestamp: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
});

export default HistoryScreen;
