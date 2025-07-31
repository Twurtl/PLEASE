import BluetoothService from '../services/BluetoothService';
import { DataValidator } from './DataValidator';
import parseRawPacket, { ParsedPacket } from './DataParser';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TrainingSample {
  id: string;
  timestamp: number;
  signal: number[];
  label: string;
  metadata: {
    gps?: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };
    material: string;
    deviceId?: string;
    qualityScore?: number;
  };
}

export interface CollectionConfig {
  sampleDuration: number; // milliseconds
  sampleRate: number; // Hz
  qualityThreshold: number; // minimum quality score
  maxRetries: number;
}

class TrainingDataCollector {
  private static instance: TrainingDataCollector;
  private isCollecting: boolean = false;
  private currentConfig: CollectionConfig = {
    sampleDuration: 1000,
    sampleRate: 256,
    qualityThreshold: 0.7,
    maxRetries: 3
  };

  static getInstance(): TrainingDataCollector {
    if (!TrainingDataCollector.instance) {
      TrainingDataCollector.instance = new TrainingDataCollector();
    }
    return TrainingDataCollector.instance;
  }

  /**
   * Collect a single training sample with metadata
   */
  static async collectSample(
    label: string,
    material: string,
    config?: Partial<CollectionConfig>
  ): Promise<TrainingSample | null> {
    const collector = TrainingDataCollector.getInstance();
    return collector.collectSampleInternal(label, material, config);
  }

  /**
   * Collect multiple samples for a given label and material
   */
  static async collectSampleSet(
    label: string,
    material: string,
    count: number,
    config?: Partial<CollectionConfig>
  ): Promise<TrainingSample[]> {
    const collector = TrainingDataCollector.getInstance();
    const samples: TrainingSample[] = [];

    for (let i = 0; i < count; i++) {
      console.log(`Collecting sample ${i + 1}/${count} for ${label}`);
      const sample = await collector.collectSampleInternal(label, material, config);
      if (sample) {
        samples.push(sample);
      }
      // Small delay between samples
      await new Promise<void>(resolve => setTimeout(resolve, 200));
    }

    return samples;
  }

  /**
   * Save a training sample to local storage
   */
  static async saveSample(sample: TrainingSample): Promise<boolean> {
    try {
      const existing = await AsyncStorage.getItem('@training_samples');
      const samples: TrainingSample[] = existing ? JSON.parse(existing) : [];
      samples.push(sample);
      await AsyncStorage.setItem('@training_samples', JSON.stringify(samples));
      console.log(`Saved training sample: ${sample.id} for ${sample.label}`);
      return true;
    } catch (error) {
      console.error('Failed to save training sample:', error);
      return false;
    }
  }

  /**
   * Get all saved training samples
   */
  static async getSavedSamples(): Promise<TrainingSample[]> {
    try {
      const existing = await AsyncStorage.getItem('@training_samples');
      return existing ? JSON.parse(existing) : [];
    } catch (error) {
      console.error('Failed to get saved samples:', error);
      return [];
    }
  }

  /**
   * Clear all saved training samples
   */
  static async clearSavedSamples(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem('@training_samples');
      console.log('Cleared all saved training samples');
      return true;
    } catch (error) {
      console.error('Failed to clear saved samples:', error);
      return false;
    }
  }

  private async collectSampleInternal(
    label: string,
    material: string,
    config?: Partial<CollectionConfig>
  ): Promise<TrainingSample | null> {
    const finalConfig = { ...this.currentConfig, ...config };

    if (!BluetoothService.isConnected()) {
      console.error('Bluetooth not connected');
      return null;
    }

    for (let attempt = 0; attempt < finalConfig.maxRetries; attempt++) {
      try {
        const signal = await this.captureSignal(finalConfig);

        if (!DataValidator.validateSample(signal)) {
          console.warn(`Sample validation failed on attempt ${attempt + 1}`);
          continue;
        }

        const gps = await this.getCurrentLocation();
        const timestamp = Date.now();
        const sampleId = `${label}_${material}_${timestamp}`;

        const sample: TrainingSample = {
          id: sampleId,
          timestamp,
          signal,
          label,
          metadata: {
            gps,
            material,
            deviceId: 'arduino_sensor', // Could be made configurable
            qualityScore: this.calculateQualityScore(signal)
          }
        };

        console.log(`Successfully collected sample: ${sampleId}`);
        return sample;

      } catch (error) {
        console.error(`Sample collection attempt ${attempt + 1} failed:`, error);
        if (attempt === finalConfig.maxRetries - 1) {
          throw error;
        }
        // Wait before retry
        await new Promise<void>(resolve => setTimeout(resolve, 500));
      }
    }

    return null;
  }

  private async captureSignal(config: CollectionConfig): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const samples: number[] = [];
      const sampleCount = Math.floor((config.sampleDuration / 1000) * config.sampleRate);
      let collectedSamples = 0;

      const dataHandler = (data: string) => {
        const parsed = parseRawPacket(data);
        if (parsed) {
          samples.push(...parsed.voltages);
          collectedSamples += parsed.voltages.length;

          if (collectedSamples >= sampleCount) {
            BluetoothService.setOnData(() => { }); // Remove listener with empty function
            resolve(samples.slice(0, sampleCount));
          }
        }
      };

      BluetoothService.setOnData(dataHandler);

      // Timeout fallback
      setTimeout(() => {
        BluetoothService.setOnData(() => { }); // Remove listener with empty function
        if (samples.length > 0) {
          resolve(samples.slice(0, sampleCount));
        } else {
          reject(new Error('Timeout waiting for signal data'));
        }
      }, config.sampleDuration + 1000);
    });
  }

  private async getCurrentLocation(): Promise<TrainingSample['metadata']['gps'] | undefined> {
    // GPS functionality requires @react-native-community/geolocation package
    // For now, return undefined - can be implemented when geolocation is added
    console.log('GPS location not available - geolocation package not installed');
    return undefined;
  }

  private calculateQualityScore(signal: number[]): number {
    // Simple quality score based on signal variance and range
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const variance = signal.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / signal.length;
    const range = Math.max(...signal) - Math.min(...signal);

    // Normalize to 0-1 scale
    const varianceScore = Math.min(variance / 10, 1);
    const rangeScore = Math.min(range / 5, 1);

    return (varianceScore + rangeScore) / 2;
  }

  /**
   * Update collection configuration
   */
  static updateConfig(config: Partial<CollectionConfig>): void {
    const collector = TrainingDataCollector.getInstance();
    collector.currentConfig = { ...collector.currentConfig, ...config };
  }

  /**
   * Get current collection configuration
   */
  static getConfig(): CollectionConfig {
    const collector = TrainingDataCollector.getInstance();
    return { ...collector.currentConfig };
  }
}

export default TrainingDataCollector;
