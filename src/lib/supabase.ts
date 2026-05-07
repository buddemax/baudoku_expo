import 'react-native-url-polyfill/auto';

import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { config, isSupabaseConfigured } from './config';
import { secureStorage } from './secureStorage';

export const supabase = isSupabaseConfigured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        lock: processLock,
        persistSession: true,
        storage: secureStorage,
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
      return;
    }

    supabase.auth.stopAutoRefresh();
  });
}
