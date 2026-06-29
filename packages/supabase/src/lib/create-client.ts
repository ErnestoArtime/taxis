import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createTaxiSupabaseClient(url: string, publishableKey: string): SupabaseClient {
  return createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}
