// API route: /api/metrics/:action (phase 2: Google numbers, rankings, map grid, GBP, baseline, results). Signed-in only.
//   GET  /api/metrics/google?site=<site id>             -> GoogleSetup (email to add, saved link, properties it can see)
//   POST /api/metrics/google-test { gscProperty, ga4Property } -> GoogleTestResult (7 days, nothing saved)
//   POST /api/metrics/google-save { siteId, gscProperty, ga4Property, queryWords } -> { link }
// (One file for every phase 2 action: the app stays within Vercel Hobby's 12 server functions.)
import { DatabaseError } from '../../server/clients/supabase.js'
import { GoogleConfigError } from '../../server/clients/google.js'
import { googleSetup, GoogleInputError, saveGoogleLink, testGoogle } from '../../server/services/googleService.js'
import { requireSession } from '../../server/utils/auth.js'

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
  const denied = await requireSession(request)
  if (denied) return denied
  const action = actionOf(request)
  const params = new URL(request.url).searchParams
  try {
    if (method === 'GET' && action === 'google') return Response.json(await googleSetup(params.get('site') ?? ''))
    if (method === 'POST' && action === 'google-test') return Response.json(await testGoogle(await request.json().catch(() => null)))
    if (method === 'POST' && action === 'google-save') {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown }
      return Response.json({ link: await saveGoogleLink(String(body.siteId ?? ''), body) })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof GoogleInputError || err instanceof GoogleConfigError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
