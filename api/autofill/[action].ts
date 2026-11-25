// API route: /api/autofill/:action  (redesign step 6). Signed-in only.
//   GET  /api/autofill/list?site=<site id>                       -> { rows: AutofillRow[] }  (latest per kind)
//   POST /api/autofill/run-rules { siteId }                        -> { rows }  (Day 2 plain-code rules)
//   POST /api/autofill/decide { siteId, autofillId, decisions[] } -> { rows }  (approve / reject rows)
import { DatabaseError } from '../../server/clients/supabase.js'
import { AutofillInputError, decide, listAutofill, runDay2Rules } from '../../server/services/autofillService.js'
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
    if (method === 'GET' && action === 'list') return Response.json({ rows: await listAutofill(new URL(request.url).searchParams.get('site') ?? '') })
    if (method === 'POST' && action === 'run-rules') {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown }
      return Response.json({ rows: await runDay2Rules(String(body.siteId ?? '')) })
    }
    if (method === 'POST' && action === 'decide') return Response.json({ rows: await decide(await request.json().catch(() => null)) })
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof AutofillInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
