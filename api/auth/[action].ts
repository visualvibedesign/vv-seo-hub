// API route: /api/auth/:action  (phase 1, step 2)
//   POST /api/auth/login   { password, remember }  -> signs this browser in (same password + cookie as HQ)
//   POST /api/auth/logout                          -> signs this browser out
//   GET  /api/auth/me                              -> { signedIn: true | false }
//   GET  /api/auth/health                          -> setup check (signed-in only; /api/health rewrites here)
//   GET  /api/auth/handoff?t=<pass>&next=<page>     -> signed in from HQ (2026-11-27): sets the cookie, opens the page
// No change/forgot password here: the team password is managed in HQ only (SEO Hub reads it).
import { AuthConfigError, checkHandoffPass, checkPassword, clearSessionCookies, isSignedIn, requireSession, sessionCookies, withCookies } from '../../server/utils/auth.js'

/** A page of this site ("/clients/…"), else "/" (same rule as safeNext in src/lib/api.ts). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/'
}
import { healthCheck } from '../../server/services/healthService.js'

const WRONG_PASSWORD_DELAY_MS = 800 // slows down guessing

function actionOf(request: Request) {
  return new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? ''
}

export async function GET(request: Request) {
  return handle(request, 'GET')
}

export async function POST(request: Request) {
  return handle(request, 'POST')
}

async function handle(request: Request, method: 'GET' | 'POST') {
  const action = actionOf(request)
  try {
    if (action === 'health' && method === 'GET') return (await requireSession(request)) ?? (await healthCheck())

    if (action === 'me' && method === 'GET') {
      return Response.json({ signedIn: await isSignedIn(request) })
    }

    // Signed in at HQ: HQ's link carries a 60-second pass (checkHandoffPass). Good pass -> this app's
    // cookie and on to the page. Bad or old pass -> this app's own Sign in page (never a loop).
    if (action === 'handoff' && method === 'GET') {
      const url = new URL(request.url)
      const next = safeNext(url.searchParams.get('next'))
      const ok = await checkHandoffPass(url.searchParams.get('t'))
      if (!ok) {
        const login = new URL(`/login?handoff=failed${next === '/' ? '' : `&next=${encodeURIComponent(next)}`}`, url)
        return new Response(null, { status: 302, headers: { Location: login.href, 'Cache-Control': 'no-store' } })
      }
      const headers = withCookies(await sessionCookies(request, ok.remember))
      headers.set('Location', new URL(next, url).href)
      headers.set('Cache-Control', 'no-store')
      return new Response(null, { status: 302, headers })
    }

    if (action === 'login' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { password?: unknown; remember?: unknown }
      const password = typeof body.password === 'string' ? body.password : ''
      if (!password || !(await checkPassword(password))) {
        await new Promise((r) => setTimeout(r, WRONG_PASSWORD_DELAY_MS))
        return Response.json({ error: 'wrong_password' }, { status: 401 })
      }
      return Response.json({ signedIn: true }, { headers: withCookies(await sessionCookies(request, body.remember === true)) })
    }

    if (action === 'logout' && method === 'POST') {
      return Response.json({ signedIn: false }, { headers: withCookies(clearSessionCookies(request)) })
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof AuthConfigError) {
      return Response.json({ error: 'not_configured', detail: err.message }, { status: 500 })
    }
    throw err
  }
}
