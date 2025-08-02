import BluetoothService from './BluetoothService';
import TrainingDataCollector from '../utils/TrainingDataCollector';
import ApiService from './ApiService';

interface TrainingSample {
  voltage: number;
  is_anomaly: boolean;
  timestamp: number;
  material: string;
}

class TrainingDataService {
  private static collectedData: TrainingSample[] = [];

  static async collectTrainingData(label: string, material: string = 'concrete'): Promise<void> {
    if (!BluetoothService.isConnected()) {
      throw new Error('Bluetooth device not connected');
    }

    // Clear previous data
    this.collectedData = [];

    // For example: collect 50 samples
    for (let i = 0; i < 50; i++) {
      const sample = await TrainingDataCollector.collectSample(label, material);

      if (!sample) {
        throw new Error('Failed to collect training data sample');
      }

      // Save sample to local array
      this.collectedData.push({
        voltage: sample.signal[0] || 0, // Use first signal value as voltage
        is_anomaly: label === 'anomaly',
        timestamp: Date.now(),
        material: material
      });

      // Save sample to local storage
      await TrainingDataCollector.saveSample(sample);
    }
  }

  static async trainNewModel(modelName: string, materialType: string = 'universal'): Promise<any> {
    if (this.collectedData.length === 0) {
      throw new Error('No training data collected. Please collect data first.');
    }

    try {
      const response = await ApiService.post('/models/train', {
        name: modelName,
        material_type: materialType,
        training_data: this.collectedData
      });

      if (response.message) {
        console.log('Model trained successfully:', response);
        // Clear collected data after successful training
        this.collectedData = [];
        return response;
      } else {
        throw new Error('Failed to train model');
      }
    } catch (error) {
      console.error('Error training model:', error);
      throw error;
    }
  }

  static getCollectedDataCount(): number {
    return this.collectedData.length;
  }

  static clearCollectedData(): void {
    this.collectedData = [];
  }

  static getCollectedData(): TrainingSample[] {
    return [...this.collectedData];
  }
}

export default TrainingDataService;