// API route: /api/metrics/:action (phase 2: Google numbers, rankings, map grid, GBP, baseline, results). Signed-in only.
//   GET  /api/metrics/google?site=<site id>             -> GoogleSetup (email to add, saved link, properties it can see)
//   POST /api/metrics/google-test { gscProperty, ga4Property } -> GoogleTestResult (7 days, nothing saved)
//   POST /api/metrics/google-save { siteId, gscProperty, ga4Property, queryWords } -> { link }
//   GET  /api/metrics/overview?site=<site id>&range=28d|3m|12m -> MetricsOverview (Search Console + GA4 numbers)
//   POST /api/metrics/sync { siteId }                    -> MetricsSyncResult ("Update numbers")
//   GET  /api/metrics/cron                               -> daily pull for every linked client. Vercel Cron only:
//        Authorization: Bearer <CRON_SECRET> (no login cookie); without CRON_SECRET set it always refuses.
// (One file for every phase 2 action: the app stays within Vercel Hobby's 12 server functions.)
import { DatabaseError } from '../../server/clients/supabase.js'
import { GoogleConfigError } from '../../server/clients/google.js'
import { googleSetup, GoogleInputError, saveGoogleLink, testGoogle } from '../../server/services/googleService.js'
import { metricsOverview, syncAll, syncClient } from '../../server/services/metricsService.js'
import { requireSession } from '../../server/utils/auth.js'
import { timingSafeEqual } from 'node:crypto'
import type { MetricRange } from '../../src/types/seo.js'

/** The cron's Bearer token = CRON_SECRET (Vercel sends it), compared in constant time. */
function cronAllowed(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const got = Buffer.from(request.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

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
  if (actionOf(request) === 'cron') {
    if (method !== 'GET' || !cronAllowed(request)) return Response.json({ error: 'Not allowed' }, { status: 401 })
    return Response.json(await syncAll())
  }
  const denied = await requireSession(request)
  if (denied) return denied
  const action = actionOf(request)
  const params = new URL(request.url).searchParams
  try {
    if (method === 'GET' && action === 'google') return Response.json(await googleSetup(params.get('site') ?? ''))
    if (method === 'POST' && action === 'google-test') return Response.json(await testGoogle(await request.json().catch(() => null)))
    if (method === 'GET' && action === 'overview') {
      const range = (['28d', '3m', '12m'].includes(params.get('range') ?? '') ? params.get('range') : '28d') as MetricRange
      return Response.json(await metricsOverview(params.get('site') ?? '', range))
    }
    if (method === 'POST' && action === 'sync') {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown }
      return Response.json(await syncClient(String(body.siteId ?? '')))
    }
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
