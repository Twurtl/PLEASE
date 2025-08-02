import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import ApiService from './ApiService';

type MaterialProfile = {
  materialType: string;
  samplingRateHz: number;
  offset: number;
  calibrationParams: any;
};

type MLModel = {
  id: string;
  name: string;
  material_type: string;
  file_path: string;
  accuracy?: number;
  training_data_count: number;
  created_at: string;
  is_preset: boolean;
};

const DEFAULT_PROFILE: MaterialProfile = {
  materialType: 'concrete',
  samplingRateHz: 5000,
  offset: 0,
  calibrationParams: {},
};

export const MaterialContext = createContext<{
  profile: MaterialProfile;
  updateProfile: (p: Partial<MaterialProfile>) => void;
  userModels: MLModel[];
  presetModels: MLModel[];
  selectedModel: MLModel | null;
  selectModel: (model: MLModel) => Promise<void>;
  refreshModels: () => Promise<void>;
  isLoading: boolean;
}>({
  profile: DEFAULT_PROFILE,
  updateProfile: () => { },
  userModels: [],
  presetModels: [],
  selectedModel: null,
  selectModel: async () => { },
  refreshModels: async () => { },
  isLoading: false,
});

const STORAGE_KEY = '@material_profile';

export default function MaterialProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<MaterialProfile>(DEFAULT_PROFILE);
  const [userModels, setUserModels] = useState<MLModel[]>([]);
  const [presetModels, setPresetModels] = useState<MLModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<MLModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) setProfile(JSON.parse(stored));
    });
    refreshModels();
  }, []);

  const updateProfile = (updates: Partial<MaterialProfile>) => {
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
  };

  const refreshModels = async () => {
    try {
      setIsLoading(true);
      const response = await ApiService.get('/models/user');

      if (response.models) {
        const userModelsList = response.models.filter((model: MLModel) => !model.is_preset);
        const presetModelsList = response.models.filter((model: MLModel) => model.is_preset);

        setUserModels(userModelsList);
        setPresetModels(presetModelsList);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectModel = async (model: MLModel) => {
    try {
      const response = await ApiService.post(`/models/${model.id}/select`, {});
      if (response.message) {
        setSelectedModel(model);
        console.log('Model selected successfully:', model.name);
      }
    } catch (error) {
      console.error('Error selecting model:', error);
    }
  };

  return (
    <MaterialContext.Provider value={{
      profile,
      updateProfile,
      userModels,
      presetModels,
      selectedModel,
      selectModel,
      refreshModels,
      isLoading
    }}>
      {children}
    </MaterialContext.Provider>
  );
}

export const getCurrentProfile = async (): Promise<MaterialProfile> => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_PROFILE;
};