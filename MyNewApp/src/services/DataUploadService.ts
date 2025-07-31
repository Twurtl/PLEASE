import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const STORAGE_KEY = '@training_dataset';
const API_URL = 'http://<YOUR_SERVER_IP>:5000/upload';

class DataUploadService {
  async uploadAll(): Promise<boolean> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);

    try {
      const response = await axios.post(API_URL, { data: parsed });
      return response.status === 200;
    } catch (error) {
      console.error('Upload failed:', error);
      return false;
    }
  }
}

export default new DataUploadService();
