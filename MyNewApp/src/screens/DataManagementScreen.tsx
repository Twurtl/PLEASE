import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@training_dataset';

const DataManagementScreen = () => {
  const [data, setData] = useState<string[]>([]);

  const load = async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      setData(JSON.parse(stored));
    }
  };

  const clear = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setData([]);
  };

  const confirmClear = () => {
    Alert.alert('Clear All?', 'Are you sure you want to delete all training data?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: clear },
    ]);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Training Data</Text>
      <Button title="Refresh" onPress={load} />
      <Button title="Clear All" onPress={confirmClear} color="red" />
      <FlatList
        data={data}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => <Text style={styles.item}>{item.slice(0, 60)}...</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  item: { fontSize: 12, color: 'gray', marginBottom: 4 }
});

export default DataManagementScreen;
