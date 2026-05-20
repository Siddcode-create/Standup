/** Notes too short or non-work filler — must not be sent to AI as-is. */
const FILLER_PHRASES = new Set([
  'yes',
  'no',
  'ok',
  'okay',
  'sure',
  'yep',
  'nope',
  'yup',
  'yeah',
  'nah',
  'maybe',
  'fine',
  'good',
  'great',
  'cool',
  'done',
  'thanks',
  'thank you',
  'hi',
  'hello',
  'hey',
  'test',
  'nothing',
  'none',
  'idk',
  'all good',
  'not much',
  'same',
  'same as yesterday',
])

function normalizeNotes(notes: string): string {
  return notes
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isNotesInsufficientForStandup(notes: string): boolean {
  const trimmed = notes.trim()
  if (!trimmed) return true

  const normalized = normalizeNotes(notes)
  if (!normalized) return true

  if (FILLER_PHRASES.has(normalized)) return true

  const words = normalized.split(' ').filter(Boolean)
  if (words.length === 1 && FILLER_PHRASES.has(words[0]!)) return true

  // e.g. "yes yes", "ok thanks"
  if (words.length <= 2 && words.every((w) => FILLER_PHRASES.has(w))) {
    return true
  }

  // Very short with no real substance (allow "fixed login bug" etc.)
  if (trimmed.length < 14 && words.length <= 2) {
    return true
  }

  return false
}

export function buildInsufficientNotesStandup(): {
  summary: string
  yesterday: string
  today: string
  blockers: string
} {
  return {
    summary:
      'Your notes were too short to build a standup. Add a few sentences about what you did yesterday, what you plan today, and any blockers, then generate again.',
    yesterday:
      '— (not enough detail in your notes to summarize yesterday’s work)',
    today:
      '— (add what you plan to do today — tasks, meetings, or goals — then generate again)',
    blockers: 'None',
  }
}

export const INSUFFICIENT_NOTES_WARNING =
  'Your notes are too short or unclear. Describe what you worked on and what you plan today (a few sentences), then try again.'
