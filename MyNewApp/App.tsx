// App.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import CalibrationScreen from './src/screens/CalibrationScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import DataManagementScreen from './src/screens/DataManagementScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import LoginScreen from './src/screens/LoginScreen';

import { WebSocketProvider } from './src/connection/WebsocketManager';
import { AuthProvider, useAuth } from './src/services/AuthService';

const MainApp = () => {
  const [currentScreen, setCurrentScreen] = useState<'Home' | 'Calibration' | 'Training' | 'Manage Data' | 'History'>('Home');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  
  const { user, logout } = useAuth();

  const renderScreen = () => {
    const screenProps = {
      selectedModelId,
      selectedModelName,
      isGuestMode,
    };

    switch (currentScreen) {
      case 'Home':
        return <HomeScreen {...screenProps} />;
      case 'Calibration':
        return <CalibrationScreen {...screenProps} />;
      case 'Training':
        // Only show training screen for logged-in users
        return isGuestMode ? 
          <GuestRestrictedScreen feature="Training" /> : 
          <TrainingScreen {...screenProps} />;
      case 'Manage Data':
        // Only show data management for logged-in users
        return isGuestMode ? 
          <GuestRestrictedScreen