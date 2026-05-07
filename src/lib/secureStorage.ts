import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memoryStorage = new Map<string, string>();

const hasWebStorage = () => Platform.OS === 'web' && typeof window !== 'undefined' && 'localStorage' in window;

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (hasWebStorage()) {
      return window.localStorage.getItem(key);
    }

    try {
      const value = await SecureStore.getItemAsync(key);
      return value ?? memoryStorage.get(key) ?? null;
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (hasWebStorage()) {
      window.localStorage.setItem(key, value);
      return;
    }

    memoryStorage.set(key, value);

    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Keep the in-memory fallback for the current process if SecureStore is unavailable.
    }
  },

  async removeItem(key: string): Promise<void> {
    if (hasWebStorage()) {
      window.localStorage.removeItem(key);
      return;
    }

    memoryStorage.delete(key);

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Nothing else to clear if SecureStore is unavailable.
    }
  },
};
