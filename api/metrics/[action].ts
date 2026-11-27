// API route: /api/metrics/:action (phase 2: Google numbers, rankings, map grid, GBP, baseline, results). Signed-in only.
//   GET  /api/metrics/google?site=<site id>             -> GoogleSetup (email to add, saved link, properties it can see)
//   POST /api/metrics/google-test { gscProperty, ga4Property } -> GoogleTestResult (7 days, nothing saved)
//   POST /api/metrics/google-save { siteId, gscProperty, ga4Property, queryWords } -> { link }
//   GET  /api/metrics/overview?site=<site id>&range=28d|3m|12m -> MetricsOverview (Search Console + GA4 numbers)
//   POST /api/metrics/sync { siteId }                    -> MetricsSyncResult ("Update numbers")
//   GET  /api/metrics/rankings?site=<site id>           -> RankingsOverview (Semrush Position Tracking CSV)
//   GET  /api/metrics/local?site=<site id>              -> LocalState (GBP periods + map grid scans)
//   POST /api/metrics/gbp-save { siteId, ...GbpInput }  -> { snapshot }    POST /api/metrics/gbp-delete { siteId, id }
//   POST /api/metrics/map-save { siteId, ...MapGridInput } -> { grid }   POST /api/metrics/map-delete { siteId, id }
//   GET  /api/metrics/cron                               -> daily pull for every linked client. Vercel Cron only:
//        Authorization: Bearer <CRON_SECRET> (no login cookie); without CRON_SECRET set it always refuses.
// (One file for every phase 2 action: the app stays within Vercel Hobby's 12 server functions.)
import { DatabaseError } from '../../server/clients/supabase.js'
import { GoogleConfigError } from '../../server/clients/google.js'
import { googleSetup, GoogleInputError, saveGoogleLink, testGoogle } from '../../server/services/googleService.js'
import { metricsOverview, syncAll, syncClient } from '../../server/services/metricsService.js'
import { rankingsOverview, RankInputError } from '../../server/services/rankService.js'
import { deleteGbp, deleteMapGrid, localState, LocalInputError, saveGbp, saveMapGrid } from '../../server/services/localService.js'
import { baselineById, BaselineInputError, baselineState, saveBaseline } from '../../server/services/baselineService.js'
import { createReport, previewReport, refreshReport, reportById, ReportInputError, reportsState, saveReportActions, setReportStatus } from '../../server/services/reportService.js'
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
    if (method === 'GET' && action === 'rankings') return Response.json(await rankingsOverview(params.get('site') ?? ''))
    if (method === 'GET' && action === 'local') return Response.json(await localState(params.get('site') ?? ''))
    if (method === 'POST' && ['gbp-save', 'gbp-delete', 'map-save', 'map-delete'].includes(action)) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown; id?: unknown }
      const site = String(body.siteId ?? '')
      if (action === 'gbp-save') return Response.json({ snapshot: await saveGbp(site, body) })
      if (action === 'map-save') return Response.json({ grid: await saveMapGrid(site, body) })
      if (action === 'gbp-delete') await deleteGbp(site, body.id)
      else await deleteMapGrid(site, body.id)
      return Response.json({ ok: true })
    }
    // Phase 2e · Baseline: state (current + live + history), one past baseline, save (new / fill missing)
    if (method === 'GET' && action === 'baseline') return Response.json(await baselineState(params.get('site') ?? ''))
    if (method === 'GET' && action === 'baseline-history') return Response.json(await baselineById(params.get('site') ?? '', params.get('id')))
    if (method === 'POST' && action === 'baseline-save') {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      return Response.json(await saveBaseline(String(body.siteId ?? ''), body))
    }
    // Phase 2f · Monthly reports: list (+ months, clicks per month), one report, create, refresh, status, next actions
    if (method === 'GET' && action === 'reports') return Response.json(await reportsState(params.get('site') ?? ''))
    if (method === 'GET' && action === 'report-preview') return Response.json(await previewReport(params.get('site') ?? '', params.get('month')))
    if (method === 'GET' && action === 'report') return Response.json(await reportById(params.get('site') ?? '', params.get('id')))
    if (method === 'POST' && ['report-create', 'report-refresh', 'report-status', 'report-actions'].includes(action)) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      const site = String(body.siteId ?? '')
      if (action === 'report-create') return Response.json(await createReport(site, body))
      if (action === 'report-refresh') return Response.json(await refreshReport(site, body))
      if (action === 'report-status') return Response.json(await setReportStatus(site, body))
      return Response.json(await saveReportActions(site, body))
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
    if (err instanceof GoogleInputError || err instanceof GoogleConfigError || err instanceof RankInputError || err instanceof LocalInputError || err instanceof BaselineInputError || err instanceof ReportInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
