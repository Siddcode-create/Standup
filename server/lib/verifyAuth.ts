import { createClient } from '@supabase/supabase-js'

export async function verifyBearerToken(
  authorization: string | undefined,
): Promise<{ userId: string }> {
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header')
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (!token) throw new Error('Missing access token')

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Server missing SUPABASE_URL or SUPABASE_ANON_KEY')
  }

  const supabase = createClient(url, anonKey)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    throw new Error('Invalid or expired session')
  }

  return { userId: data.user.id }
}
