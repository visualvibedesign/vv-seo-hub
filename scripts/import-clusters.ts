// Clusters import for ANY client: a Sheet "Clusters" tab exported as CSV → pages + page keywords.
// Only adds pages and links; never creates, changes or deletes keywords. Dry run unless --commit.
//
//   ./node_modules/.bin/jiti scripts/import-clusters.ts --client "<name or site id>" --file "<clusters.csv>" [--commit]
//
// Env: .env.local (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
import { readFileSync } from 'node:fs'
import { importClustersCsv } from '../server/services/clusterService.ts'
import { listClients } from '../server/services/clientService.ts'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const COMMIT = process.argv.includes('--commit')

;(async () => {
  const who = arg('client')
  const file = arg('file')
  if (!who || !file) throw new Error('Use --client "<name or site id>" --file "<clusters.csv>" [--commit]')
  const clients = await listClients()
  const c = clients.find((x) => x.siteId === who || x.name.toLowerCase() === who.toLowerCase())
  if (!c) throw new Error(`No client "${who}".`)

  const r = await importClustersCsv(c.siteId, readFileSync(file, 'utf8'), COMMIT)
  console.log(`${COMMIT ? 'IMPORTED' : 'DRY RUN (add --commit to save)'} · ${c.name} · ${r.pages.length} pages`)
  for (const p of r.pages) {
    const n = (role: string) => p.keywords.filter((k) => k.role === role).length
    console.log(`  ${p.category.padEnd(4)} ${p.name.padEnd(22)} ${p.priority.padEnd(6)} ${p.status.padEnd(9)} primary ${n('primary')} · secondary ${n('secondary')} · faq ${n('faq')}${p.ideas.length ? ` · ${p.ideas.length} idea(s)` : ''}`)
  }
  console.log(`Unmatched keywords (not in the client's keywords, skipped, none created): ${r.unmatched.length}`)
  for (const u of r.unmatched) console.log(`  - ${u.keyword}  [${u.role} on ${u.page}]`)
  if (r.onTwoPages.length) {
    console.log(`On two pages (kept on the first): ${r.onTwoPages.length}`)
    for (const d of r.onTwoPages) console.log(`  - ${d.keyword}: kept on ${d.kept}, skipped on ${d.skipped}`)
  }
})().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})
