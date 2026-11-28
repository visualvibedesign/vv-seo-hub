// API route: /api/clusters/:action  (redesign step 4c; Phase 3 pages). Signed-in only.
//   GET  /api/clusters/list?site=<site id>       -> { pages: ClusterPage[] }
//   GET  /api/clusters/pages?site=<site id>      -> PagesState (sitemap + hotspots, Phase 3)
//   POST /api/clusters/pages-backfill {siteId, apply}       -> PagesBackfillPlan (dry run unless apply)
//   POST /api/clusters/hotspots-save {siteId, pageId, ...}  -> PagesState
//   POST /api/clusters/page-add {siteId, name, category, type?, keywordId?} -> PagesState
//   POST /api/clusters/structure {siteId, structure}        -> PagesState
//   POST /api/clusters/page-parent {siteId, pageId, parentId|null} -> PagesState (Site plan)
//   POST /api/clusters/redirect-status {siteId, id, status}  -> PagesState (Queued / Sent to site / Live)
//   POST /api/clusters/hotspots-skip {siteId, pageId}       -> PagesState (drops Claude's draft for one page)
//   GET  /api/clusters/brandscript?site=<site id>           -> BrandScript (A–P + Claude's open draft)
//   POST /api/clusters/brandscript-save {siteId, answers}   -> BrandScript (a changed answer clears "confirmed")
//   POST /api/clusters/brandscript-confirm {siteId, confirmed} -> BrandScript
//   POST /api/clusters/brandscript-skip {siteId}            -> BrandScript (drops Claude's draft)
// (Importing a Sheet Clusters CSV is a script for now: scripts/import-clusters.ts.)
import { DatabaseError } from '../../server/clients/supabase.js'
import { ClusterInputError, listClusters } from '../../server/services/clusterService.js'
import { addPage, backfillPages, pagesState, PagesInputError, saveHotspots, setParent, setRedirectStatus, setStructure, skipHotspotDraft } from '../../server/services/pagesService.js'
import { brandScript, BrandScriptInputError, confirmBrandScript, saveBrandScript, skipBrandDraft } from '../../server/services/brandscriptService.js'
import { requireSession } from '../../server/utils/auth.js'

export async function GET(request: Request) {
  return handle(request, 'GET')
}

export async function POST(request: Request) {
  return handle(request, 'POST')
}

async function handle(request: Request, method: 'GET' | 'POST') {
  const denied = await requireSession(request)
  if (denied) return denied
  const url = new URL(request.url)
  const action = url.pathname.split('/').filter(Boolean).pop()
  try {
    if (method === 'GET' && action === 'list') return Response.json({ pages: await listClusters(url.searchParams.get('site') ?? '') })
    if (method === 'GET' && action === 'pages') return Response.json(await pagesState(url.searchParams.get('site') ?? ''))
    if (method === 'GET' && action === 'brandscript') return Response.json(await brandScript(url.searchParams.get('site') ?? ''))
    if (method === 'POST' && ['brandscript-save', 'brandscript-confirm', 'brandscript-skip'].includes(action ?? '')) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown }
      const site = String(body.siteId ?? '')
      if (action === 'brandscript-save') return Response.json(await saveBrandScript(site, body))
      if (action === 'brandscript-confirm') return Response.json(await confirmBrandScript(site, body))
      return Response.json(await skipBrandDraft(site))
    }
    if (method === 'POST' && ['pages-backfill', 'hotspots-save', 'page-add', 'structure', 'page-parent', 'redirect-status', 'hotspots-skip'].includes(action ?? '')) {
      const body = ((await request.json().catch(() => null)) ?? {}) as { siteId?: unknown; apply?: unknown }
      const site = String(body.siteId ?? '')
      if (action === 'pages-backfill') return Response.json(await backfillPages(site, body.apply === true))
      if (action === 'hotspots-save') return Response.json(await saveHotspots(site, body))
      if (action === 'page-add') return Response.json(await addPage(site, body))
      if (action === 'page-parent') return Response.json(await setParent(site, body))
      if (action === 'redirect-status') return Response.json(await setRedirectStatus(site, body))
      if (action === 'hotspots-skip') return Response.json(await skipHotspotDraft(site, body))
      return Response.json(await setStructure(site, body))
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof ClusterInputError || err instanceof PagesInputError || err instanceof BrandScriptInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
