import parseRawPacket, { ParsedPacket } from './DataParser';
import FFT from 'fft-js';
import { getCurrentProfile } from '../services/MaterialProfileService';
import ApiService from '../services/ApiService';

export interface FeatureVector {
  rms: number;
  spectralCentroid: number;
  peakFrequency: number;
  // … add as needed
}

const computeRMS = (arr: number[]): number =>
  Math.sqrt(arr.reduce((sum, v) => sum + v * v, 0) / arr.length);

const computeCentroid = (freqs: number[], mags: number[]): number => {
  const num = freqs.reduce((sum, f, i) => sum + f * mags[i], 0);
  const den = mags.reduce((sum, m) => sum + m, 0) || 1;
  return num / den;
};

export const processRaw = async (raw: string): Promise<FeatureVector | null> => {
  const pkt: ParsedPacket | null = parseRawPacket(raw);
  if (!pkt) return null;

  const { voltages } = pkt;
  const profile = await getCurrentProfile();

  // optional subtract baseline
  const adjusted = voltages.map(v => v - (profile.offset || 0));

  const rms = computeRMS(adjusted);

  const phasors = FFT.fft(adjusted);
  const mags = FFT.util.fftMag(phasors);
  const samplingRate = profile.samplingRateHz || 5000;
  const freqs = Array.from({ length: mags.length }, (_, i) => (i * samplingRate) / mags.length);


  const spectralCentroid = computeCentroid(freqs, mags);
  const peakIdx = mags.indexOf(Math.max(...mags));
  const peakFrequency = freqs[peakIdx];

  const vector: FeatureVector = {
    rms,
    spectralCentroid,
    peakFrequency,
  };

  // Send to backend
  await ApiService.sendFeatures(vector, {
    timestamp: pkt.timestamp,
    material: profile.materialType,
    calibrationParams: profile.calibrationParams,
  });

  return vector;
};
