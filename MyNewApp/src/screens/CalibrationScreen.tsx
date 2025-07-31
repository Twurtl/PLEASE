import React, { useEffect, useState, useContext } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useWebSocket } from '../connection/WebsocketManager';
import { MaterialContext } from '../services/MaterialProfileService';

const STEPS = [
  'Place the sensor and wait 10 seconds for ambient baseline...',
  'Tap 20 times gently on various points...',
  'Processing calibration...'
];

const CalibrationScreen = () => {
  const { latestData } = useWebSocket();
  const { profile, updateProfile } = useContext(MaterialContext);
  const [step, setStep] = useState(0);
  const [samples, setSamples] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!latestData || latestData.voltage === undefined) return;

    if (step === 0 || step === 1) {
      setSamples((prev) => [...prev, latestData.voltage]);
    }
  }, [latestData, step]);

  const advanceStep = async () => {
    if (step === 1) {
      setLoading(true);

      const offset = samples.reduce((sum, v) => sum + v, 0) / samples.length;
      const samplingRateHz = profile.samplingRateHz || 5000;

      updateProfile({
        offset,
        calibrationParams: {
          offset,
          samplingRateHz,
          collected: samples.length,
        }
      });

      setLoading(false);
    }

    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Calibration</Text>
      <Text style={styles.step}>{STEPS[step]}</Text>

      {loading && <ActivityIndicator size="large" />}

      {!loading && step < 2 && (
        <Button title="Next" onPress={advanceStep} />
      )}

      {step === 2 && !loading && (
        <Text style={{ color: 'green', marginTop: 16 }}>
          Calibration complete ✅
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20
  },
  step: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20
  }
});

export default CalibrationScreen;
