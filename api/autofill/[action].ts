// API route: /api/autofill/:action  (redesign step 6). Signed-in only.
//   GET  /api/autofill/list?site=<site id>                       -> { rows: AutofillRow[] }  (latest per kind)
//   POST /api/autofill/run-rules { siteId }                        -> { rows }  (Day 2 plain-code rules)
//   POST /api/autofill/decide { siteId, autofillId, decisions[] } -> { rows }  (approve / reject rows)
//   POST /api/autofill/estimate { siteId, task }                  -> { estimate } (count_tokens: free, nothing saved)
//   POST /api/autofill/run-ai { siteId, task }                    -> { rows }  (one Claude call, logged; Ready to review)
//   GET  /api/autofill/usage                                       -> { usage: AiUsage } (Settings › Claude usage, read only)
//   POST /api/autofill/hotspots-estimate { siteId, pageIds }       -> HotspotsEstimate (Phase 3; count_tokens, nothing saved)
//   POST /api/autofill/hotspots-draft { siteId, pageIds }          -> { drafts } (one Claude call, logged; Ready to review)
//   POST /api/autofill/brandscript-estimate { siteId }             -> estimate (count_tokens, nothing saved)
//   POST /api/autofill/brandscript-draft { siteId }                -> BrandScript (one Claude call, logged; Ready to review)
//   POST /api/autofill/brief-estimate { siteId, pageId, version }  -> estimate (count_tokens, nothing saved)
//   POST /api/autofill/brief-draft { siteId, pageId, version }     -> PageBrief (one Claude call, logged; Ready to review)
import { DatabaseError } from '../../server/clients/supabase.js'
import { AutofillInputError, decide, listAutofill, retireStale, runDay2Rules } from '../../server/services/autofillService.js'
import { estimate, run } from '../../server/services/aiAutofillService.js'
import { aiUsage } from '../../server/services/aiUsageService.js'
import { draftHotspots, estimateHotspots, HotspotsInputError } from '../../server/services/hotspotsAiService.js'
import { BrandScriptInputError, draftBrandScript, estimateBrandScript } from '../../server/services/brandscriptService.js'
import { draftPageCopy, estimatePageCopy, PageBriefInputError } from '../../server/services/pageBriefService.js'
import { AiCallError } from '../../server/services/aiService.js'
import { AiConfigError } from '../../server/clients/anthropic.js'
import { AI_TASKS, type AiTask } from '../../src/lib/aiModels.js'
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
  try {
    if (method === 'GET' && action === 'usage') return Response.json({ usage: await aiUsage() })
    if (method === 'GET' && action === 'list') return Response.json({ rows: await listAutofill(new URL(request.url).searchParams.get('site') ?? '') })
    if (method === 'POST' && action === 'run-rules') {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown }
      return Response.json({ rows: await runDay2Rules(String(body.siteId ?? '')) })
    }
    if (method === 'GET' && action === 'stale') return Response.json(await retireStale(new URL(request.url).searchParams.get('site') ?? '', false))
    if (method === 'POST' && action === 'retire-stale') {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown }
      await retireStale(String(body.siteId ?? ''), true)
      return Response.json({ rows: await listAutofill(String(body.siteId ?? '')) })
    }
    if (method === 'POST' && action === 'decide') return Response.json({ rows: await decide(await request.json().catch(() => null)) })
    // Phase 3 · Claude hotspot drafts for the picked pages (Ready to review until the page's hotspots are saved).
    if (method === 'POST' && (action === 'hotspots-estimate' || action === 'hotspots-draft')) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      const site = String(body.siteId ?? '')
      return Response.json(action === 'hotspots-estimate' ? await estimateHotspots(site, body) : await draftHotspots(site, body))
    }
    if (method === 'POST' && (action === 'brandscript-estimate' || action === 'brandscript-draft')) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      const site = String(body.siteId ?? '')
      return Response.json(action === 'brandscript-estimate' ? await estimateBrandScript(site) : await draftBrandScript(site))
    }
    if (method === 'POST' && (action === 'brief-estimate' || action === 'brief-draft')) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      const site = String(body.siteId ?? '')
      return Response.json(action === 'brief-estimate' ? await estimatePageCopy(site, body) : await draftPageCopy(site, body))
    }
    // Claude tasks: estimate first (shown to Angel), then run only on Angel's click.
    if (method === 'POST' && (action === 'estimate' || action === 'run-ai')) {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; task?: unknown; input?: unknown }
      // Day 1 only: the pasted text, used for this one call and never stored.
      const input = typeof body.input === 'string' ? body.input.slice(0, 20_001) : undefined
      const task = String(body.task ?? '') as AiTask
      if (!(task in AI_TASKS)) return Response.json({ error: 'invalid', detail: 'Unknown auto-fill task.' }, { status: 400 })
      if (action === 'estimate') return Response.json({ estimate: await estimate(String(body.siteId ?? ''), task, input) })
      return Response.json({ rows: await run(String(body.siteId ?? ''), task, input) })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof AutofillInputError || err instanceof AiConfigError || err instanceof HotspotsInputError || err instanceof BrandScriptInputError || err instanceof PageBriefInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof AiCallError) return Response.json({ error: 'ai', detail: err.message }, { status: 502 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
