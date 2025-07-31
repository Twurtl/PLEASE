import React, { useState, useContext, useEffect } from 'react';
import { View, Text, Button, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWebSocket, AnomalyResult } from '../connection/WebsocketManager';


const TrainingScreen = () => {
  const { latestData } = useWebSocket();
  const [trainingSet, setTrainingSet] = useState<AnomalyResult[]>([]);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (recording && latestData) {
      setTrainingSet(prev => [...prev, latestData]);
    }
  }, [latestData, recording]);

  const saveDataset = async () => {
    setLoading(true);
    try {
      const existing = await AsyncStorage.getItem('@training_dataset');
      const parsed = existing ? JSON.parse(existing) : [];
      const updated = [...parsed, ...trainingSet];
      await AsyncStorage.setItem('@training_dataset', JSON.stringify(updated));
      setTrainingSet([]);
    } catch (e) {
      console.error('Failed to save dataset:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Training Dataset Collection</Text>

      <Button
        title={recording ? 'Stop Recording' : 'Start Recording'}
        onPress={() => setRecording(prev => !prev)}
      />

      <Button
        title="Save Dataset"
        onPress={saveDataset}
        disabled={trainingSet.length === 0 || loading}
      />

      {loading && <ActivityIndicator style={{ marginTop: 10 }} />}
      <Text style={styles.count}>Samples Collected: {trainingSet.length}</Text>

      <FlatList
        data={trainingSet}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <Text style={styles.item}>
            {new Date(item.timestamp || Date.now()).toLocaleTimeString()} – Voltage: {item.voltage.toFixed(3)} V
          </Text>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  count: { marginVertical: 10, textAlign: 'center' },
  item: { fontSize: 12, color: 'gray', marginBottom: 4 }
});

export default TrainingScreen;
