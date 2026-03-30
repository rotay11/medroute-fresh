import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import i18n from '../i18n';
import { startGPSTracking, stopGPSTracking } from '../services/gpsService';
import api from '../config/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [driver, setDriver]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStoredSession(); }, []);

  async function loadStoredSession() {
    try {
      const token      = await SecureStore.getItemAsync('accessToken');
      const driverData = await SecureStore.getItemAsync('driverData');
      if (token && driverData) {
        const parsed = JSON.parse(driverData);
        setDriver(parsed);
        await i18n.changeLanguage(parsed.language?.toLowerCase() || 'en');
      }
    } catch {}
    finally { setLoading(false); }
  }

  async function login(email, password, deviceId) {
    const { data } = await api.post('/api/auth/login', {
      email, password, deviceId: deviceId || 'expo-device', platform: 'expo',
    });
    await saveSession(data);
    return data;
  }

  async function biometricLogin() {
    const driverData = await SecureStore.getItemAsync('driverData');
    if (!driverData) throw new Error('No saved account found');
    const parsed = JSON.parse(driverData);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to MedRoute',
      fallbackLabel: 'Use password',
    });
    if (!result.success) throw new Error('Biometric authentication failed');
    const deviceId = await SecureStore.getItemAsync('deviceId') || 'expo-device';
    const { data } = await api.post('/api/auth/biometric', {
      driverId: parsed.id, deviceId,
    });
    await saveSession(data);
    return data;
  }

  async function saveSession(data) {
    await SecureStore.setItemAsync('accessToken',  data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    await SecureStore.setItemAsync('driverData',   JSON.stringify(data.driver));
    setDriver(data.driver);
    await i18n.changeLanguage(data.driver.language?.toLowerCase() || 'en');
    if (data.driver.role === 'DRIVER') startGPSTracking();
  }

  async function logout() {
    stopGPSTracking();
    try { await api.post('/api/auth/logout'); } catch {}
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    setDriver(null);
  }

  async function switchLanguage(lang) {
    await i18n.changeLanguage(lang.toLowerCase());
    if (driver) {
      try { await api.patch('/api/driver/language', { language: lang, mapsLanguage: lang }); } catch {}
      const updated = { ...driver, language: lang };
      setDriver(updated);
      await SecureStore.setItemAsync('driverData', JSON.stringify(updated));
    }
  }

  return (
    <AuthContext.Provider value={{ driver, loading, login, biometricLogin, logout, switchLanguage }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
