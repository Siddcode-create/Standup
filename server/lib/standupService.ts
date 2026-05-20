import {
  buildInsufficientNotesStandup,
  INSUFFICIENT_NOTES_WARNING,
  isNotesInsufficientForStandup,
} from './notesQuality.js'
import { shouldFetchGitHub } from './shouldFetchGitHub.js'
import {
  fetchGitHubCommitsByDay,
  formatCommitsForPrompt,
} from './fetchGitHubCommits.js'
import {
  buildGenericEmptyStandup,
  buildStandupFromGitHubData,
  formatStandupDisplay,
  generateStructuredStandup,
  isNotesEmpty,
  type StructuredStandup,
} from './generateWithAi.js'

export type GenerateStandupRequest = {
  notes: string
  autoFetchGitHub: boolean
}

export type GenerateStandupResponse = {
  standup: StructuredStandup
  formatted: string
  meta: {
    usedGitHub: boolean
    githubCommitCount: number
    githubFetchReason: 'auto-toggle' | 'keyword-match' | 'skipped'
    aiProvider: 'gemini' | 'openai' | 'local'
    aiModel?: string
    aiWarning?: string
  }
}

export async function runStandupGeneration(
  body: GenerateStandupRequest,
): Promise<GenerateStandupResponse> {
  const notes = body.notes ?? ''
  const autoFetch = Boolean(body.autoFetchGitHub)
  const fetchGitHub = shouldFetchGitHub(autoFetch, notes)

  let githubCommitsText: string | null = null
  let githubCommitCount = 0
  let githubFetchReason: GenerateStandupResponse['meta']['githubFetchReason'] =
    'skipped'

  if (fetchGitHub) {
    githubFetchReason = autoFetch ? 'auto-toggle' : 'keyword-match'
    const username = process.env.GITHUB_USERNAME
    const token = process.env.GITHUB_TOKEN

    if (!username || !token) {
      throw new Error(
        'GitHub is required for this request but GITHUB_USERNAME or GITHUB_TOKEN is missing in .env',
      )
    }

    const byDay = await fetchGitHubCommitsByDay(username, token)
    githubCommitCount =
      byDay.today.length + byDay.yesterday.length + byDay.pulls.length
    githubCommitsText = formatCommitsForPrompt(byDay)
  }

  if (isNotesEmpty(notes) && !fetchGitHub) {
    const standup = buildGenericEmptyStandup()
    return {
      standup,
      formatted: formatStandupDisplay(standup),
      meta: {
        usedGitHub: false,
        githubCommitCount: 0,
        githubFetchReason: 'skipped',
        aiProvider: 'local',
        aiWarning:
          'Add a few lines in Daily notes for a personalized standup.',
      },
    }
  }

  // Short/filler notes are only rejected when GitHub is not being used
  if (!fetchGitHub && isNotesInsufficientForStandup(notes)) {
    const standup = buildInsufficientNotesStandup()
    return {
      standup,
      formatted: formatStandupDisplay(standup),
      meta: {
        usedGitHub: false,
        githubCommitCount: 0,
        githubFetchReason: 'skipped',
        aiProvider: 'local',
        aiWarning: INSUFFICIENT_NOTES_WARNING,
      },
    }
  }

  const notesWeak =
    isNotesEmpty(notes) || isNotesInsufficientForStandup(notes)

  if (fetchGitHub && githubCommitsText && notesWeak && githubCommitCount === 0) {
    const standup = buildStandupFromGitHubData(githubCommitsText, notes)
    return {
      standup,
      formatted: formatStandupDisplay(standup),
      meta: {
        usedGitHub: true,
        githubCommitCount: 0,
        githubFetchReason,
        aiProvider: 'local',
        aiWarning:
          'No GitHub activity in the last ~2 days. Check GITHUB_USERNAME matches your login, token has repo scope, and activity was today/yesterday. Add daily notes for non-GitHub work.',
      },
    }
  }

  const { standup, ai } = await generateStructuredStandup({
    userNotes: notes,
    githubCommitsText,
    usedGitHub: fetchGitHub,
  })

  return {
    standup,
    formatted: formatStandupDisplay(standup),
    meta: {
      usedGitHub: fetchGitHub,
      githubCommitCount,
      githubFetchReason,
      aiProvider: ai.provider,
      aiModel: ai.model,
      aiWarning: ai.warning,
    },
  }
}
