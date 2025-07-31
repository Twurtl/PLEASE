import { fft } from 'fft-js';

export interface CalibrationResult {
  dominantFrequencies: number[];
  noiseFloor: number;
  sensitivity: number;
}

export default class CalibrationUtils {
  static analyzeCalibrationData(
    signal: number[],
    sampleRate: number
  ): CalibrationResult {
    const fftResult = fft(signal);
    const magnitudes = fftResult.map(([real, imag]) =>
      Math.sqrt(real * real + imag * imag)
    );

    const frequencies = magnitudes
      .map((mag, i) => ({
        frequency: (i * sampleRate) / signal.length,
        magnitude: mag
      }))
      .slice(0, signal.length / 2); // only positive frequencies

    const sortedByMagnitude = [...frequencies].sort(
      (a, b) => b.magnitude - a.magnitude
    );

    const dominantFrequencies = sortedByMagnitude
      .slice(0, 3)
      .map((item) => item.frequency);

    const noiseFloor = this.calculateNoiseFloor(magnitudes);
    const sensitivity = this.calculateSensitivity(signal);

    return {
      dominantFrequencies,
      noiseFloor,
      sensitivity
    };
  }

  static calculateNoiseFloor(magnitudes: number[]): number {
    const noiseSamples = magnitudes.slice(10, 50); // skip DC and strongest bins
    const avgNoise =
      noiseSamples.reduce((sum, val) => sum + val, 0) / noiseSamples.length;
    return avgNoise;
  }

  static calculateSensitivity(signal: number[]): number {
    const peak = Math.max(...signal.map(Math.abs));
    const rms = Math.sqrt(
      signal.reduce((sum, val) => sum + val * val, 0) / signal.length
    );
    return peak / rms;
  }

  static applyCalibrationParams(params: { gain: number; offset: number }) {
    console.log('Applied calibration', params);
    // Optionally: persist or apply these parameters in signal processing
  }
}
