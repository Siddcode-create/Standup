export type StructuredStandup = {
  summary: string
  yesterday: string
  today: string
  blockers: string
}

import type { Standup } from './database'

export type GenerateStandupResponse = {
  standup: StructuredStandup
  formatted: string
  saved: Standup | null
  saveError: string | null
  meta: {
    usedGitHub: boolean
    githubCommitCount: number
    githubFetchReason: 'auto-toggle' | 'keyword-match' | 'skipped'
    aiProvider: 'gemini' | 'openai' | 'local'
    aiModel?: string
    aiWarning?: string
  }
}
