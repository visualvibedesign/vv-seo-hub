// API route: /api/auth/:action  (phase 1, step 2)
//   POST /api/auth/login   { password, remember }  -> signs this browser in (same password + cookie as HQ)
//   POST /api/auth/logout                          -> signs this browser out
//   GET  /api/auth/me                              -> { signedIn: true | false }
//   GET  /api/auth/health                          -> setup check (signed-in only; /api/health rewrites here)
// No change/forgot password here: the team password is managed in HQ only (SEO Hub reads it).
import { AuthConfigError, checkPassword, clearSessionCookies, isSignedIn, requireSession, sessionCookies, withCookies } from '../../server/utils/auth.js'
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
