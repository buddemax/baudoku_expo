import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { buildTheme, type Theme, type ThemeScheme } from './theme';

export type ThemeMode = 'system' | ThemeScheme;

type ThemeContextValue = {
  theme: Theme;
  scheme: ThemeScheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'bba.themeMode';

let secureStore: typeof import('expo-secure-store') | null = null;
try {
  secureStore = require('expo-secure-store') as typeof import('expo-secure-store');
} catch {
  secureStore = null;
}

const readStoredMode = async (): Promise<ThemeMode | null> => {
  if (!secureStore) {
    return null;
  }
  try {
    const value = await secureStore.getItemAsync(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') {
      return value;
    }
    return null;
  } catch {
    return null;
  }
};

const writeStoredMode = async (mode: ThemeMode): Promise<void> => {
  if (!secureStore) {
    return;
  }
  try {
    await secureStore.setItemAsync(STORAGE_KEY, mode);
  } catch {
    // Silent fallback - mode persists for session only
  }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    readStoredMode().then((stored) => {
      if (mounted && stored) {
        setModeState(stored);
      }
      if (mounted) {
        setHydrated(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void writeStoredMode(next);
  }, []);

  const scheme: ThemeScheme = mode === 'system' ? systemScheme : mode;
  const theme = useMemo(() => buildTheme(scheme), [scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, scheme, mode, setMode }),
    [theme, scheme, mode, setMode],
  );

  if (!hydrated) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
