import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://ptsanjccfzzacalzvduo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0c2FuamNjZnp6YWNhbHp2ZHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzE5NzMsImV4cCI6MjA5MDIwNzk3M30.tqvY4eKv1copNcwADhkYCF5I9TP9Q_iDwYAs74vpwhg";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
