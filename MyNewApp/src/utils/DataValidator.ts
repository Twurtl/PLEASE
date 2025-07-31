export class DataValidator {
    static validateSample(sample: number[]): boolean {
      if (!sample || sample.length === 0) return false;
  
      // Example checks: SNR, frequency consistency, duplicates
      // Simple check: no all zeros
      const allZeros = sample.every((v) => v === 0);
      if (allZeros) return false;
  
      // Could add more checks: variance thresholds, frequency analysis, etc.
      return true;
    }
  }
  