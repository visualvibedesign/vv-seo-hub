// API route: /api/guide/:action  (redesign step 3). Signed-in only.
//   GET  /api/guide/get?site=<site id>                 -> { guide: GuideState }
//   POST /api/guide/task { siteId, step, task, done }  -> { guide }  (hand-ticked tasks only)
//   POST /api/guide/step { siteId, step, done }        -> { guide }  (mark done / reopen)
import { DatabaseError } from '../../server/clients/supabase.js'
import { getGuide, GuideInputError, setStep, setTask } from '../../server/services/guideService.js'
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
    if (method === 'GET' && action === 'get') {
      return Response.json({ guide: await getGuide(new URL(request.url).searchParams.get('site') ?? '') })
    }
    if (method === 'POST' && action === 'task') {
      return Response.json({ guide: await setTask(await request.json().catch(() => null)) })
    }
    if (method === 'POST' && action === 'step') {
      return Response.json({ guide: await setStep(await request.json().catch(() => null)) })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof GuideInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
