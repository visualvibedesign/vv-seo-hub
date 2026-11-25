// API route: /api/autofill/:action  (redesign step 6). Signed-in only.
//   GET  /api/autofill/list?site=<site id>                       -> { rows: AutofillRow[] }  (latest per kind)
//   POST /api/autofill/run-rules { siteId }                        -> { rows }  (Day 2 plain-code rules)
//   POST /api/autofill/decide { siteId, autofillId, decisions[] } -> { rows }  (approve / reject rows)
//   POST /api/autofill/estimate { siteId, task }                  -> { estimate } (count_tokens: free, nothing saved)
//   POST /api/autofill/run-ai { siteId, task }                    -> { rows }  (one Claude call, logged; Ready to review)
import { DatabaseError } from '../../server/clients/supabase.js'
import { AutofillInputError, decide, listAutofill, runDay2Rules } from '../../server/services/autofillService.js'
import { estimate, run } from '../../server/services/aiAutofillService.js'
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
    if (method === 'GET' && action === 'list') return Response.json({ rows: await listAutofill(new URL(request.url).searchParams.get('site') ?? '') })
    if (method === 'POST' && action === 'run-rules') {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown }
      return Response.json({ rows: await runDay2Rules(String(body.siteId ?? '')) })
    }
    if (method === 'POST' && action === 'decide') return Response.json({ rows: await decide(await request.json().catch(() => null)) })
    // Claude tasks: estimate first (shown to Angel), then run only on Angel's click.
    if (method === 'POST' && (action === 'estimate' || action === 'run-ai')) {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; task?: unknown }
      const task = String(body.task ?? '') as AiTask
      if (!(task in AI_TASKS)) return Response.json({ error: 'invalid', detail: 'Unknown auto-fill task.' }, { status: 400 })
      if (action === 'estimate') return Response.json({ estimate: await estimate(String(body.siteId ?? ''), task) })
      return Response.json({ rows: await run(String(body.siteId ?? ''), task) })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof AutofillInputError || err instanceof AiConfigError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof AiCallError) return Response.json({ error: 'ai', detail: err.message }, { status: 502 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
