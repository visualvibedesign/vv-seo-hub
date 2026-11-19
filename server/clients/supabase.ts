// Supabase client for the backend only (CONTEXT.md §5: no Supabase Auth, no browser access).
// Uses the secret key, which bypasses row level security, so it must never reach the browser.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Supabase → Project Settings → API Keys → Secret key)
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export class DatabaseError extends Error {}

export function db(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new DatabaseError('Supabase is not set up: add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

/** Throws if a Supabase call failed, otherwise returns its data. */
export function must<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new DatabaseError(`${what}: ${result.error.message}`)
  return result.data
}

/** Like must(), for calls that always return rows (insert/upsert ... select). */
export function mustHave<T>(result: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  const data = must(result, what)
  if (data === null || data === undefined) throw new DatabaseError(`${what}: nothing came back`)
  return data
}
