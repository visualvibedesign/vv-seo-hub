// API route: /api/templates/:action  (redesign step 5). Signed-in only.
//   GET  /api/templates/list                       -> { templates: Template[] }
//   POST /api/templates/save  TemplateInput        -> { template }   (add when id is missing)
//   POST /api/templates/apply { templateId, siteId } -> { template } (stores a copy on the client)
import { DatabaseError } from '../../server/clients/supabase.js'
import { applyTemplate, listTemplates, saveTemplate, TemplateInputError } from '../../server/services/templateService.js'
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
    if (method === 'GET' && action === 'list') return Response.json({ templates: await listTemplates() })
    if (method === 'POST' && action === 'save') return Response.json({ template: await saveTemplate(await request.json().catch(() => null)) })
    if (method === 'POST' && action === 'apply') return Response.json({ template: await applyTemplate(await request.json().catch(() => null)) })
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof TemplateInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
