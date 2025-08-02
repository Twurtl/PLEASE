// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { useAuth } from '../services/AuthService';
import ApiService from '../services/ApiService';

interface LoginScreenProps {
  onLoginSuccess: (modelId: string, modelName: string, isGuest?: boolean) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [showModelSelection, setShowModelSelection] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isGuestMode, setIsGuestMode] = useState(false);

  const { login, register } = useAuth();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(username.trim(), password.trim());
      if (success) {
        // Get user models after successful login
        const models = await ApiService.get('/models');
        setAvailableModels(models);
        setShowModelSelection(true);
        setIsGuestMode(false);
      } else {
        Alert.alert('Error', 'Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const success = await register(username.trim(), email.trim(), password.trim());
      if (success) {
        Alert.alert('Success', 'Account created successfully!', [
          { text: 'OK', onPress: () => setIsRegisterMode(false) }
        ]);
      } else {
        Alert.alert('Error', 'Registration failed. Username or email may already exist.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    try {
      // Get preset models for guest users
      const response = await fetch('http://localhost:8000/api/guest/models');
      if (response.ok) {
        const models = await response.json();
        setAvailableModels(models.filter(model => model.is_preset));
        setShowModelSelection(true);
        setIsGuestMode(true);
      } else {
        Alert.alert('Error', 'Failed to load guest models');
      }
    } catch (error) {
      console.error('Guest login error:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleModelSelection = (model) => {
    setSelectedModel(model);
  };

  const proceedWithModel = () => {
    if (selectedModel) {
      onLoginSuccess(selectedModel.id, selectedModel.name, isGuestMode);
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setEmail('');
    setShowModelSelection(false);
    setSelectedModel(null);
    setAvailableModels([]);
    setIsGuestMode(false);
  };

  if (showModelSelection) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>
            {isGuestMode ? 'Select a Preset Model' : 'Select a Model'}
          </Text>
          
          {isGuestMode && (
            <View style={styles.guestBanner}>
              <Text style={styles.guestBannerText}>
                🎯 Guest Mode - Using Preset Models Only
              </Text>
              <Text style={styles.guestBannerSubtext}>
                Create an account to upload and use your own models
              </Text>
            </View>
          )}

          <View style={styles.modelsList}>
            {availableModels.map((model) => (
              <TouchableOpacity
                key={model.id}
                style={[
                  styles.modelCard,
                  selectedModel?.id === model.id && styles.selectedModelCard
                ]}
                onPress={() => handleModelSelection(model)}
              >
                <View style={styles.modelHeader}>
                  <Text style={styles.modelName}>{model.name}</Text>
                  <View style={[styles.modelBadge, model.is_preset && styles.presetBadge]}>
                    <Text style={styles.modelBadgeText}>
                      {model.is_preset ? 'PRESET' : 'CUSTOM'}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.modelMaterial}>
                  Material: {model.material_type.toUpperCase()}
                </Text>
                
                {model.accuracy && (
                  <Text style={styles.modelAccuracy}>
                    Accuracy: {(model.accuracy * 100).toFixed(1)}%
                  </Text>
                )}
                
                {model.description && (
                  <Text style={styles.modelDescription}>{model.description}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={resetForm}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                !selectedModel && styles.disabledButton
              ]}
              onPress={proceedWithModel}
              disabled={!selectedModel}
            >
              <Text style={styles.primaryButtonText}>
                {isGuestMode ? 'Start as Guest' : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Anomaly Detection</Text>
            <Text style={styles.subtitle}>
              {isRegisterMode ? 'Create Account' : 'Sign In'}
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {isRegisterMode && (
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={isRegisterMode ? handleRegister : handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isRegisterMode ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                setIsRegisterMode(!isRegisterMode);
                setUsername('');
                setPassword('');
                setEmail('');
              }}
            >
              <Text style={styles.secondaryButtonText}>
                {isRegisterMode 
                  ? 'Already have an account? Sign In' 
                  : 'Need an account? Register'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.guestButton]}
            onPress={handleGuestLogin}
            disabled={guestLoading}
          >
            {guestLoading ? (
              <ActivityIndicator color="#666" />
            ) : (
              <>
                <Text style={styles.guestButtonText}>Continue as Guest</Text>
                <Text style={styles.guestButtonSubtext}>
                  Use preset models without an account
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Guest users can access preset trained models for immediate testing.
              Create an account to upload custom models and save session history.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  guestButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  guestButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  guestButtonSubtext: {
    color: '#666',
    fontSize: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#666',
    fontSize: 14,
  },
  footer: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Model selection styles
  guestBanner: {
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  guestBannerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  guestBannerSubtext: {
    fontSize: 12,
    color: '#666',
  },
  modelsList: {
    marginBottom: 20,
  },
  modelCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedModelCard: {
    borderColor: '#007AFF',
    borderWidth: 2,
    backgroundColor: '#F8FBFF',
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  modelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  modelBadge: {
    backgroundColor: '#666',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  presetBadge: {
    backgroundColor: '#007AFF',
  },
  modelBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modelMaterial: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modelAccuracy: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
    marginBottom: 4,
  },
  modelDescription: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default LoginScreen;