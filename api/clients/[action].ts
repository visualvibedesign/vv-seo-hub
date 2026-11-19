// API route: /api/clients/:action  (phase 1, step 3). Signed-in only.
//   GET  /api/clients/list                          -> { clients: ClientSummary[] }
//   GET  /api/clients/get?site=<site id>            -> { client: ClientDetail }
//   GET  /api/clients/site-id?url=…&current=<id>    -> SiteIdCheck (live check on the form)
//   POST /api/clients/save    { siteId?, client }   -> { siteId }   (add when siteId is missing)
//   POST /api/clients/account { siteId, account }   -> { account }  (one checklist row)
import { DatabaseError } from '../../server/clients/supabase.js'
import { checkSiteId, ClientInputError, getClient, listClients, saveAccount, saveClient } from '../../server/services/clientService.js'
import { requireSession } from '../../server/utils/auth.js'
import { SiteUrlError } from '../../server/utils/siteId.js'

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
    if (method === 'GET' && action === 'list') {
      return Response.json({ clients: await listClients() })
    }
    if (method === 'GET' && action === 'get') {
      const client = await getClient(params.get('site') ?? '')
      return client ? Response.json({ client }) : Response.json({ error: 'not_found' }, { status: 404 })
    }
    if (method === 'GET' && action === 'site-id') {
      return Response.json(await checkSiteId(params.get('url') ?? '', params.get('current') ?? undefined))
    }
    if (method === 'POST' && action === 'save') {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; client?: unknown }
      const siteId = typeof body.siteId === 'string' && body.siteId ? body.siteId : undefined
      return Response.json(await saveClient(body.client, siteId))
    }
    if (method === 'POST' && action === 'account') {
      const body = (await request.json().catch(() => ({}))) as { siteId?: unknown; account?: unknown }
      return Response.json({ account: await saveAccount(String(body.siteId ?? ''), body.account) })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof ClientInputError || err instanceof SiteUrlError) {
      return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    }
    if (err instanceof DatabaseError) {
      return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    }
    throw err
  }
}
