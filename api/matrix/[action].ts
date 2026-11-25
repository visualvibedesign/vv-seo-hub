// API route: /api/matrix/:action  (redesign step 4b). Signed-in only.
//   GET  /api/matrix/get?site=<site id>                                  -> { matrix: MatrixState }
//   POST /api/matrix/cell { siteId, category, area, primaryId, backupIds } -> { matrix }
import { DatabaseError } from '../../server/clients/supabase.js'
import { getMatrix, MatrixInputError, setCell } from '../../server/services/matrixService.js'
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
      return Response.json({ matrix: await getMatrix(new URL(request.url).searchParams.get('site') ?? '') })
    }
    if (method === 'POST' && action === 'cell') {
      return Response.json(await setCell(await request.json().catch(() => null)))
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof MatrixInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
