import { parseJsonResponse } from './parseJsonResponse'
import type { GenerateStandupResponse } from '../types/standup'

export type GenerateStandupOptions = {
  autoFetchGitHub: boolean
  accessToken: string
}

type ErrorBody = { error?: string }

export async function generateStandup(
  notes: string,
  options: GenerateStandupOptions,
): Promise<GenerateStandupResponse> {
  let response: Response

  try {
    response = await fetch('/api/standup/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.accessToken}`,
      },
      body: JSON.stringify({
        notes,
        autoFetchGitHub: options.autoFetchGitHub,
      }),
    })
  } catch {
    throw new Error(
      'Network error — could not reach the standup API. Run npm run dev to start frontend and API together.',
    )
  }

  const data = await parseJsonResponse<GenerateStandupResponse | ErrorBody>(
    response,
  )

  if (!response.ok) {
    const message =
      'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (HTTP ${response.status})`
    throw new Error(message)
  }

  return data as GenerateStandupResponse
}
