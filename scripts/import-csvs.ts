// Bulk keyword import for ANY client: runs the same preview + import as the Import page
// (src/lib/readCsv.ts parser, server/services/importService.ts rules), from a folder of CSV exports.
//
//   npx jiti scripts/import-csvs.ts --client "<name or site id>" --dir "<folder>" [--match "<text>"] [--commit] [--max-rows 2000] [--all]
//
// - Dry run by default (nothing saved). Add --commit to import.
// - Picks Keyword Planner + Semrush exports (Keyword Magic / bulk Overview / Keyword Gap) by file content, like the wizard.
//   --match keeps only files whose name contains that text (e.g. a client's service words).
// - Skips files that are byte-for-byte copies ("file (1).csv") and files already in the client's import history.
// - Holds back files over --max-rows (default 2000): usually an unfiltered national export. --all imports them anyway.
// - KP location = the client's A1 area; Semrush database = US; filter = "Include keywords: <word>" when every row has it.
// Env: .env.local (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). Imports land in the shared Supabase project.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyMap, initialMap, readCsvFile } from '../src/lib/readCsv.ts'
import { sourceOf } from '../src/lib/importRules.ts'
import { getClient, listClients } from '../server/services/clientService.ts'
import { commitImport, listImports, previewImport } from '../server/services/importService.ts'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}
const COMMIT = process.argv.includes('--commit')
const ALL = process.argv.includes('--all')
const MAX_ROWS = Number(arg('max-rows') ?? 2000)
const ORDER = ['kp_ideas', 'kp_volumes', 'keyword_magic', 'keyword_overview', 'keyword_gap']

function guessFilter(rows: { keyword: string }[], words: string[]) {
  const w = words.find((x) => rows.length > 0 && rows.every((r) => r.keyword.toLowerCase().includes(x)))
  return w ? `Include keywords: ${w}` : ''
}

;(async () => {
  const who = arg('client')
  const dir = arg('dir')
  if (!who || !dir) throw new Error('Use --client "<name or site id>" --dir "<folder with CSVs>"')
  const found = (await listClients()).filter((c) => c.siteId === who || c.name.toLowerCase().includes(who.toLowerCase()))
  if (found.length !== 1) throw new Error(found.length ? `More than one client matches "${who}": ${found.map((c) => c.name).join(', ')}` : `No client matches "${who}"`)
  const client = (await getClient(found[0].siteId))!
  const a1 = client.areas.find((a) => a.code === 'A1')
  const kpLocation = [a1?.name, a1?.state].filter(Boolean).join(', ')
  const areaWords = [...client.areas.map((a) => a.name?.toLowerCase()), 'near me'].filter((x): x is string => !!x)
  const already = new Set((await listImports(client.siteId)).map((i) => i.fileName))
  console.log(`${client.name} (${client.siteId}) · KP location "${kpLocation}" · ${COMMIT ? 'IMPORTING' : 'dry run'}\n`)

  const match = arg('match')?.toLowerCase()
  const seen = new Map<string, string>()
  const plan: { name: string; buf: Buffer; report: string; rows: number }[] = []
  for (const name of readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv')).sort()) {
    if (match && !name.toLowerCase().includes(match)) continue
    const buf = readFileSync(join(dir, name))
    const hash = createHash('md5').update(buf).digest('hex')
    if (seen.has(hash)) { console.log(`skip  ${name}  (same file as ${seen.get(hash)})`); continue }
    seen.set(hash, name)
    if (already.has(name)) { console.log(`skip  ${name}  (already imported)`); continue }
    let parsed
    try { parsed = await readCsvFile(new File([buf], name, { type: 'text/csv' })) } catch { continue } // not a keyword export
    if (parsed.report === 'master_db') continue // the Sheet source is testing-only: use the Import page
    plan.push({ name, buf, report: parsed.report, rows: parsed.rows.length })
  }
  plan.sort((x, y) => ORDER.indexOf(x.report) - ORDER.indexOf(y.report))

  for (const f of plan) {
    if (f.rows > MAX_ROWS && !ALL) { console.log(`HOLD  ${f.name}  (${f.rows} rows, over ${MAX_ROWS}: likely unfiltered; --all to include)`); continue }
    const parsed = await readCsvFile(new File([f.buf], f.name, { type: 'text/csv' }))
    const report = parsed.report
    const source = sourceOf(report)
    const map = initialMap(parsed, report)
    const { rows, totals } = applyMap(parsed, map)
    const payload = {
      siteId: client.siteId, source, report, fileName: f.name,
      location: source === 'kp' ? kpLocation : 'US',
      filter: source === 'semrush' ? guessFilter(rows, areaWords) : '',
      columnMap: map, totals, rows,
    }
    const p = COMMIT ? (await commitImport(payload, { base64: f.buf.toString('base64'), type: 'text/csv' })).preview : await previewImport(payload)
    console.log(`${COMMIT ? 'DONE ' : 'OK   '} ${f.name}  [${report}]  ${p.rows} rows · ${p.newKeywords} new · ${p.existing} merged · ${p.skippedDuplicates} dupes · ${p.filled} filled${payload.filter ? ` · ${payload.filter}` : ''}`)
    if (p.addresses.length) console.log(`      held back (looks like an address, never imported by this script): ${p.addresses.join(' | ')}`)
  }
})().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})
