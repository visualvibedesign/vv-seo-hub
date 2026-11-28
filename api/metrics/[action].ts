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
//   GET  /api/metrics/gbp-check?site=<site id>          -> GbpCheckState (4a: map pack S1–S3, factors, business details)
//   POST /api/metrics/gbp-search-save | gbp-competitor-save | gbp-competitor-delete | gbp-factor-save | gbp-profile-save
//        { siteId, ... } -> GbpCheckState
//   POST /api/metrics/map-shot-estimate { siteId, image } -> ScreenshotEstimate
//   POST /api/metrics/map-shot-read | map-shot-approve | map-shot-discard { siteId, ... } -> GbpCheckState (Claude, Ready to review)
//   GET  /api/metrics/gbp-care?site=<site id>           -> GbpCareState (4b: products, reviews, 13-week posts)
//   POST /api/metrics/gbp-care-save | gbp-product-save | gbp-product-delete | review-request-save | review-request-delete |
//        gbp-post-save | gbp-post-clear | gbp-products-approve | gbp-posts-approve | gbp-draft-skip { siteId, ... } -> GbpCareState
//   GET  /api/metrics/links?site=<site id>              -> LinksState (4c: citations, Backlink Gap, opportunities, premier, …)
//   POST /api/metrics/links-write { siteId, op, ... }  -> LinksState (pastes: { rows, skipped, state? }; dry run unless apply)
//   GET  /api/metrics/cron                              -> daily pull for every linked client. Vercel Cron only:
//        Authorization: Bearer <CRON_SECRET> (no login cookie); without CRON_SECRET set it always refuses.
// (One file for every phase 2 action: the app stays within Vercel Hobby's 12 server functions.)
import { DatabaseError } from '../../server/clients/supabase.js'
import { GoogleConfigError } from '../../server/clients/google.js'
import { googleSetup, GoogleInputError, saveGoogleLink, testGoogle } from '../../server/services/googleService.js'
import { metricsOverview, syncAll, syncClient } from '../../server/services/metricsService.js'
import { rankingsOverview, RankInputError } from '../../server/services/rankService.js'
import { deleteGbp, deleteMapGrid, localState, LocalInputError, saveGbp, saveMapGrid } from '../../server/services/localService.js'
import { baselineById, BaselineInputError, baselineState, saveBaseline } from '../../server/services/baselineService.js'
import { approveReportNotes, createReport, discardReportNotes, draftReportNotes, estimateReportNotes, previewReport, refreshReport, reportById, ReportInputError, reportsState, saveReportActions, setReportStatus } from '../../server/services/reportService.js'
import { approveGbpShot, discardGbpShot, estimateGbpShot, gbpReadFor, readGbpShot, ScreenshotInputError } from '../../server/services/screenshotService.js'
import { deleteMapCompetitor, GbpCheckInputError, gbpCheckState, saveGbpFactor, saveGbpProfile, saveMapCompetitor, saveMapSearch } from '../../server/services/gbpCheckService.js'
import { approveMapShot, discardMapShot, estimateMapShot, readMapShot } from '../../server/services/mapShotService.js'
import { clearPost, deleteProduct, deleteRequest, GbpCareInputError, gbpCareState, saveCare, savePost, saveProduct, saveRequest } from '../../server/services/gbpCareService.js'
import { approvePosts, approveProducts, skipCareDraft } from '../../server/services/gbpCareAiService.js'
import { AiCallError } from '../../server/services/aiService.js'
import { AiConfigError } from '../../server/clients/anthropic.js'
import { linksState, linksWrite, LinksInputError } from '../../server/services/linksService.js'
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
    if (method === 'GET' && action === 'local') {
      const site = params.get('site') ?? ''
      const [local, gbpRead] = await Promise.all([localState(site), gbpReadFor(site)])
      return Response.json({ ...local, gbpRead })
    }
    // 2g · GBP screenshot: estimate (count only), read (Claude → "Ready to review"), approve (normal GBP save), discard.
    // The image is in the request body only: never stored or logged.
    if (method === 'POST' && ['shot-estimate', 'shot-read', 'shot-approve', 'shot-discard'].includes(action)) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      const site = String(body.siteId ?? '')
      if (action === 'shot-estimate') return Response.json(await estimateGbpShot(site, body))
      if (action === 'shot-read') return Response.json({ read: await readGbpShot(site, body) })
      if (action === 'shot-approve') return Response.json({ snapshot: await approveGbpShot(site, body) })
      return Response.json(await discardGbpShot(site, body))
    }
    if (method === 'POST' && ['gbp-save', 'gbp-delete', 'map-save', 'map-delete'].includes(action)) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown; id?: unknown }
      const site = String(body.siteId ?? '')
      if (action === 'gbp-save') return Response.json({ snapshot: await saveGbp(site, body) })
      if (action === 'map-save') return Response.json({ grid: await saveMapGrid(site, body) })
      if (action === 'gbp-delete') await deleteGbp(site, body.id)
      else await deleteMapGrid(site, body.id)
      return Response.json({ ok: true })
    }
    // Phase 4a · GBP check (Day 4): map pack per service, Whitespark factors, business details (public only, no address)
    if (method === 'GET' && action === 'gbp-check') return Response.json(await gbpCheckState(params.get('site') ?? ''))
    if (method === 'POST' && ['gbp-search-save', 'gbp-competitor-save', 'gbp-competitor-delete', 'gbp-factor-save', 'gbp-profile-save'].includes(action)) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      const site = String(body.siteId ?? '')
      if (action === 'gbp-search-save') return Response.json(await saveMapSearch(site, body))
      if (action === 'gbp-competitor-save') return Response.json(await saveMapCompetitor(site, body))
      if (action === 'gbp-competitor-delete') return Response.json(await deleteMapCompetitor(site, body))
      if (action === 'gbp-factor-save') return Response.json(await saveGbpFactor(site, body))
      return Response.json(await saveGbpProfile(site, body))
    }
    // 4a step 4 · Maps / Pleper screenshot → competitor rows. The image is in the request body only: never stored or logged.
    if (method === 'POST' && ['map-shot-estimate', 'map-shot-read', 'map-shot-approve', 'map-shot-discard'].includes(action)) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      const site = String(body.siteId ?? '')
      if (action === 'map-shot-estimate') return Response.json(await estimateMapShot(site, body))
      if (action === 'map-shot-read') return Response.json(await readMapShot(site, body))
      if (action === 'map-shot-approve') return Response.json(await approveMapShot(site, body))
      return Response.json(await discardMapShot(site, body))
    }
    // Phase 4b · GBP care (Day 7): products, review tracker + email, 13-week posts, care settings
    if (method === 'GET' && action === 'gbp-care') return Response.json(await gbpCareState(params.get('site') ?? ''))
    if (method === 'POST' && ['gbp-care-save', 'gbp-product-save', 'gbp-product-delete', 'review-request-save', 'review-request-delete', 'gbp-post-save', 'gbp-post-clear', 'gbp-products-approve', 'gbp-posts-approve', 'gbp-draft-skip'].includes(action)) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      const site = String(body.siteId ?? '')
      if (action === 'gbp-care-save') return Response.json(await saveCare(site, body))
      if (action === 'gbp-product-save') return Response.json(await saveProduct(site, body))
      if (action === 'gbp-product-delete') return Response.json(await deleteProduct(site, body))
      if (action === 'review-request-save') return Response.json(await saveRequest(site, body))
      if (action === 'review-request-delete') return Response.json(await deleteRequest(site, body))
      if (action === 'gbp-post-clear') return Response.json(await clearPost(site, body))
      if (action === 'gbp-products-approve') return Response.json(await approveProducts(site, body))
      if (action === 'gbp-posts-approve') return Response.json(await approvePosts(site, body))
      if (action === 'gbp-draft-skip') return Response.json(await skipCareDraft(site, body))
      return Response.json(await savePost(site, body))
    }
    // Phase 4c · Links (Days 8–9): one read, one write with an op (still within the 12 functions)
    if (method === 'GET' && action === 'links') return Response.json(await linksState(params.get('site') ?? ''))
    if (method === 'POST' && action === 'links-write') {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      return Response.json(await linksWrite(String(body.siteId ?? ''), body))
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
    // 2f step 3 · notes: estimate (count only), Claude draft (saved as "Ready to review"), approve (Angel's text), discard
    if (method === 'GET' && action === 'report-notes-estimate') return Response.json(await estimateReportNotes(params.get('site') ?? '', params.get('id')))
    if (method === 'POST' && ['report-notes-draft', 'report-notes-approve', 'report-notes-discard'].includes(action)) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      const site = String(body.siteId ?? '')
      if (action === 'report-notes-draft') return Response.json(await draftReportNotes(site, body))
      if (action === 'report-notes-approve') return Response.json(await approveReportNotes(site, body))
      return Response.json(await discardReportNotes(site, body))
    }
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
    if (err instanceof GoogleInputError || err instanceof GoogleConfigError || err instanceof RankInputError || err instanceof LocalInputError || err instanceof BaselineInputError || err instanceof ReportInputError || err instanceof ScreenshotInputError || err instanceof GbpCheckInputError || err instanceof GbpCareInputError || err instanceof AiConfigError || err instanceof LinksInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof AiCallError) return Response.json({ error: 'ai', detail: err.message }, { status: 502 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
