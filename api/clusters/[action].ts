// API route: /api/clusters/:action  (redesign step 4c). Signed-in only.
//   GET /api/clusters/list?site=<site id>  -> { pages: ClusterPage[] }
// (Importing a Sheet Clusters CSV is a script for now: scripts/import-clusters.ts.)
import { DatabaseError } from '../../server/clients/supabase.js'
import { ClusterInputError, listClusters } from '../../server/services/clusterService.js'
import { requireSession } from '../../server/utils/auth.js'

export async function GET(request: Request) {
  const denied = await requireSession(request)
  if (denied) return denied
  const url = new URL(request.url)
  const action = url.pathname.split('/').filter(Boolean).pop()
  try {
    if (action === 'list') return Response.json({ pages: await listClusters(url.searchParams.get('site') ?? '') })
    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    if (err instanceof ClusterInputError) return Response.json({ error: 'invalid', detail: err.message }, { status: 400 })
    if (err instanceof DatabaseError) return Response.json({ error: 'database', detail: err.message }, { status: 500 })
    throw err
  }
}
