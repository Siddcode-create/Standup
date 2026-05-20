export type GitHubCommitSummary = {
  repo: string
  message: string
  sha: string
  url: string
  committedAt: string
}

export type GitHubPullSummary = {
  repo: string
  title: string
  number: number
  state: string
  url: string
  updatedAt: string
}

export type GitHubCommitsByDay = {
  today: GitHubCommitSummary[]
  yesterday: GitHubCommitSummary[]
  pulls: GitHubPullSummary[]
}

/** Local calendar day boundaries (matches how users think about "today"). */
function startOfLocalDay(offsetDays = 0): Date {
  const now = new Date()
  const day = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
  )
  day.setHours(0, 0, 0, 0)
  return day
}

function isInLocalDay(isoDate: string, dayStart: Date): boolean {
  const d = new Date(isoDate)
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  return d >= dayStart && d < dayEnd
}

function bucketCommits(
  commits: GitHubCommitSummary[],
): GitHubCommitsByDay {
  const todayStart = startOfLocalDay(0)
  const yesterdayStart = startOfLocalDay(-1)

  const today: GitHubCommitSummary[] = []
  const yesterday: GitHubCommitSummary[] = []

  for (const commit of commits) {
    if (isInLocalDay(commit.committedAt, todayStart)) {
      today.push(commit)
    } else if (isInLocalDay(commit.committedAt, yesterdayStart)) {
      yesterday.push(commit)
    }
  }

  return { today, yesterday }
}

export async function fetchGitHubCommitsByDay(
  username: string,
  token: string,
): Promise<GitHubCommitsByDay> {
  const yesterdayStart = startOfLocalDay(-1)
  const since = yesterdayStart.toISOString()

  const pulls = await fetchRecentPullRequests(username, token, since)

  const fromSearch = await fetchCommitsViaSearch(username, token, since)
  if (fromSearch.length > 0) {
    return { ...bucketCommits(fromSearch), pulls }
  }

  const fromEvents = await fetchCommitsViaEvents(username, token, since)
  return { ...bucketCommits(fromEvents), pulls }
}

async function fetchRecentPullRequests(
  username: string,
  token: string,
  sinceIso: string,
): Promise<GitHubPullSummary[]> {
  const date = sinceIso.split('T')[0]
  const q = `author:${username}+type:pr+updated:>=${date}`
  const url = new URL('https://api.github.com/search/issues')
  url.searchParams.set('q', q)
  url.searchParams.set('sort', 'updated')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('per_page', '20')

  const response = await fetch(url, { headers: githubHeaders(token) })
  if (!response.ok) return []

  const data = (await response.json()) as {
    items?: Array<{
      title: string
      number: number
      state: string
      html_url: string
      updated_at: string
      repository_url?: string
    }>
  }

  return (data.items ?? []).map((item) => ({
    repo: item.repository_url?.split('/repos/')[1] ?? 'unknown',
    title: item.title,
    number: item.number,
    state: item.state,
    url: item.html_url,
    updatedAt: item.updated_at,
  }))
}

/** @deprecated Use fetchGitHubCommitsByDay */
export async function fetchTodayGitHubCommits(
  username: string,
  token: string,
): Promise<GitHubCommitSummary[]> {
  const { today } = await fetchGitHubCommitsByDay(username, token)
  return today
}

async function fetchCommitsViaSearch(
  username: string,
  token: string,
  since: string,
): Promise<GitHubCommitSummary[]> {
  const date = since.split('T')[0]
  const q = `author:${username}+committer-date:>=${date}`
  const url = new URL('https://api.github.com/search/commits')
  url.searchParams.set('q', q)
  url.searchParams.set('sort', 'author-date')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('per_page', '50')

  const response = await fetch(url, {
    headers: {
      ...githubHeaders(token),
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    return []
  }

  const data = (await response.json()) as {
    items?: Array<{
      sha: string
      html_url: string
      commit: { message: string; author?: { date?: string } }
      repository?: { full_name?: string }
    }>
  }

  return (data.items ?? [])
    .map((item) => ({
      repo: item.repository?.full_name ?? 'unknown',
      message: item.commit.message.split('\n')[0] ?? item.commit.message,
      sha: item.sha.slice(0, 7),
      url: item.html_url,
      committedAt: item.commit.author?.date ?? since,
    }))
    .filter((item) => Boolean(item.committedAt))
}

async function fetchCommitsViaEvents(
  username: string,
  token: string,
  sinceIso: string,
): Promise<GitHubCommitSummary[]> {
  const sinceMs = new Date(sinceIso).getTime()
  const url = `https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=100`
  const response = await fetch(url, { headers: githubHeaders(token) })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(
      `GitHub API error (${response.status}): ${message.slice(0, 200)}`,
    )
  }

  const events = (await response.json()) as Array<{
    type: string
    created_at: string
    repo?: { name?: string }
    payload?: {
      commits?: Array<{
        sha: string
        message: string
        url?: string
      }>
    }
  }>

  const results: GitHubCommitSummary[] = []

  for (const event of events) {
    if (event.type !== 'PushEvent') continue
    if (new Date(event.created_at).getTime() < sinceMs) continue

    const repo = event.repo?.name ?? 'unknown'
    for (const commit of event.payload?.commits ?? []) {
      results.push({
        repo,
        message: commit.message.split('\n')[0] ?? commit.message,
        sha: commit.sha.slice(0, 7),
        url: commit.url ?? `https://github.com/${repo}/commit/${commit.sha}`,
        committedAt: event.created_at,
      })
    }
  }

  return results
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'smart-daily-standup-bot',
  }
}

function formatCommitLines(commits: GitHubCommitSummary[]): string {
  if (commits.length === 0) return '(none)'
  return commits
    .map(
      (c) =>
        `- [${c.repo}@${c.sha}] ${c.message} (${new Date(c.committedAt).toLocaleString()})`,
    )
    .join('\n')
}

function formatPullLines(pulls: GitHubPullSummary[]): string {
  if (pulls.length === 0) return '(none)'
  return pulls
    .map(
      (p) =>
        `- [${p.repo}#${p.number}] ${p.title} (${p.state}, updated ${new Date(p.updatedAt).toLocaleString()})`,
    )
    .join('\n')
}

export function formatCommitsForPrompt(byDay: GitHubCommitsByDay): string {
  return `YESTERDAY (GitHub commits only — do not move today's commits here):
${formatCommitLines(byDay.yesterday)}

TODAY (GitHub commits only):
${formatCommitLines(byDay.today)}

RECENT PULL REQUESTS (last ~2 days, any state):
${formatPullLines(byDay.pulls)}`
}
