import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert
} from 'react-native';
import CalibrationUtils from '../utils/CalibrationUtils';

const CalibrationPanel: React.FC = () => {
  const [gain, setGain] = useState<number>(1.0);
  const [offset, setOffset] = useState<number>(0.0);

  const onApply = () => {
    CalibrationUtils.applyCalibrationParams({ gain, offset });
    Alert.alert(
      'Calibration Applied',
      `Gain: ${gain.toFixed(2)}\nOffset: ${offset.toFixed(2)}`
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calibration Panel</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Gain</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={gain.toString()}
          onChangeText={(text) => setGain(parseFloat(text) || 0)}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Offset</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={offset.toString()}
          onChangeText={(text) => setOffset(parseFloat(text) || 0)}
        />
      </View>

      <Button title="Apply Calibration" onPress={onApply} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    flex: 1
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24
  },
  inputGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 16,
    marginBottom: 4
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    fontSize: 16
  }
});

export default CalibrationPanel;
