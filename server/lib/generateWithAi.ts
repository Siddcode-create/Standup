import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  buildInsufficientNotesStandup,
  INSUFFICIENT_NOTES_WARNING,
  isNotesInsufficientForStandup,
} from './notesQuality.js'
import { notesRequestGitHubSummary } from './shouldFetchGitHub.js'

export type StructuredStandup = {
  summary: string
  yesterday: string
  today: string
  blockers: string
}

export type AiGenerationMeta = {
  provider: 'gemini' | 'openai' | 'local'
  model?: string
  warning?: string
}

const DEFAULT_GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
] as const

function resolveAiProvider(
  openaiKey: string | undefined,
  geminiKey: string | undefined,
): 'openai' | 'gemini' | null {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase()
  if (configured === 'openai' && openaiKey) return 'openai'
  if (configured === 'gemini' && geminiKey) return 'gemini'
  if (openaiKey) return 'openai'
  if (geminiKey) return 'gemini'
  return null
}

export type PromptMode =
  | 'general'
  | 'github_auto'
  | 'github_inquiry'
  | 'github_hybrid'

export function resolvePromptMode(input: {
  userNotes: string
  usedGitHub: boolean
}): PromptMode {
  if (!input.usedGitHub) return 'general'
  if (notesRequestGitHubSummary(input.userNotes)) return 'github_inquiry'
  if (
    isNotesEmpty(input.userNotes) ||
    isNotesInsufficientForStandup(input.userNotes)
  ) {
    return 'github_auto'
  }
  return 'github_hybrid'
}

export function buildStandupFromGitHubData(
  githubCommitsText: string,
  userNotes: string,
): StructuredStandup {
  return standupFromGitHubPromptText(githubCommitsText, userNotes)
}

export async function generateStructuredStandup(input: {
  userNotes: string
  githubCommitsText: string | null
  usedGitHub: boolean
}): Promise<{ standup: StructuredStandup; ai: AiGenerationMeta }> {
  if (!input.usedGitHub && isNotesInsufficientForStandup(input.userNotes)) {
    return {
      standup: buildInsufficientNotesStandup(),
      ai: { provider: 'local', warning: INSUFFICIENT_NOTES_WARNING },
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const failures: string[] = []
  const primary = resolveAiProvider(openaiKey, geminiKey)

  async function tryOpenAI(): Promise<StructuredStandup | null> {
    if (!openaiKey) return null
    try {
      return await generateWithOpenAI(openaiKey, input)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`OpenAI: ${summarizeAiError(message)}`)
      return null
    }
  }

  async function tryGemini(): Promise<StructuredStandup | null> {
    if (!geminiKey) return null
    const models = getGeminiModelList()
    for (const model of models) {
      try {
        return await generateWithGemini(geminiKey, input, model)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push(`Gemini (${model}): ${summarizeAiError(message)}`)
        if (!isRetryableAiError(message)) break
      }
    }
    return null
  }

  if (primary === 'openai') {
    const openaiStandup = await tryOpenAI()
    if (openaiStandup) {
      return {
        standup: openaiStandup,
        ai: {
          provider: 'openai',
          model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
        },
      }
    }
    const geminiStandup = await tryGemini()
    if (geminiStandup) {
      return {
        standup: geminiStandup,
        ai: { provider: 'gemini', model: getGeminiModelList()[0] },
      }
    }
  } else if (primary === 'gemini') {
    const geminiStandup = await tryGemini()
    if (geminiStandup) {
      return {
        standup: geminiStandup,
        ai: { provider: 'gemini', model: getGeminiModelList()[0] },
      }
    }
    const openaiStandup = await tryOpenAI()
    if (openaiStandup) {
      return {
        standup: openaiStandup,
        ai: {
          provider: 'openai',
          model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
        },
      }
    }
  }

  if (!geminiKey && !openaiKey) {
    throw new Error(
      'No AI provider configured. Set OPENAI_API_KEY (recommended) or GEMINI_API_KEY in .env',
    )
  }

  const warning =
    failures.length > 0
      ? `AI quota or API limits reached — using a basic template. ${failures[failures.length - 1]}`
      : 'AI unavailable — using a basic template from your notes.'

  return {
    standup: generateLocalFallback(input),
    ai: { provider: 'local', warning },
  }
}

function getGeminiModelList(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim()
  const models = preferred
    ? [preferred, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== preferred)]
    : [...DEFAULT_GEMINI_MODELS]
  return [...new Set(models)]
}

function isRetryableAiError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('resource exhausted') ||
    lower.includes('not found') ||
    lower.includes('404')
  )
}

function summarizeAiError(message: string): string {
  if (message.includes('429') || message.toLowerCase().includes('quota')) {
    return 'quota exceeded — try again later or switch AI_PROVIDER=openai'
  }
  if (message.length > 180) return `${message.slice(0, 180)}…`
  return message
}

async function generateWithGemini(
  apiKey: string,
  input: {
    userNotes: string
    githubCommitsText: string | null
    usedGitHub: boolean
  },
  modelName: string,
): Promise<StructuredStandup> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })

  const result = await model.generateContent(buildPrompt(input))
  const text = result.response.text()
  if (!text?.trim()) throw new Error('Gemini returned an empty response')
  return parseStructuredResponse(text)
}

async function generateWithOpenAI(
  apiKey: string,
  input: {
    userNotes: string
    githubCommitsText: string | null
    usedGitHub: boolean
  },
): Promise<StructuredStandup> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildSystemMessage(resolvePromptMode(input)),
        },
        { role: 'user', content: buildPrompt(input) },
      ],
      temperature: 0.35,
      max_tokens: 1200,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI error (${response.status}): ${err.slice(0, 300)}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned an empty response')
  return parseStructuredResponse(content)
}

export function isNotesEmpty(notes: string): boolean {
  return !notes.trim()
}

/** Generic standup when there is nothing to summarize (no notes, no GitHub). */
function buildSummaryFromParts(
  yesterday: string,
  today: string,
  blockers: string,
): string {
  const y = yesterday.trim()
  const t = today.trim()
  const b = blockers.trim()
  const parts: string[] = []

  if (y && y !== '—' && !y.startsWith('— (')) {
    parts.push(
      y.length > 200 ? `${y.slice(0, 197).trim()}…` : y.replace(/\s+/g, ' '),
    )
  }
  if (t && t !== '—' && !t.startsWith('— (')) {
    parts.push(
      t.length > 200 ? `${t.slice(0, 197).trim()}…` : t.replace(/\s+/g, ' '),
    )
  }

  if (parts.length === 0) {
    return 'No standup details to summarize yet — add notes or GitHub activity and generate again.'
  }

  let summary = parts.join(' ')
  if (b && b !== 'None' && !/^none$/i.test(b)) {
    summary += ` Blockers: ${b.replace(/\s+/g, ' ')}.`
  }
  return summary
}

export function buildGenericEmptyStandup(): StructuredStandup {
  const yesterday = '—'
  const today = '—'
  const blockers = 'None'
  return {
    summary: buildSummaryFromParts(yesterday, today, blockers),
    yesterday,
    today,
    blockers,
  }
}

function generateLocalFallback(input: {
  userNotes: string
  githubCommitsText: string | null
  usedGitHub: boolean
}): StructuredStandup {
  const notes = input.userNotes.trim()

  if (!notes && !input.usedGitHub) {
    return buildGenericEmptyStandup()
  }

  if (input.usedGitHub && input.githubCommitsText) {
    return standupFromGitHubPromptText(input.githubCommitsText, notes)
  }

  return standupFromNotesOnly(notes)
}

function standupFromNotesOnly(notes: string): StructuredStandup {
  const { yesterdayPart, todayPart, blockers } = splitNotesBySection(notes)
  const yesterday = yesterdayPart
    ? expandNotesAsSummary(yesterdayPart, 'past')
    : todayPart
      ? '—'
      : expandNotesAsSummary(notes, 'past')
  const today = todayPart ? expandNotesAsSummary(todayPart, 'future') : '—'
  return {
    summary: buildSummaryFromParts(yesterday, today, blockers),
    yesterday,
    today,
    blockers,
  }
}

function standupFromGitHubPromptText(
  githubText: string,
  notes: string,
): StructuredStandup {
  const yesterdayCommits = extractSectionLines(githubText, 'YESTERDAY')
  const todayCommits = extractSectionLines(githubText, 'TODAY')
  const pullLines = extractSectionLines(githubText, 'RECENT PULL REQUESTS')

  const yesterday =
    summarizeGitHubDay(yesterdayCommits, 'yesterday') +
    (pullLines.length > 0
      ? `\n• PRs: ${pullLines.map((l) => l.replace(/^-\s*/, '')).join('; ')}`
      : '')
  const today = summarizeGitHubDay(todayCommits, 'today')

  const blockers = /\bblocker\b/i.test(notes) ? extractBlockersFromNotes(notes) : 'None'

  const yesterdayOut =
    yesterday.trim() || noGitHubActivityMessage('yesterday')
  const todayOut = today.trim() || noGitHubActivityMessage('today')

  return {
    summary: buildSummaryFromParts(yesterdayOut, todayOut, blockers),
    yesterday: yesterdayOut,
    today: todayOut,
    blockers,
  }
}

function noGitHubActivityMessage(day: 'yesterday' | 'today'): string {
  const label = day === 'yesterday' ? 'Yesterday' : 'Today'
  return `${label}: No GitHub commits or pull requests were found for this day (last 2 days checked).`
}

function summarizeGitHubDay(lines: string[], day: 'yesterday' | 'today'): string {
  const items = lines.filter((l) => l.startsWith('- ['))
  if (items.length === 0) return ''
  const when = day === 'yesterday' ? 'Yesterday' : 'Today'
  const descriptions = items.map((l) => l.replace(/^-\s*\[[^\]]+\]\s*/, '').trim())
  if (items.length === 1) {
    return `${when} on GitHub I had one update: ${descriptions[0]}.`
  }
  return `${when} on GitHub I had ${items.length} updates across repos — including ${descriptions.slice(0, 3).join('; ')}${items.length > 3 ? `; and ${items.length - 3} more` : ''}.`
}

function extractSectionLines(text: string, heading: string): string[] {
  const re = new RegExp(
    `${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]+(?:\\(|:)|$)`,
    'i',
  )
  const match = text.match(re)
  if (!match) return []
  return match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== '(none)')
}

function splitNotesBySection(notes: string): {
  yesterdayPart: string
  todayPart: string
  blockers: string
} {
  const lower = notes.toLowerCase()
  let blockers = 'None'
  if (/\bblocker(s)?\s*:\s*/i.test(notes)) {
    blockers = extractBlockersFromNotes(notes)
  } else if (/\bno\s+blockers?\b/i.test(notes)) {
    blockers = 'None'
  }

  const todayMatch = notes.match(
    /\b(today|plan(?:s|ning)?\s+for\s+today)\s*[:\-]\s*([\s\S]+?)(?=\b(yesterday|blocker)|$)/i,
  )
  const yesterdayMatch = notes.match(
    /\b(yesterday|done\s+yesterday)\s*[:\-]\s*([\s\S]+?)(?=\b(today|blocker)|$)/i,
  )

  if (todayMatch || yesterdayMatch) {
    return {
      yesterdayPart: yesterdayMatch?.[2]?.trim() ?? '',
      todayPart: todayMatch?.[2]?.trim() ?? '',
      blockers,
    }
  }

  if (/\btoday\b/i.test(lower) && !/\byesterday\b/i.test(lower)) {
    return { yesterdayPart: '', todayPart: notes, blockers }
  }

  return { yesterdayPart: notes, todayPart: '', blockers }
}

function extractBlockersFromNotes(notes: string): string {
  const m = notes.match(/\bblockers?\s*[:\-]\s*([\s\S]+?)$/i)
  if (m?.[1]?.trim()) return m[1].trim()
  if (/\bno\s+blockers?\b/i.test(notes)) return 'None'
  return 'None'
}

function splitNoteChunks(text: string): string[] {
  return text
    .split(/\n+|(?:\s+and\s+)|(?:\s*;\s*)|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .map((s) => {
      const cleaned = s.replace(/^[-•*]\s*/, '')
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    })
}

function expandNotesAsSummary(text: string, tense: 'past' | 'future'): string {
  const chunks = splitNoteChunks(text)
  if (chunks.length === 0) return text.trim() || '—'

  if (tense === 'future') {
    if (chunks.length === 1) {
      return `Today I plan to focus on ${chunks[0].replace(/[.!?]+$/, '')}. I'll prioritize finishing this and will share progress in the next standup.`
    }
    return `Today I plan to work on several priorities: ${chunks.slice(0, -1).join(', ')}, and ${chunks[chunks.length - 1].replace(/[.!?]+$/, '')}. I'll work through these in order and flag anything that slips.`
  }

  if (chunks.length === 1) {
    return `Yesterday I spent time on ${chunks[0].replace(/[.!?]+$/, '')}. This was my main focus for the day.`
  }

  if (chunks.length === 2) {
    const a = chunks[0].replace(/[.!?]+$/, '')
    const b = chunks[1].replace(/[.!?]+$/, '')
    return `Yesterday I split my time between ${a} and ${b}. Both were important parts of the day.`
  }

  const cleaned = chunks.map((c) => c.replace(/[.!?]+$/, ''))
  const last = cleaned.pop()!
  return `Yesterday I worked across several areas: ${cleaned.join(', ')}, and ${last}. Taken together, these covered my main priorities for the day.`
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

const JSON_OUTPUT = `Respond with JSON only:
{
  "summary": "...",
  "yesterday": "...",
  "today": "...",
  "blockers": "..."
}`

const CORE_RULES = `
RULES (all modes):
- "summary": 2–4 sentence executive overview of the whole standup (yesterday + today + blockers). Write this FIRST in your thinking, but output all JSON fields.
- Never invent work, repos, commits, meetings, or blockers not supported by the inputs.
- "blockers": obstacles explicitly mentioned; otherwise "None".
- Rephrase professionally; do not copy the user's exact wording.
`

function buildSystemMessage(mode: PromptMode): string {
  switch (mode) {
    case 'general':
      return `You write daily standups from user notes only. Return JSON: summary, yesterday, today, blockers. Include a clear summary. If notes lack real work, use "—" for sections — never fabricate.`
    case 'github_auto':
      return `You write standups from GitHub data only. Return JSON with summary. Never invent repos or commits. If GitHub shows (none), say so in summary and sections.`
    case 'github_inquiry':
      return `You answer GitHub activity questions. Return JSON with summary. Never invent activity.`
    case 'github_hybrid':
      return `You merge user notes with GitHub by calendar day. Return JSON with summary. Never invent work.`
  }
}

function buildPrompt(input: {
  userNotes: string
  githubCommitsText: string | null
  usedGitHub: boolean
}): string {
  const mode = resolvePromptMode(input)
  const githubBlock = input.githubCommitsText ?? 'No GitHub data'
  const notes = input.userNotes.trim()

  switch (mode) {
    case 'general':
      return `Daily standup for ${todayLabel()}. Summarize ONLY the user's notes.

${CORE_RULES}
- "yesterday" = completed work from notes. If they only list tasks without "today", treat as yesterday.
- "today" = plans for today; "—" if not mentioned.
- If notes are too vague for a real standup, use "—" and do not invent detail.
- Do not mention GitHub unless the user did.
- With enough detail: 2–5 sentences per section.

User notes:
${notes || '(empty — use "—" for yesterday and today)'}

${JSON_OUTPUT}`

    case 'github_auto':
      return `Daily standup for ${todayLabel()}. GitHub auto-fetch is ON.

${CORE_RULES}
- Use ONLY the GitHub section below for yesterday/today. IGNORE vague notes (e.g. "yes", "ok", empty).
- "yesterday" = YESTERDAY commits/PRs only. "today" = TODAY commits/PRs only.
- If a day shows (none), write one clear sentence: no GitHub commits/PRs found for that day.
- With commits: 2–4 sentences summarizing repos and changes.
- Blockers only if clearly stated in notes.

User notes (may be ignored):
${notes || '(none)'}

--- GitHub data (authoritative) ---
${githubBlock}

${JSON_OUTPUT}`

    case 'github_inquiry':
      return `Daily standup for ${todayLabel()}. User asked about GitHub activity.

${CORE_RULES}
- Answer from GitHub data only; do not repeat their question.
- "yesterday" / "today" from the matching GitHub sections.
- If (none) for a day, state that clearly in full sentences.
- 2–5 sentences per day when there is activity.

User message:
${notes || '(GitHub summary requested)'}

--- GitHub data (authoritative) ---
${githubBlock}

${JSON_OUTPUT}`

    case 'github_hybrid':
      return `Daily standup for ${todayLabel()}. Combine notes + GitHub.

${CORE_RULES}
- "yesterday" = user's past work from notes + YESTERDAY GitHub only.
- "today" = user's plans from notes + TODAY GitHub only.
- If GitHub shows (none) for a day, say so; still include note-based work for that day.
- 2–5 sentences per section when there is content.

User notes:
${notes}

--- GitHub data (by calendar day) ---
${githubBlock}

${JSON_OUTPUT}`
  }
}

function parseStructuredResponse(raw: string): StructuredStandup {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned) as Partial<StructuredStandup>
  const yesterday = String(parsed.yesterday ?? '').trim() || '—'
  const today = String(parsed.today ?? '').trim() || '—'
  const blockers = String(parsed.blockers ?? '').trim() || 'None'
  const summary =
    String(parsed.summary ?? '').trim() ||
    buildSummaryFromParts(yesterday, today, blockers)

  return { summary, yesterday, today, blockers }
}

export function formatStandupDisplay(standup: StructuredStandup): string {
  const summary = standup.summary?.trim()
  const summaryBlock = summary ? `Summary:\n${summary}\n\n` : ''
  return `${summaryBlock}Yesterday:\n${standup.yesterday}\n\nToday:\n${standup.today}\n\nBlockers:\n${standup.blockers}`
}
