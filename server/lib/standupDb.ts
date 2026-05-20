import { getSupabaseAdmin } from './supabaseAdmin.js'
import type { StructuredStandup } from './generateWithAi.js'

export type StandupRow = {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  raw_notes: string | null
  summary: string | null
  yesterday: string | null
  today: string | null
  blockers: string | null
}

function formatDbError(error: { message?: string; code?: string; details?: string }): string {
  const parts = [error.message, error.details, error.code].filter(Boolean)
  const text = parts.join(' — ')
  if (text.includes('standups') && text.includes('does not exist')) {
    return 'Table public.standups does not exist. Run supabase/migrations/20260517140000_standups_setup_complete.sql in Supabase SQL Editor.'
  }
  if (text.includes('summary') && text.includes('column')) {
    return 'Column public.standups.summary is missing. Run: alter table public.standups add column if not exists summary text;'
  }
  return text || 'Database error'
}

export async function saveStandupForUser(
  userId: string,
  rawNotes: string,
  standup: StructuredStandup,
): Promise<StandupRow> {
  const supabase = getSupabaseAdmin()

  const fullRow = {
    user_id: userId,
    raw_notes: rawNotes,
    summary: standup.summary,
    yesterday: standup.yesterday,
    today: standup.today,
    blockers: standup.blockers,
  }

  let result = await supabase.from('standups').insert(fullRow).select().single()

  if (result.error?.message?.includes('raw_notes')) {
    const { raw_notes: _r, ...withoutRawNotes } = fullRow
    result = await supabase.from('standups').insert(withoutRawNotes).select().single()
  }

  if (result.error) {
    throw new Error(formatDbError(result.error))
  }

  return result.data as StandupRow
}

export async function fetchStandupsForUser(
  userId: string,
  limit = 50,
): Promise<StandupRow[]> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('standups')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(formatDbError(error))
  }

  return (data ?? []) as StandupRow[]
}
