export type Standup = {
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

export type StandupInsert = Pick<
  Standup,
  'yesterday' | 'today' | 'blockers'
> & {
  user_id: string
}
