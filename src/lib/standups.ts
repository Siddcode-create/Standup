import { parseJsonResponse } from './parseJsonResponse'
import type { Standup } from '../types/database'
import type { StructuredStandup } from '../types/standup'

type ErrorBody = { error?: string }

function authHeaders(accessToken: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  }
}

export function getStandupSaveErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message)
  }
  return 'Could not save standup to history.'
}

export async function fetchStandupHistory(
  accessToken: string,
  limit = 50,
): Promise<Standup[]> {
  const response = await fetch(`/api/standup/history?limit=${limit}`, {
    headers: authHeaders(accessToken),
  })

  const data = await parseJsonResponse<{ history: Standup[] } | ErrorBody>(
    response,
  )

  if (!response.ok) {
    throw new Error(
      'error' in data && data.error
        ? data.error
        : `Could not load history (${response.status})`,
    )
  }

  return (data as { history: Standup[] }).history
}

export async function saveStandup(
  accessToken: string,
  rawNotes: string,
  standup: StructuredStandup,
): Promise<Standup> {
  const response = await fetch('/api/standup/save', {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ rawNotes, standup }),
  })

  const data = await parseJsonResponse<{ saved: Standup } | ErrorBody>(response)

  if (!response.ok) {
    throw new Error(
      'error' in data && data.error
        ? data.error
        : `Could not save standup (${response.status})`,
    )
  }

  return (data as { saved: Standup }).saved
}
