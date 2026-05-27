import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns the Supabase client singleton.
 * Uses the service_role key for full access (bypasses RLS).
 * Only called when SUPABASE_URL is set; otherwise stores stay in-memory.
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for database mode",
      );
    }
    _client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

/**
 * Returns true if the app should use Supabase (database mode).
 * False means in-memory mode (local dev, tests).
 */
export function useDatabase(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
