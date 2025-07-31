import BluetoothService from './BluetoothService';
import TrainingDataCollector from '../utils/TrainingDataCollector';

class TrainingDataService {
  static async collectTrainingData(label: string, material: string = 'concrete'): Promise<void> {
    if (!BluetoothService.isConnected()) {
      throw new Error('Bluetooth device not connected');
    }

    // For example: collect 50 samples
    for (let i = 0; i < 50; i++) {
      const sample = await TrainingDataCollector.collectSample(label, material);

      if (!sample) {
        throw new Error('Failed to collect training data sample');
      }

      // Save sample
      await TrainingDataCollector.saveSample(sample);
    }
  }
}

export default TrainingDataService;
