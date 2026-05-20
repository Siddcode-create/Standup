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
): Pick<GitHubCommitsByDay, 'today' | 'yesterday'> {
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
  await assertGitHubCredentials(username, token)

  const yesterdayStart = startOfLocalDay(-1)
  const since = yesterdayStart.toISOString()

  const pulls = await fetchRecentPullRequests(username, token, since)

  const fromSearch = await fetchCommitsViaSearch(username, token, since)
  const fromEvents = await fetchCommitsViaEvents(username, token, since)

  const merged = mergeActivityLists(fromSearch, fromEvents)
  return { ...bucketCommits(merged), pulls }
}

function mergeActivityLists(
  a: GitHubCommitSummary[],
  b: GitHubCommitSummary[],
): GitHubCommitSummary[] {
  const seen = new Set<string>()
  const out: GitHubCommitSummary[] = []
  for (const item of [...a, ...b]) {
    const key = `${item.repo}|${item.sha}|${item.message}|${item.committedAt}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

async function assertGitHubCredentials(
  username: string,
  token: string,
): Promise<void> {
  const response = await fetch('https://api.github.com/user', {
    headers: githubHeaders(token),
  })
  if (!response.ok) {
    const hint = await response.text()
    throw new Error(
      `GitHub token rejected (${response.status}). On Vercel, set GITHUB_TOKEN with a classic token (scopes: repo, read:user). ${hint.slice(0, 120)}`,
    )
  }
  const user = (await response.json()) as { login?: string }
  if (
    user.login &&
    user.login.toLowerCase() !== username.trim().toLowerCase()
  ) {
    throw new Error(
      `GITHUB_USERNAME is "${username}" but this token belongs to "${user.login}". Use your exact GitHub login in GITHUB_USERNAME.`,
    )
  }
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
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `GitHub PR search failed (${response.status}). Token may lack repo scope.`,
    )
  }
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

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `GitHub commit search failed (${response.status}). Check GITHUB_TOKEN on Vercel.`,
    )
  }
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
      ref_type?: string
      action?: string
      ref?: string
      pull_request?: {
        number?: number
        title?: string
        html_url?: string
      }
      commits?: Array<{
        sha: string
        message: string
        url?: string
      }>
    }
  }>

  const results: GitHubCommitSummary[] = []

  for (const event of events) {
    if (new Date(event.created_at).getTime() < sinceMs) continue

    const repo = event.repo?.name ?? 'unknown'
    const at = event.created_at

    if (event.type === 'CreateEvent' && event.payload?.ref_type === 'repository') {
      results.push({
        repo,
        message: 'Created repository',
        sha: 'repo-new',
        url: `https://github.com/${repo}`,
        committedAt: at,
      })
      continue
    }

    if (event.type === 'PullRequestEvent') {
      const pr = event.payload?.pull_request as
        | { number?: number; title?: string; html_url?: string }
        | undefined
      if (pr?.number && pr.title) {
        const action = event.payload?.action ?? 'updated'
        results.push({
          repo,
          message: `${action} pull request #${pr.number}: ${pr.title}`,
          sha: `pr-${pr.number}`,
          url: pr.html_url ?? `https://github.com/${repo}/pull/${pr.number}`,
          committedAt: at,
        })
      }
      continue
    }

    if (event.type !== 'PushEvent') continue

    const commits = event.payload?.commits ?? []
    if (commits.length === 0) {
      const ref = event.payload?.ref?.replace(/^refs\/heads\//, '') ?? 'branch'
      results.push({
        repo,
        message: `Pushed to ${ref} (no commit messages in event)`,
        sha: 'push',
        url: `https://github.com/${repo}`,
        committedAt: at,
      })
      continue
    }

    for (const commit of commits) {
      results.push({
        repo,
        message: commit.message.split('\n')[0] ?? commit.message,
        sha: commit.sha.slice(0, 7),
        url: commit.url ?? `https://github.com/${repo}/commit/${commit.sha}`,
        committedAt: at,
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
