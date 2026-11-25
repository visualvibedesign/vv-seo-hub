// API route: /api/industries/:action (migration 0009). Signed-in only.
//   GET  /api/industries/list                    -> { industries: Industry[] }
//   POST /api/industries/add    { label, hint? } -> { industry }  (same name as an existing one → that one)
//   POST /api/industries/rename { key, label, hint? } -> { industry }
import { DatabaseError } from '../../server/clients/supabase.js'
import { addIndustry, IndustryInputError, listIndustries, renameIndustry } from '../../server/services/industryService.js'
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
    if (method === 'GET' && action === 'list') return Response.json({ industries: await listIndustries() })
    if (method === 'POST' && action === 'add') return Response.json({ industry: await addIndustry(await request.json().catch(() => null)) })
    if (method === 'POST' && action === 'rename') return Response.json({ industry: await renameIndustry(await request.json().catch(() => null)) })
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof IndustryInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
