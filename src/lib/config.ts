export const config = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, ''),
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim(),
  supabaseAnonKey: (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
};

export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
