import type { SupabaseClient } from '@supabase/supabase-js'

export function getSupabaseEnv(): {
  url: string | undefined
  anonKey: string | undefined
}

export const supabase: SupabaseClient
export default supabase
