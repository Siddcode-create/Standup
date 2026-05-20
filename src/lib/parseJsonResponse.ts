export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()

  if (!text.trim()) {
    if (response.status === 502 || response.status === 504) {
      throw new Error(
        'Standup API is unreachable. Run npm run dev (starts frontend + API) or npm run dev:server in another terminal.',
      )
    }

    throw new Error(
      `Server returned an empty response (HTTP ${response.status}). Is the API running on port 3001?`,
    )
  }

  try {
    return JSON.parse(text) as T
  } catch {
    const preview = text.startsWith('<!')
      ? 'HTML error page (API may have crashed)'
      : text.slice(0, 160)
    throw new Error(`Invalid server response: ${preview}`)
  }
}
