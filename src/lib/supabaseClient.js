import { createClient } from '@supabase/supabase-js'

const ENV_URL = 'VITE_SUPABASE_URL'
const ENV_KEY = 'VITE_SUPABASE_ANON_KEY'

/**
 * Read Supabase credentials from Vite environment variables.
 * @returns {{ url: string | undefined, anonKey: string | undefined }}
 */
export function getSupabaseEnv() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

function resolveSupabaseConfig() {
  const { url, anonKey } = getSupabaseEnv()

  if (!url || !anonKey) {
    console.warn(
      `[supabase] Missing ${ENV_URL} or ${ENV_KEY}. Add them to .env and restart the dev server.`,
    )
  }

  return {
    url: url ?? '',
    anonKey: anonKey ?? '',
  }
}

const config = resolveSupabaseConfig()

/** Shared Supabase client — import this anywhere you need database or auth APIs. */
export const supabase = createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export default supabase
