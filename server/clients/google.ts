// Google APIs with the agency's service account (phase 2a, Angel Nov 26: one service account, key in env vars only).
// GOOGLE_SERVICE_ACCOUNT_JSON = the service account's JSON key (server only, never VITE_, never in the database,
// never logged). Its email is added once per client as a user on the Search Console property and a Viewer on the
// GA4 property. We sign the token request ourselves (RS256 JWT with Node's crypto): no Google library.
// Scopes are read-only: Search Console, Analytics (Data + Admin APIs).
import { createSign } from 'node:crypto'

export class GoogleConfigError extends Error {}
export class GoogleApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type ServiceAccount = { client_email: string; private_key: string }
const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/analytics.readonly']
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

let account: ServiceAccount | null = null
let cached: { token: string; expires: number } | null = null

function serviceAccount(): ServiceAccount {
  if (account) return account
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw?.trim()) throw new GoogleConfigError('Google isn’t set up on the server yet: add GOOGLE_SERVICE_ACCOUNT_JSON (the service account key).')
  let j: Partial<ServiceAccount>
  try {
    j = JSON.parse(raw) as Partial<ServiceAccount>
  } catch {
    throw new GoogleConfigError('GOOGLE_SERVICE_ACCOUNT_JSON isn’t valid JSON. Paste the whole key file as one value.')
  }
  if (!j.client_email || !j.private_key) throw new GoogleConfigError('GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.')
  account = { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, '\n') }
  return account
}

/** The email to add on each client's Search Console + GA4 (null when Google isn't set up). */
export function serviceAccountEmail(): string | null {
  try {
    return serviceAccount().client_email
  } catch {
    return null
  }
}

const b64url = (s: string) => Buffer.from(s).toString('base64url')

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token
  const a = serviceAccount()
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: a.client_email, scope: SCOPES.join(' '), aud: TOKEN_URL, iat: now, exp: now + 3600 }))}`
  let signature: string
  try {
    signature = createSign('RSA-SHA256').update(unsigned).sign(a.private_key).toString('base64url')
  } catch {
    throw new GoogleConfigError('The service account key in GOOGLE_SERVICE_ACCOUNT_JSON can’t sign (private_key looks wrong).')
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(20_000),
  })
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!res.ok || !j.access_token) throw new GoogleApiError(res.status, `Google sign-in for the service account failed: ${j.error_description ?? j.error ?? res.status}.`)
  cached = { token: j.access_token, expires: Date.now() + (j.expires_in ?? 3600) * 1000 }
  return cached.token
}

/** GET (no body) or POST (JSON body) a Google API; plain-English errors (no key or token in them). */
export async function google<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
  if (!res.ok) {
    const who = serviceAccountEmail() ?? 'the service account'
    const why =
      res.status === 403 || res.status === 401
        ? `No access. Add ${who} to this property (Search Console: Users, Restricted is enough; GA4: Property access, Viewer), then try again.`
        : res.status === 404
          ? 'Google doesn’t know this property. Check the property id.'
          : `Google answered ${res.status}: ${(j.error?.message ?? 'unknown error').slice(0, 200)}`
    throw new GoogleApiError(res.status, why)
  }
  return j as T
}
