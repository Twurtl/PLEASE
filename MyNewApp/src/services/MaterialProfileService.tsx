import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useState, useEffect, ReactNode } from 'react';

type MaterialProfile = {
  materialType: string;
  samplingRateHz: number;
  offset: number;
  calibrationParams: any;
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
}>({
  profile: DEFAULT_PROFILE,
  updateProfile: () => {},
});

const STORAGE_KEY = '@material_profile';

export default function MaterialProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<MaterialProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) setProfile(JSON.parse(stored));
    });
  }, []);

  const updateProfile = (updates: Partial<MaterialProfile>) => {
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
  };

  return (
    <MaterialContext.Provider value={{ profile, updateProfile }}>
      {children}
    </MaterialContext.Provider>
  );
}

export const getCurrentProfile = async (): Promise<MaterialProfile> => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : DEFAULT_PROFILE;
};
