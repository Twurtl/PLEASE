import axios from 'axios';
import { FeatureVector } from '../utils/SignalProcessor';

const BACKEND_URL = 'http://<YOUR_SERVER_IP>:5000/analyze'; // Replace with actual IP or domain

class ApiService {
  async sendFeatures(
    features: FeatureVector,
    metadata: {
      timestamp: number;
      material: string;
      calibrationParams: any;
    }
  ): Promise<any> {
    try {
      const response = await axios.post(BACKEND_URL, {
        features,
        metadata,
      });
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      return null;
    }
  }
}

export default new ApiService();
