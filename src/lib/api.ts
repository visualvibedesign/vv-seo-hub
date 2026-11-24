// Every call from the browser to /api lives here (same pattern as HQ's src/lib/api.ts).
// The browser never talks to Supabase directly.
import type { AccountKind, AccountStatus, ClientAccount, ClientDetail, ClientInput, ClientSummary, DeleteImportCheck, ImportPayload, ImportPreview, ImportRecord, KeywordItem, KeywordUpdateRequest, KeywordUpdateResult, SiteIdCheck } from '../types/seo'

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

// ---- Clients (phase 1, step 3) --------------------------------------------------

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function getClients(): Promise<{ clients: ClientSummary[] }> {
  return call('/api/clients/list')
}

export function getClient(siteId: string): Promise<{ client: ClientDetail }> {
  return call(`/api/clients/get?site=${encodeURIComponent(siteId)}`)
}

/** Cleaned site URL + its Vibe SEO site id, and whether another client already uses it. */
export function checkSiteId(url: string, current?: string): Promise<SiteIdCheck> {
  const q = new URLSearchParams({ url })
  if (current) q.set('current', current)
  return call(`/api/clients/site-id?${q}`)
}

/** Adds a client (no siteId) or saves an existing one. Returns the site id (new if the URL changed). */
export function saveClient(client: ClientInput, siteId?: string): Promise<{ siteId: string }> {
  return call('/api/clients/save', json({ siteId, client }))
}

export function saveAccount(
  siteId: string,
  account: { kind: AccountKind; status: AccountStatus; nextAction: string; note: string },
): Promise<{ account: ClientAccount }> {
  return call('/api/clients/account', json({ siteId, account }))
}

/** Where to go after signing in: a page of this app only ("/clients/…"); anything else goes home. */
export function safeNext(next: string | null | undefined): string {
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) return next
  return '/'
}

// ---- CSV imports (phase 1, step 4) ---------------------------------------------------

/** Dry run: what the import would do (nothing is saved). */
export function previewImport(payload: ImportPayload): Promise<ImportPreview> {
  return call('/api/imports/preview', json(payload))
}

/** Saves the import: keywords, history rows and the raw file (base64, untouched). */
export function commitImport(payload: ImportPayload, file: { base64: string; type: string }): Promise<{ importId: string; preview: ImportPreview }> {
  return call('/api/imports/commit', json({ payload, file }))
}

export function getImports(siteId: string): Promise<{ imports: ImportRecord[] }> {
  return call(`/api/imports/list?site=${encodeURIComponent(siteId)}`)
}

/** A 60-second download link for an import's raw file. */
export function getImportFileUrl(siteId: string, importId: string): Promise<{ url: string }> {
  return call(`/api/imports/file?site=${encodeURIComponent(siteId)}&id=${encodeURIComponent(importId)}`)
}

/** Counts for the "Delete this import" confirm (nothing is deleted). */
export function checkDeleteImport(siteId: string, importId: string): Promise<DeleteImportCheck> {
  return call(`/api/imports/delete-check?site=${encodeURIComponent(siteId)}&id=${encodeURIComponent(importId)}`)
}

// ---- Keyword database (phase 1, step 5) ------------------------------------------------

export function getKeywords(siteId: string): Promise<{ keywords: KeywordItem[] }> {
  return call(`/api/keywords/list?site=${encodeURIComponent(siteId)}`)
}

/** One row or many. Bulk KP range over existing ranges returns { needsConfirm } and saves nothing. */
export function updateKeywords(req: KeywordUpdateRequest): Promise<KeywordUpdateResult> {
  return call('/api/keywords/update', json(req))
}

/** Deletes an import: its history rows, raw file, and the keywords that only came from it. */
export function deleteImport(siteId: string, importId: string): Promise<{ keywordsRemoved: number; fileRemoved: boolean }> {
  return call('/api/imports/delete', json({ siteId, importId }))
}
