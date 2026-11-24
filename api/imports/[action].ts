// API route: /api/imports/:action  (phase 1, step 4). Signed-in only.
//   POST /api/imports/preview  ImportPayload                          -> ImportPreview (dry run, nothing saved)
//   POST /api/imports/commit   { payload, file: { base64, type } }    -> { importId, preview }
//   GET  /api/imports/list?site=<site id>                             -> { imports: ImportRecord[] }
//   GET  /api/imports/file?site=<site id>&id=<import id>              -> { url } (60-second download link)
//   GET  /api/imports/delete-check?site=<site id>&id=<import id>      -> DeleteImportCheck (counts for the confirm)
//   POST /api/imports/delete   { siteId, importId }                   -> { keywordsRemoved, fileRemoved }
import { DatabaseError } from '../../server/clients/supabase.js'
import { checkDeleteImport, commitImport, deleteImport, ImportInputError, listImports, previewImport, rawFileUrl } from '../../server/services/importService.js'
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
    if (err instanceof ImportInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
