// API route: /api/keywords/:action  (phase 1, step 5). Signed-in only.
//   GET  /api/keywords/list?site=<site id>   -> { keywords: KeywordItem[] }
//   POST /api/keywords/update  KeywordUpdateRequest -> { updated } | { needsConfirm } (nothing saved)
import { DatabaseError } from '../../server/clients/supabase.js'
import { KeywordInputError, listKeywords, updateKeywords } from '../../server/services/keywordService.js'
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
    if (method === 'GET' && action === 'list') {
      return Response.json({ keywords: await listKeywords(new URL(request.url).searchParams.get('site') ?? '') })
    }
    if (method === 'POST' && action === 'update') {
      return Response.json(await updateKeywords(await request.json().catch(() => null)))
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof KeywordInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
