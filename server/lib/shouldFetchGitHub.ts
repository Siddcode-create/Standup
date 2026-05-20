const GIT_KEYWORDS =
  /\bgithub\b|\bgit\s+hub\b|\bcommits?\b|\bcommit\b|\bpulls?\b|\bpull\s+requests?\b|\bprs?\b|\bmerge(?:s|d)?\b|\brepos?(?:itories)?\b|\bgit\s+activity\b/i

export function shouldFetchGitHub(
  autoFetch: boolean,
  userText: string,
): boolean {
  if (autoFetch) return true
  return GIT_KEYWORDS.test(userText)
}

/** User is asking for a GitHub activity summary, not describing manual work. */
export function notesRequestGitHubSummary(userText: string): boolean {
  const t = userText.trim()
  if (!t) return false
  return (
    /\b(any|what|show|list|check|get|fetch|were\s+there)\b.*\b(pulls?|commits?|prs?|github|merge)/i.test(
      t,
    ) ||
    /\b(pulls?|commits?|prs?)\b.*\b(github|today|yesterday|from)\b/i.test(t) ||
    /\bgithub\b.*\b(today|yesterday|commits?|pulls?)\b/i.test(t)
  )
}