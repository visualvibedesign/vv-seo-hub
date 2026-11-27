// Shared team password + signed cookie. Copied from Visual Vibe HQ (server/utils/auth.ts) so both
// apps accept the same password and the same `vv_session` cookie (CONTEXT.md §3).
//
// READ ONLY: SEO Hub only READS the team password hash from HQ's Supabase `settings` table
// (key 'team_password_hash'). It never writes it: changing the password happens in HQ
// (Settings › Change team password). HQ's change-password code was left out on purpose.
//
// Env vars:
//   SESSION_SECRET         must be the SAME value as HQ's (signs the cookie)
//   TEAM_PASSWORD_HASH     fallback when the settings row is missing (same as HQ's)
//   SESSION_COOKIE_DOMAIN  optional, e.g. ".visualvibedesign.com": one sign-in for hq. + seo.
//                          Only used when the site is opened on that domain; localhost and
//                          *.vercel.app keep the normal cookie. Empty until the domains exist.
//
// The cookie format, lifetimes and scrypt settings must stay identical to HQ's, or the shared
// sign-in breaks. If HQ changes them, copy the change here.
import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto'
import { db } from '../clients/supabase.js'

const COOKIE = 'vv_session'
const REMEMBER_DAYS = 30 // "Keep me signed in on this device"
const SESSION_HOURS = 12 // unticked: cookie ends with the browser, and at most after this
const HASH_KEY = 'team_password_hash'
const HASH_TTL_MS = 60_000

// Same settings as HQ's scripts/hash-password.mjs and server/utils/auth.ts.
const SCRYPT = { N: 16384, r: 8, p: 1 }

export class AuthConfigError extends Error {}

let stored: { at: number; hash: string | null } | null = null

/** The hash HQ saved from its Settings page, or null (then the env var is used). Read only. */
async function storedHash(): Promise<string | null> {
  if (stored && Date.now() - stored.at < HASH_TTL_MS) return stored.hash
  let hash: string | null
  try {
    const res = await db().from('settings').select('value').eq('key', HASH_KEY).maybeSingle()
    const v = (res.data as { value: string } | null)?.value ?? null
    hash = v && v.startsWith('scrypt.') ? v : null
  } catch {
    hash = null // Supabase unreachable: fall back to the env password
  }
  stored = { at: Date.now(), hash }
  return hash
}

async function config() {
  const secret = process.env.SESSION_SECRET
  const hash = (await storedHash()) ?? process.env.TEAM_PASSWORD_HASH
  if (!hash || !secret) {
    throw new AuthConfigError('Sign-in is not set up: add SESSION_SECRET and TEAM_PASSWORD_HASH (same values as HQ).')
  }
  return { hash, secret }
}

function matches(password: string, hash: string): boolean {
  const [kind, salt, expected] = hash.split('.')
  if (kind !== 'scrypt' || !salt || !expected) {
    throw new AuthConfigError('The team password hash looks wrong. It comes from HQ: check HQ’s settings or TEAM_PASSWORD_HASH.')
  }
  const want = Buffer.from(expected, 'base64url')
  const got = scryptSync(password, Buffer.from(salt, 'base64url'), want.length, SCRYPT)
  return timingSafeEqual(got, want)
}

/** True if `password` is the team password. */
export async function checkPassword(password: string): Promise<boolean> {
  return matches(password, (await config()).hash)
}

// ---- Session cookie (same format as HQ) ---------------------------------------
// Value: "<expires ms>.<password version>.<signature>". The password version changes when the
// password changes in HQ, so a new password signs everyone out of both apps.

function passwordVersion(hash: string) {
  return createHash('sha256').update(hash).digest('base64url').slice(0, 12)
}

function sign(data: string, secret: string) {
  return createHmac('sha256', secret).update(data).digest('base64url')
}

/** Set-Cookie header values that sign this browser in. */
export async function sessionCookies(request: Request, remember: boolean): Promise<string[]> {
  const { hash, secret } = await config()
  const ms = remember ? REMEMBER_DAYS * 86_400_000 : SESSION_HOURS * 3_600_000
  const data = `${Date.now() + ms}.${passwordVersion(hash)}`
  const value = `${data}.${sign(data, secret)}`
  // No Max-Age when not remembered: the cookie goes away when the browser closes.
  const maxAge = remember ? `; Max-Age=${REMEMBER_DAYS * 86_400}` : ''
  const domain = cookieDomain(request)
  const cookie = `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax${maxAge}${domainAttr(domain)}${secureFlag(request)}`
  return domain ? [clearCookie(request, null), cookie] : [cookie]
}

/** Set-Cookie header values that sign this browser out: this address's cookie and the shared one. */
export function clearSessionCookies(request: Request): string[] {
  const domain = cookieDomain(request)
  return domain ? [clearCookie(request, null), clearCookie(request, domain)] : [clearCookie(request, null)]
}

function clearCookie(request: Request, domain: string | null) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${domainAttr(domain)}${secureFlag(request)}`
}

/** Response headers with one Set-Cookie per cookie. */
export function withCookies(cookies: string[]): Headers {
  const headers = new Headers()
  for (const c of cookies) headers.append('Set-Cookie', c)
  return headers
}

/** SESSION_COOKIE_DOMAIN, but only when this request's host is that domain or under it. */
export function cookieDomain(request: Request): string | null {
  const raw = (process.env.SESSION_COOKIE_DOMAIN ?? '').trim().toLowerCase().replace(/^\./, '')
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(raw)) return null
  const host = new URL(request.url).hostname.toLowerCase()
  return host === raw || host.endsWith(`.${raw}`) ? raw : null
}

function domainAttr(domain: string | null) {
  return domain ? `; Domain=${domain}` : ''
}

/**
 * Sign-in handoff from HQ (2026-11-27; HQ's server/utils/handoff.ts makes the pass). The apps are on
 * different addresses, so HQ sends a 60-second pass in the link:
 * "<expires ms>.<remember 0|1>.<password version>.<signature>", signature = HMAC(SESSION_SECRET,
 * "handoff.<expires>.<remember>.<version>"). Valid -> { remember } (then set this app's cookie), else null.
 * The "handoff." prefix means a pass can never be used as a cookie, and a cookie never as a pass.
 */
export async function checkHandoffPass(pass: string | null): Promise<{ remember: boolean } | null> {
  const [expires, remember, version, signature, extra] = (pass ?? '').split('.')
  if (!expires || !remember || !version || !signature || extra !== undefined) return null
  const { hash, secret } = await config()
  const want = Buffer.from(sign(`handoff.${expires}.${remember}.${version}`, secret))
  const got = Buffer.from(signature)
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  const left = Number(expires) - Date.now()
  if (!(left > 0 && left <= HANDOFF_MAX_MS) || version !== passwordVersion(hash)) return null
  return { remember: remember === '1' }
}

const HANDOFF_MAX_MS = 120_000 // HQ makes 60-second passes; a little slack for clock drift

/** True if the request carries a valid, unexpired session cookie (from SEO Hub or HQ). */
export async function isSignedIn(request: Request): Promise<boolean> {
  const values = readCookies(request, COOKIE)
  if (!values.length) return false
  const { hash, secret } = await config()
  return values.some((v) => validSession(v, hash, secret))
}

function validSession(value: string, hash: string, secret: string): boolean {
  const [expires, version, signature] = value.split('.')
  if (!expires || !version || !signature) return false

  const want = Buffer.from(sign(`${expires}.${version}`, secret))
  const got = Buffer.from(signature)
  if (got.length !== want.length || !timingSafeEqual(got, want)) return false

  return Number(expires) > Date.now() && version === passwordVersion(hash)
}

/** For API routes that need a signed-in team member: returns a 401 response, or null if OK. */
export async function requireSession(request: Request): Promise<Response | null> {
  try {
    return (await isSignedIn(request)) ? null : Response.json({ error: 'Please sign in.' }, { status: 401 })
  } catch (err) {
    if (err instanceof AuthConfigError) return Response.json({ error: 'not_configured', detail: err.message }, { status: 500 })
    throw err
  }
}

function readCookies(request: Request, name: string): string[] {
  const header = request.headers.get('cookie') ?? ''
  const found: string[] = []
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    const value = rest.join('=')
    if (key === name && value) found.push(value)
  }
  return found
}

// Secure cookies on https (Vercel). Plain http on localhost during development.
function secureFlag(request: Request) {
  return new URL(request.url).protocol === 'https:' ? '; Secure' : ''
}
