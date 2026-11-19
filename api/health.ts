// API route: GET /api/health
//   -> { ok, app, database: { configured, tables: { seo_clients: 'ok' | 'missing' | 'error', … }, bucket } }
// Setup check: is the api/ folder running, and can the server reach the SEO tables in Supabase?
// Shows only table names and whether they exist: no client data, no counts. Signed-in only.
import { db } from '../server/clients/supabase.js'
import { requireSession } from '../server/utils/auth.js'

const TABLES = [
  'seo_clients',
  'seo_client_categories',
  'seo_client_services',
  'seo_client_areas',
  'seo_client_accounts',
  'seo_imports',
  'seo_keywords',
  'seo_keyword_sources',
  'seo_matrix_cells',
  'seo_matrix_keywords',
  'seo_pages',
  'seo_page_keywords',
] as const

type TableState = 'ok' | 'missing' | 'error'

export async function GET(request: Request) {
  const denied = await requireSession(request)
  if (denied) return denied
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ ok: false, app: 'seo-hub', database: { configured: false } })
  }
  const client = db()
  const tables: Record<string, TableState> = {}
  await Promise.all(
    TABLES.map(async (name) => {
      // head: true = no rows come back, only whether the query worked
      const res = await client.from(name).select('*', { head: true, count: 'exact' }).limit(1)
      tables[name] = !res.error ? 'ok' : /does not exist|schema cache|PGRST205|42P01/i.test(`${res.error.code} ${res.error.message}`) ? 'missing' : 'error'
    }),
  )
  const bucket = await client.storage.getBucket('seo-imports')
  const bucketState: TableState = !bucket.error ? 'ok' : /not found/i.test(bucket.error.message) ? 'missing' : 'error'
  const ok = Object.values(tables).every((s) => s === 'ok') && bucketState === 'ok'
  return Response.json({ ok, app: 'seo-hub', database: { configured: true, tables, bucket: bucketState } })
}
