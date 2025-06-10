import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Retry configuration
const retryConfig = {
  retries: 3,
  minTimeout: 1000,
  maxTimeout: 5000,
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'x-retry-after': '1',
    },
  },
  // Add retry configuration
  httpOptions: {
    timeout: 30000, // 30 seconds
    retryAttempts: retryConfig.retries,
    retryInterval: retryConfig.minTimeout,
  },
});

// Add error event listener to handle connection issues
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    console.log('User signed out due to connection issue');
  }
});