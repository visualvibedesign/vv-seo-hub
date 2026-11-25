// API route: /api/imports/:action  (phase 1, step 4). Signed-in only.
//   POST /api/imports/preview  ImportPayload                          -> ImportPreview (dry run, nothing saved)
//   POST /api/imports/commit   { payload, file: { base64, type } }    -> { importId, preview }
//   GET  /api/imports/list?site=<site id>                             -> { imports: ImportRecord[] }
//   GET  /api/imports/file?site=<site id>&id=<import id>              -> { url } (60-second download link)
//   GET  /api/imports/delete-check?site=<site id>&id=<import id>      -> DeleteImportCheck (counts for the confirm)
//   POST /api/imports/delete   { siteId, importId }                   -> { keywordsRemoved, fileRemoved }
//   POST /api/imports/sams-preview { siteId, fileName, base64 }       -> { plan } (Sam's Guide dry run, nothing saved)
//   POST /api/imports/sams-apply   { siteId, fileName, base64, replace } -> { importId, plan } (only on Apply)
//   POST /api/imports/sheet-preview { siteId, fileName, base64 }      -> { plan } (whole client Sheet .xlsx dry run, nothing saved)
//   POST /api/imports/sheet-apply   { siteId, fileName, base64, replace, competitors } -> SheetApplyResult (only on Apply)
// (One file for every import action: the app stays within Vercel Hobby's 12 server functions.)
import { DatabaseError } from '../../server/clients/supabase.js'
import { checkDeleteImport, commitImport, deleteImport, ImportInputError, listImports, previewImport, rawFileUrl } from '../../server/services/importService.js'
import { applySamsGuide, decodeSheet, planSamsGuide, SamsGuideInputError } from '../../server/services/samsGuideService.js'
import { applySheet, previewSheet, SheetInputError } from '../../server/services/sheetImportService.js'
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
    if (method === 'POST' && action === 'preview') {
      return Response.json(await previewImport(await request.json().catch(() => null)))
    }
    if (method === 'POST' && action === 'commit') {
      const body = (await request.json().catch(() => ({}))) as { payload?: unknown; file?: { base64?: unknown; type?: unknown } }
      const file = typeof body.file?.base64 === 'string' ? { base64: body.file.base64, type: typeof body.file.type === 'string' ? body.file.type : 'text/csv' } : null
      return Response.json(await commitImport(body.payload, file))
    }
    if (method === 'POST' && (action === 'sams-preview' || action === 'sams-apply')) {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; fileName?: unknown; base64?: unknown; replace?: unknown }
      const siteId = String(body.siteId ?? '')
      const file = decodeSheet(body.base64)
      if (action === 'sams-preview') return Response.json({ plan: await planSamsGuide(siteId, file.text) })
      const replace = Array.isArray(body.replace) ? body.replace.filter((x): x is string => typeof x === 'string').slice(0, 500) : []
      const fileName = typeof body.fileName === 'string' && body.fileName ? body.fileName.slice(0, 200) : 'sams-guide.csv'
      return Response.json(await applySamsGuide(siteId, file, fileName, replace))
    }
    if (method === 'POST' && (action === 'sheet-preview' || action === 'sheet-apply')) {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; fileName?: unknown; base64?: unknown; replace?: unknown; competitors?: unknown; confirmOwner?: unknown }
      const siteId = String(body.siteId ?? '')
      if (action === 'sheet-preview') return Response.json({ plan: await previewSheet(siteId, body.fileName, body.base64) })
      const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 500) : [])
      return Response.json(await applySheet(siteId, body.fileName, body.base64, list(body.replace), list(body.competitors), body.confirmOwner === true))
    }
    if (method === 'GET' && action === 'list') {
      return Response.json({ imports: await listImports(params.get('site') ?? '') })
    }
    if (method === 'GET' && action === 'file') {
      return Response.json({ url: await rawFileUrl(params.get('site') ?? '', params.get('id') ?? '') })
    }
    if (method === 'GET' && action === 'delete-check') {
      return Response.json(await checkDeleteImport(params.get('site') ?? '', params.get('id') ?? ''))
    }
    if (method === 'POST' && action === 'delete') {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; importId?: unknown }
      return Response.json(await deleteImport(String(body.siteId ?? ''), String(body.importId ?? '')))
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof SheetInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof SamsGuideInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof ImportInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
