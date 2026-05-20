export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes('invalid login credentials')) {
      return 'Incorrect email or password. Please try again.'
    }
    if (message.includes('user already registered')) {
      return 'An account with this email already exists. Try signing in instead.'
    }
    if (message.includes('password should be at least')) {
      return 'Password must be at least 6 characters.'
    }
    if (message.includes('unable to validate email')) {
      return 'Please enter a valid email address.'
    }
    if (message.includes('email not confirmed')) {
      return 'Check your inbox and confirm your email before signing in.'
    }
    if (message.includes('network')) {
      return 'Network error. Check your connection and try again.'
    }

    return error.message
  }

  return 'Something went wrong. Please try again.'
}
