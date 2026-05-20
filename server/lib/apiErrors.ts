export function apiErrorStatus(message: string): number {
  if (
    message.includes('Authorization') ||
    message.includes('session') ||
    message.includes('token')
  ) {
    return 401
  }
  if (message.includes('missing') || message.includes('configured')) {
    return 503
  }
  return 500
}

export function apiErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Request failed'
}
