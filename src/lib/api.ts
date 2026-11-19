// Every call from the browser to /api lives here (same pattern as HQ's src/lib/api.ts).
// The browser never talks to Supabase directly.

export class ApiError extends Error {
  status: number
  code: string
  detail?: string // plain-English explanation from the server, when it sends one
  constructor(status: number, code: string, detail?: string) {
    super(code)
    this.status = status
    this.code = code
    this.detail = detail
  }
}

export async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; detail?: string }
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.detail)
  return data
}

// ---- Sign-in (phase 1, step 2) ------------------------------------------------

export type LoginResult = 'ok' | 'wrong_password' | 'not_configured' | 'network_error'

/** Is this browser signed in? (An HQ sign-in counts too: same cookie.) */
export async function getSession(): Promise<boolean> {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
  if (!res.ok) return false
  const data = (await res.json()) as { signedIn?: boolean }
  return data.signedIn === true
}

/** Signs in with the shared team password. */
export async function login(password: string, remember: boolean): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, remember }),
    })
    if (res.ok) return 'ok'
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (data.error === 'wrong_password') return 'wrong_password'
    if (data.error === 'not_configured') return 'not_configured'
    return 'network_error'
  } catch {
    return 'network_error'
  }
}

/** Signs this browser out. */
export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
}

/** Where to go after signing in: a page of this app only ("/clients/…"); anything else goes home. */
export function safeNext(next: string | null | undefined): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next
  return '/'
}
