// src/api/ApiService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:8000';

class ApiService {
  private static async getAuthHeaders() {
    const token = await AsyncStorage.getItem('@auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  static async post(endpoint: string, data: any) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return response.json();
  }

  // Add get, put, delete similarly if needed
}

export default ApiService;
