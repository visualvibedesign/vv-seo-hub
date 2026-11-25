import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import ImportHistory from '../../components/import/ImportHistory'
import SamsGuideImport from '../../components/import/SamsGuideImport'
import { useClientContext } from '../../components/layout/ClientLayout'
import { Spinner } from '../../components/ui/Loading'
import { useCommitImport, usePreviewImport } from '../../hooks/useImports'
import { ApiError } from '../../lib/api'
import { areaState } from '../../lib/clientSetup'
import { FIELD_LABEL, keywordKey, REPORTS, SOURCE_FIELDS, SOURCE_LABEL, sourceOf } from '../../lib/importRules'
import { applyMap, fileToBase64, filterRows, initialMap, readCsvFile, type ParsedFile } from '../../lib/readCsv'
import { BTN_GHOST, BTN_LIME, CARD, CARD_TITLE, FIELD, LABEL, PILL_DONE, PILL_WAITING } from '../../lib/ui'
import type { ClientDetail, ImportField, ImportPayload, ImportPreview, ImportReport, ImportSource, NumberField } from '../../types/seo'

// Keywords › Import (/clients/{site id}/keywords/import): CSV import wizard.
// Source → upload → match columns → preview (dry run on the server) → import. Raw file kept untouched.
// Merge rules: see server/services/importService.ts (never overwrite filled numbers unless ticked;
// KP ranges are only filled by the Sheet import, never by KP/Semrush CSVs, never over a typed one).

type Step = 'source' | 'match' | 'preview' | 'done'
const MAX_REQUEST_BYTES = 4_000_000 // Vercel's limit is ~4.5 MB per request

const NUMBER_LABEL: Record<NumberField, string> = { semrush_volume: 'Semrush', kd: 'KD', cpc: 'CPC' }

export default function ImportPage() {
  const c = useClientContext()
  const [step, setStep] = useState<Step>('source')
  const [source, setSource] = useState<ImportSource>('kp')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [report, setReport] = useState<ImportReport>('kp_ideas')
  const [map, setMap] = useState<Partial<Record<ImportField, string>>>({})
  const [location, setLocation] = useState('')
  const [filter, setFilter] = useState('')
  const [include, setInclude] = useState('')
  const [exclude, setExclude] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [useNew, setUseNew] = useState<Set<string>>(new Set())
  /** Address-like keywords Angel ticked "Import anyway" (keys). Empty = all held back. */
  const [allowAddr, setAllowAddr] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const previewQ = usePreviewImport()
  const commitQ = useCommitImport(c.siteId)

  const mapped = useMemo(() => (parsed ? applyMap(parsed, map) : { rows: [], totals: [], blank: 0 }), [parsed, map])
  const rows = useMemo(() => filterRows(mapped.rows, include, exclude), [mapped.rows, include, exclude])

  const defaultLocation = (s: ImportSource) =>
    s === 'semrush' ? 'US' : s === 'kp' ? [c.areas.find((a) => a.code === 'A1')?.name, areaState(c.areas.find((a) => a.code === 'A1'), c.state)].filter(Boolean).join(', ') : ''

  const reset = () => {
    setStep('source')
    setFile(null)
    setParsed(null)
    setPreview(null)
    setUseNew(new Set())
    setError('')
    setInclude('')
    setExclude('')
    setFilter('')
  }

  const onFile = async (f: File) => {
    setError('')
    setReading(true)
    try {
      const p = await readCsvFile(f)
      // The file decides the report when it clearly belongs to another source than the one picked.
      const r = sourceOf(p.report) === source ? p.report : REPORTS.find((x) => x.source === source)!.report
      setFile(f)
      setParsed(p)
      setReport(r)
      setMap(initialMap(p, r))
      setLocation(defaultLocation(source))
      setStep('match')
      if (sourceOf(p.report) !== source) setError(`This looks like a ${SOURCE_LABEL[sourceOf(p.report)]} file. Check the source and report below.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t read this file.')
    } finally {
      setReading(false)
    }
  }

  const changeReport = (r: ImportReport) => {
    setReport(r)
    const s = sourceOf(r)
    if (s !== source) {
      setSource(s)
      setLocation(defaultLocation(s))
    }
    if (parsed) setMap(initialMap(parsed, r))
    setError('')
  }

  const payload = (): ImportPayload => ({
    siteId: c.siteId,
    source,
    report,
    fileName: file?.name ?? 'import.csv',
    location,
    filter,
    columnMap: map,
    totals: mapped.totals,
    rows,
    useNew: [...useNew],
    allowAddresses: [...allowAddr],
  })

  const runPreview = async () => {
    setError('')
    if (!map.keyword) return setError('Match the Keyword column first.')
    if (!rows.length) return setError('No keyword rows left (check the include / exclude words).')
    const size = new Blob([JSON.stringify(payload())]).size + (file ? (file.size * 4) / 3 : 0)
    if (size > MAX_REQUEST_BYTES)
      return setError(
        `This import is too big for one go (${(size / 1024 / 1024).toFixed(1)} MB). Narrow it with “Only keywords containing” (e.g. the city) or split the file.`,
      )
    try {
      const p = await previewQ.mutateAsync(payload())
      setPreview(p)
      setUseNew(new Set())
      setAllowAddr(new Set())
      setStep('preview')
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : 'Couldn’t check the import. Try again.')
    }
  }

  const runImport = async () => {
    if (!file) return
    setError('')
    try {
      const res = await commitQ.mutateAsync({ payload: payload(), file: { base64: await fileToBase64(file), type: file.type || 'text/csv' } })
      setPreview(res.preview)
      setStep('done')
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : 'The import didn’t go through. Nothing was saved; try again.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Steps step={step} />

      {step === 'source' && (
        <SourceStep source={source} setSource={setSource} onFile={onFile} reading={reading} />
      )}
      {step === 'source' && <SamsGuideImport client={c} />}

      {step === 'match' && parsed && (
        <MatchStep
          client={c}
          parsed={parsed}
          source={source}
          report={report}
          changeReport={changeReport}
          map={map}
          setMap={setMap}
          location={location}
          setLocation={setLocation}
          filter={filter}
          setFilter={setFilter}
          include={include}
          setInclude={setInclude}
          exclude={exclude}
          setExclude={setExclude}
          mapped={mapped}
          rowsAfterFilter={rows.length}
          sample={rows.slice(0, 5)}
          onBack={reset}
          onNext={runPreview}
          busy={previewQ.isPending}
        />
      )}

      {step === 'preview' && preview && (
        <PreviewStep
          source={source}
          preview={preview}
          useNew={useNew}
          setUseNew={setUseNew}
          allowAddr={allowAddr}
          setAllowAddr={setAllowAddr}
          onBack={() => setStep('match')}
          onImport={runImport}
          busy={commitQ.isPending}
        />
      )}

      {step === 'done' && preview && (
        <section className={`${CARD} items-start`} aria-labelledby="imp-done">
          <span className={PILL_DONE}>Imported</span>
          <h2 id="imp-done" className={CARD_TITLE}>
            {preview.newKeywords} new keywords, {preview.existing} already there
          </h2>
          <p className="m-0 text-[15px] text-vv-body">
            {preview.skippedDuplicates} exact duplicates skipped. Every row is saved in the history, and the raw file is kept as uploaded.
            {source === 'kp' && ' KP ranges: type them in the Database (step 5). The KP stand-ins are only in the history.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BTN_LIME} onClick={reset}>
              Import another file
            </button>
            <Link to={`/clients/${c.siteId}/keywords/database`} className={BTN_GHOST}>
              Keyword database
            </Link>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="m-0 rounded-2xl bg-vv-red-100 px-4 py-3 text-[15px] font-semibold text-vv-red">
          {error}
        </p>
      )}

      <ImportHistory siteId={c.siteId} />
    </div>
  )
}

// ---- Steps bar --------------------------------------------------------------------------

function Steps({ step }: { step: Step }) {
  const all: [Step, string][] = [
    ['source', '1 · Source + file'],
    ['match', '2 · Match columns'],
    ['preview', '3 · Preview'],
    ['done', '4 · Done'],
  ]
  const at = all.findIndex(([s]) => s === step)
  return (
    <ol aria-label="Import steps" className="m-0 flex list-none flex-wrap gap-1 rounded-[22px] bg-vv-lavender-50 p-1">
      {all.map(([s, label], i) => (
        <li
          key={s}
          aria-current={s === step ? 'step' : undefined}
          className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${
            s === step ? 'bg-vv-surface text-vv-ink shadow-[0_2px_6px_rgba(91,63,208,0.15)]' : i < at ? 'text-vv-purple-deep' : 'text-vv-muted'
          }`}
        >
          {label}
        </li>
      ))}
    </ol>
  )
}

// ---- 1. Source + file ------------------------------------------------------------------------

function SourceStep({ source, setSource, onFile, reading }: { source: ImportSource; setSource: (s: ImportSource) => void; onFile: (f: File) => void; reading: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const cards: { s: ImportSource; title: string; text: string }[] = [
    { s: 'kp', title: 'Keyword Planner', text: 'Discover new keywords or Search volume exports (CSV). Stand-in numbers stay in the history only.' },
    { s: 'semrush', title: 'Semrush', text: 'Keyword Magic Tool, Keyword Overview (bulk) or Keyword Gap exports (CSV, US database).' },
  ]
  return (
    <section className={CARD} aria-labelledby="imp-source">
      <h2 id="imp-source" className={CARD_TITLE}>
        Import <em className="font-medium text-vv-purple">keywords</em>
      </h2>
      <div role="radiogroup" aria-label="Source" className="grid grid-cols-2 gap-3 phone:grid-cols-1">
        {cards.map((k) => (
          <button
            key={k.s}
            type="button"
            role="radio"
            aria-checked={source === k.s}
            onClick={() => setSource(k.s)}
            className={`flex flex-col gap-1 rounded-2xl border-[1.5px] border-solid p-4 text-left ${
              source === k.s ? 'border-vv-purple bg-vv-lavender-50' : 'border-vv-line bg-vv-surface hover:bg-vv-lavender-50'
            }`}
          >
            <span className="font-display text-lg font-semibold text-vv-ink">{k.title}</span>
            <span className="text-[13px] leading-normal text-vv-muted">{k.text}</span>
          </button>
        ))}
      </div>
      <details className="text-sm text-vv-muted" open={source === 'sheet'}>
        <summary className="cursor-pointer font-semibold text-vv-purple-deep">Other sources</summary>
        <label className="mt-2 flex items-center gap-2">
          <input type="radio" name="src-other" className="h-4 w-4 accent-vv-purple" checked={source === 'sheet'} onChange={() => setSource('sheet')} />
          Master Keyword Database from a Google Sheet (CSV) · <span className={PILL_WAITING}>Testing only</span>
        </label>
      </details>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          const f = e.dataTransfer.files[0]
          if (f) onFile(f)
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center ${over ? 'border-vv-purple bg-vv-lavender-50' : 'border-vv-dash'}`}
      >
        {reading ? (
          <span className="flex items-center gap-2 font-semibold text-vv-purple-deep">
            <Spinner /> Reading the file…
          </span>
        ) : (
          <>
            <span className="text-[15px] text-vv-body">
              Drop the {SOURCE_LABEL[source]} CSV here, or
            </span>
            <button type="button" className={BTN_LIME} onClick={() => input.current?.click()}>
              Choose a file
            </button>
            <span className="text-xs text-vv-muted">The file is kept exactly as exported. Up to 3 MB.</span>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
      </div>
    </section>
  )
}

// ---- 2. Match columns -----------------------------------------------------------------------------

function MatchStep(props: {
  client: ClientDetail
  parsed: ParsedFile
  source: ImportSource
  report: ImportReport
  changeReport: (r: ImportReport) => void
  map: Partial<Record<ImportField, string>>
  setMap: (m: Partial<Record<ImportField, string>>) => void
  location: string
  setLocation: (s: string) => void
  filter: string
  setFilter: (s: string) => void
  include: string
  setInclude: (s: string) => void
  exclude: string
  setExclude: (s: string) => void
  mapped: ReturnType<typeof applyMap>
  rowsAfterFilter: number
  sample: ReturnType<typeof applyMap>['rows']
  onBack: () => void
  onNext: () => void
  busy: boolean
}) {
  const { parsed, source, map, mapped } = props
  const fields = SOURCE_FIELDS[source]
  // Placeholders from this client's own data (A1 area, services, scope words); nothing typed in for any one client.
  const c = props.client
  const a1 = c.areas.find((a) => a.code === 'A1' && a.status === 'active')
  const place = [a1?.name || c.city, areaState(a1, c.state)].filter(Boolean).join(', ')
  const area = (a1?.name || c.city || '').toLowerCase()
  const svc = c.categories.flatMap((k) => k.services.map((s) => s.name.toLowerCase())).slice(0, 2)
  const eg = (xs: string[]) => (xs.length ? `e.g. ${xs.join(', ')}` : '')
  return (
    <section className={CARD} aria-labelledby="imp-match">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="imp-match" className={CARD_TITLE}>
          Match <em className="font-medium text-vv-purple">columns</em>
        </h2>
        <span className="text-sm text-vv-muted">
          {parsed.fileName} · {parsed.rows.length} rows · {parsed.encoding.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 [@media(max-width:1199px)]:grid-cols-1">
        <label className={LABEL}>
          Report
          <select className={FIELD} value={props.report} onChange={(e) => props.changeReport(e.target.value as ImportReport)}>
            {REPORTS.map((r) => (
              <option key={r.report} value={r.report}>
                {SOURCE_LABEL[r.source]} · {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          {source === 'kp' ? 'KP location' : source === 'semrush' ? 'Semrush database' : 'Sheet location (as in its column header)'}
          <input className={FIELD} value={props.location} onChange={(e) => props.setLocation(e.target.value)} placeholder={source === 'semrush' ? 'US' : place} />
        </label>
        <label className={LABEL}>
          {source === 'semrush' ? 'Semrush filter used (optional)' : 'Note (optional)'}
          <input className={FIELD} value={props.filter} onChange={(e) => props.setFilter(e.target.value)} placeholder={source === 'semrush' && area ? `Include keywords: ${area}` : ''} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 [@media(max-width:1199px)]:grid-cols-1">
        {fields.map((f) => (
          <label key={f} className={LABEL}>
            {FIELD_LABEL[f]}
            {f === 'keyword' ? ' (required)' : ''}
            <select
              className={`${FIELD} ${f === 'keyword' && !map.keyword ? '!border-vv-error-line' : ''}`}
              value={map[f] ?? ''}
              onChange={(e) => props.setMap({ ...map, [f]: e.target.value || undefined })}
            >
              <option value="">— not in this file —</option>
              {parsed.headers.map((h, i) => (
                <option key={`${h}-${i}`} value={h}>
                  {h || `Column ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {source === 'kp' && (
        <p className="m-0 rounded-2xl bg-vv-lavender-50 px-4 py-3 text-[13px] leading-normal text-vv-body">
          Keyword Planner CSVs only have stand-in numbers (50, 500), not the ranges KP shows (10–100). They’re saved in the history but never used as a
          volume. Type the real range in the Database (quick picks + bulk-set, step 5).
          {mapped.totals.length > 0 && (
            <>
              {' '}
              File totals kept with the import (not in the table): {mapped.totals.map((t) => `${t.segment} ${t.volume}`).join(' · ')}.
            </>
          )}
        </p>
      )}
      {source === 'sheet' && (
        <p className="m-0 rounded-2xl bg-vv-orange-100 px-4 py-3 text-[13px] leading-normal text-vv-orange-ink">
          Testing only. The Sheet fills a KP range only where it’s empty (marked “from Sheet”); typed ranges are never changed. Roles and services fill
          empty ones only.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 phone:grid-cols-1">
        <label className={LABEL}>
          Only keywords containing (comma-separated, optional)
          <input className={FIELD} value={props.include} onChange={(e) => props.setInclude(e.target.value)} placeholder={eg([area, ...svc].filter(Boolean))} />
        </label>
        <label className={LABEL}>
          Leave out keywords containing (optional)
          <input className={FIELD} value={props.exclude} onChange={(e) => props.setExclude(e.target.value)} placeholder={eg(c.outOfScopeWords.slice(0, 3))} />
        </label>
      </div>

      <p className="m-0 text-sm font-semibold text-vv-body">
        {props.rowsAfterFilter} keyword rows to check
        {mapped.rows.length !== props.rowsAfterFilter && ` (of ${mapped.rows.length}; the rest left out by your words)`}
        {mapped.blank > 0 && ` · ${mapped.blank} rows without a keyword left out`}
      </p>

      {props.sample.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-solid border-vv-line">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-vv-st-todo text-vv-st-todo-ink">
                {fields.map((f) => (
                  <th key={f} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {FIELD_LABEL[f]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {props.sample.map((r, i) => (
                <tr key={i} className="border-t border-solid border-vv-line">
                  {fields.map((f) => (
                    <td key={f} className="whitespace-nowrap px-3 py-2">
                      {r[f as keyof typeof r] as string | undefined || <span className="text-vv-muted">no data</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" className={BTN_LIME} onClick={props.onNext} disabled={props.busy || !map.keyword}>
          {props.busy ? (
            <>
              <Spinner /> Checking…
            </>
          ) : (
            'Check import'
          )}
        </button>
        <button type="button" className={BTN_GHOST} onClick={props.onBack}>
          Choose another file
        </button>
      </div>
    </section>
  )
}

// ---- 3. Preview ------------------------------------------------------------------------------------

function PreviewStep({
  source,
  preview: p,
  useNew,
  setUseNew,
  allowAddr,
  setAllowAddr,
  onBack,
  onImport,
  busy,
}: {
  source: ImportSource
  preview: ImportPreview
  useNew: Set<string>
  setUseNew: (s: Set<string>) => void
  allowAddr: Set<string>
  setAllowAddr: (s: Set<string>) => void
  onBack: () => void
  onImport: () => void
  busy: boolean
}) {
  const toggle = (key: string) => {
    const next = new Set(useNew)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setUseNew(next)
  }
  const allTicked = p.differences.length > 0 && p.differences.every((d) => useNew.has(d.key))
  return (
    <section className={CARD} aria-labelledby="imp-preview">
      <h2 id="imp-preview" className={CARD_TITLE}>
        Preview <em className="font-medium text-vv-purple">(nothing saved yet)</em>
      </h2>
      <div className="grid grid-cols-4 gap-3 [@media(max-width:1199px)]:grid-cols-2">
        {[
          ['New keywords', p.newKeywords],
          ['Already in the database', p.existing],
          ['Exact duplicates skipped', p.skippedDuplicates],
          ['Empty numbers filled', p.filled],
        ].map(([label, n]) => (
          <div key={label} className="flex flex-col gap-1 rounded-2xl bg-vv-lavender-50 px-4 py-3">
            <span className="font-display text-[30px] font-semibold leading-none text-vv-purple-ink">{n}</span>
            <span className="text-[13px] font-semibold text-vv-body">{label}</span>
          </div>
        ))}
      </div>

      {p.addresses.length > 0 && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-vv-orange-100 px-4 py-3 text-sm text-vv-orange-ink">
          <strong>Looks like an address: {p.addresses.length} held back</strong>
          <span>These look like street addresses, so they’re not imported (not even kept in the import history). A client’s private address must never be stored. Tick one only if it’s a public business address you want as a keyword.</span>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {p.addresses.map((k) => {
              const key = keywordKey(k)
              return (
                <li key={key}>
                  <label className="flex min-h-9 items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-vv-purple"
                      checked={allowAddr.has(key)}
                      onChange={() => {
                        const next = new Set(allowAddr)
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        setAllowAddr(next)
                      }}
                    />
                    {k} <span className="font-normal">· import anyway</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-vv-body">
        {p.skippedDuplicates > 0 && <li>Duplicates (same text, same file): {p.duplicateExamples.join(', ')}{p.skippedDuplicates > p.duplicateExamples.length ? '…' : ''}</li>}
        {p.newWithoutVolume > 0 && (
          <li>
            <span className={PILL_WAITING}>Missing data</span> {p.newWithoutVolume} new keywords have no Semrush volume (shown as “no data”, never 0).
          </li>
        )}
        {source === 'kp' && <li>KP ranges aren’t touched by KP imports. The stand-in numbers go into the history only.</li>}
        {source === 'sheet' && (
          <li>
            KP ranges: {p.kpFilled} filled from the Sheet (empty ones only){p.kpKept > 0 ? `, ${p.kpKept} left as they are (typed or already set)` : ''}.
          </li>
        )}
        {p.unmatchedServices.length > 0 && (
          <li>
            <span className={PILL_WAITING}>Check</span> Services not found on this client (keywords get no service): {p.unmatchedServices.join(', ')}. Add them in Edit client
            first if they’re real services.
          </li>
        )}
        {p.unknownRoles.length > 0 && <li>Unknown roles (left empty): {p.unknownRoles.join(', ')}</li>}
        {p.sampleNew.length > 0 && <li>New, e.g.: {p.sampleNew.join(', ')}</li>}
      </ul>

      {p.differences.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-[15px] font-bold">
              {p.differences.length} keyword{p.differences.length === 1 ? ' has' : 's have'} different Semrush numbers in this file
            </h3>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5 accent-vv-purple"
                checked={allTicked}
                onChange={() => setUseNew(allTicked ? new Set() : new Set(p.differences.map((d) => d.key)))}
              />
              Use the new numbers for all
            </label>
          </div>
          <p className="m-0 text-[13px] text-vv-muted">Filled numbers are kept unless you tick “Use the new numbers”. Both stay in the history either way.</p>
          <div className="max-h-[360px] overflow-auto rounded-2xl border border-solid border-vv-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0">
                <tr className="bg-vv-st-todo text-vv-st-todo-ink">
                  <th className="px-3 py-2 font-semibold">Keyword</th>
                  <th className="px-3 py-2 font-semibold">Now → in this file</th>
                  <th className="px-3 py-2 font-semibold">Use the new numbers</th>
                </tr>
              </thead>
              <tbody>
                {p.differences.map((d) => (
                  <tr key={d.key} className="border-t border-solid border-vv-line">
                    <td className="px-3 py-2">{d.keyword}</td>
                    <td className="px-3 py-2">
                      {d.changes.map((ch) => (
                        <span key={ch.field} className="mr-3 whitespace-nowrap">
                          {NUMBER_LABEL[ch.field]} {ch.current} → <strong>{ch.incoming}</strong>
                        </span>
                      ))}
                    </td>
                    <td className="px-3 py-2">
                      <input type="checkbox" aria-label={`Use the new numbers for ${d.keyword}`} className="h-5 w-5 accent-vv-purple" checked={useNew.has(d.key)} onChange={() => toggle(d.key)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" className={BTN_LIME} onClick={onImport} disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Importing…
            </>
          ) : (
            `Import ${p.unique} rows`
          )}
        </button>
        <button type="button" className={BTN_GHOST} onClick={onBack} disabled={busy}>
          Back
        </button>
      </div>
    </section>
  )
}

