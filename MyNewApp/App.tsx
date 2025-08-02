import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import CalibrationScreen from './src/screens/CalibrationScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import DataManagementScreen from './src/screens/DataManagementScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import LoginScreen from './src/screens/LoginScreen';
import { WebSocketProvider } from './src/connection/WebsocketManager';
import { AuthProvider } from './src/services/AuthService'; // Add this import

const MainApp = () => {
  const [currentScreen, setCurrentScreen] = useState<'Home' | 'Calibration' | 'Training' | 'Manage Data' | 'History'>('Home');

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Home':
        return <HomeScreen />;
      case 'Calibration':
        return <CalibrationScreen />;
      case 'Training':
        return <TrainingScreen />;
      case 'Manage Data':
        return <DataManagementScreen />;
      case 'History':
        return <HistoryScreen />;
      default:
        return <HomeScreen />;
    }
  };

  const tabs = [
    { name: 'Home', label: 'Home' },
    { name: 'Calibration', label: 'Calibration' },
    { name: 'Training', label: 'Training' },
    { name: 'Manage Data', label: 'Data' },
    { name: 'History', label: 'History' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>{renderScreen()}</View>
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.name}
            style={[
              styles.tab,
              currentScreen === tab.name && styles.activeTab,
            ]}
            onPress={() => setCurrentScreen(tab.name as any)}
          >
            <Text
              style={[
                styles.tabText,
                currentScreen === tab.name && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const App = () => {
  const [modelSelected, setModelSelected] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null);

  const handleLoginSuccess = (modelId: string, modelName: string) => {
    setSelectedModelId(modelId);
    setSelectedModelName(modelName);
    setModelSelected(true);
  };

  const serverUrl = 'http://localhost:8000'; // Socket.IO server URL

  return (
    <AuthProvider>
      <WebSocketProvider serverUrl={serverUrl}>
        {modelSelected ? <MainApp /> : <LoginScreen onSuccess={handleLoginSuccess} useWebSocketAuth={true} />}
      </WebSocketProvider>
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default App;