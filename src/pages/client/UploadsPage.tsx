import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import { Bone, Spinner } from '../../components/ui/Loading'
import { useCommitImport, useImports, usePreviewImport } from '../../hooks/useImports'
import { useKeywords } from '../../hooks/useKeywords'
import { useMatrix } from '../../hooks/useMatrix'
import { useAutofill } from '../../hooks/useAutofill'
import Day2Autofill from '../../components/autofill/Day2Autofill'
import { ApiError } from '../../lib/api'
import { areaState, CORE_ACCOUNT_KINDS } from '../../lib/clientSetup'
import { guessFilter, REPORTS, sourceOf } from '../../lib/importRules'
import { applyMap, fileToBase64, initialMap, MAX_FILE_BYTES, readCsvFile } from '../../lib/readCsv'
import { BTN_GHOST, BTN_LIME, CARD, PILL } from '../../lib/ui'
import { day2Needs, importsFor, needDone, serviceCategories, UPLOAD_DAYS, type Need } from '../../lib/uploads'
import type { ClientDetail, ImportPayload, ImportPreview, ImportRecord } from '../../types/seo'

// Uploads + auto-fill (/clients/{site id}/uploads), design docs/design/Autofill.png:
//   1 · What I need from you: the exact exports + "How to get this file", ticked from real imports;
//       one drop zone that recognises each file by its columns, previews it (nothing saved) and imports it
//       with the same rules as Keywords › Import (volumes exactly as exported, addresses held back).
//   2 · What Claude filled: auto-fill suggestions, Ready to review (built in steps 6b / 6c).
//   3 · Needs you: from real counts only.
const MAX_REQUEST_BYTES = 4_000_000

export default function UploadsPage() {
  const c = useClientContext()
  const [params, setParams] = useSearchParams()
  const dayKey = params.get('day') ?? (c.guide.current === 0 ? 'day1' : 'day2')
  const day = UPLOAD_DAYS.find((d) => d.key === dayKey) ?? UPLOAD_DAYS[1]

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            You upload. <em className="font-medium text-vv-purple">Claude fills.</em>
          </h1>
          <p className="m-0 max-w-[760px] text-[17px] leading-normal text-vv-body">SEO Hub asks for the exact exports, auto-fill fills the fields, you review and approve.</p>
        </div>
        <HeaderTools />
      </header>

      <nav aria-label="Days" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {UPLOAD_DAYS.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-current={d.key === day.key ? 'page' : undefined}
            onClick={() => setParams({ day: d.key }, { replace: true })}
            className={`min-h-11 flex-none whitespace-nowrap rounded-full border border-solid px-4 font-body text-[15px] font-semibold ${
              d.key === day.key ? 'border-vv-lavender bg-vv-lavender text-vv-ink' : 'border-vv-field-line bg-vv-surface text-vv-body hover:bg-vv-lavender-50'
            }`}
          >
            {d.label}
          </button>
        ))}
      </nav>

      {!day.live ? (
        <section className={`${CARD} items-start`}>
          <span className={`${PILL} bg-vv-st-todo text-vv-st-todo-ink`}>Coming in phase {day.phase}</span>
          <h2 className="m-0 font-display text-[24px] font-semibold">{day.label}</h2>
          <p className="m-0 max-w-[680px] text-[15px] text-vv-body">This day’s exports, how-to steps and auto-fill come with phase {day.phase}. Day 1 and Day 2 work now.</p>
        </section>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start gap-6 [@media(max-width:1100px)]:grid-cols-1">
          {day.key === 'day1' ? <Day1Needs client={c} /> : <Day2Needs client={c} />}
          <div className="flex min-w-0 flex-col gap-6">
            {day.key === 'day2' ? <Day2Autofill client={c} /> : <ClaudeFilled day={day.key} />}
            <NeedsYou client={c} day={day.key} />
            <p className="m-0 text-[14px] leading-normal text-vv-body">
              Claude never changes exported numbers, never invents volumes, reviews or facts, and nothing goes to the live site without your OK.
            </p>
          </div>
        </div>
      )}
    </>
  )
}

// ---- Day 1 ------------------------------------------------------------------------------------

function Day1Needs({ client: c }: { client: ClientDetail }) {
  const cat = (code: string) => c.categories.find((k) => k.code === code)
  const servicesOk = ['Home', 'S1', 'S2', 'S3'].every((k) => cat(k)?.name.trim()) && ['S1', 'S2', 'S3'].every((k) => (cat(k)?.services.length ?? 0) > 0)
  const a1 = c.areas.find((a) => a.code === 'A1')
  const pending = c.accounts.filter((a) => CORE_ACCOUNT_KINDS.includes(a.kind) && a.status === 'pending').length
  const items = [
    { title: 'Services & areas', how: 'Home + S1–S3 with their services, A1 (and A2 / A3 or N/A)', done: servicesOk && !!a1?.name, link: `/clients/${c.siteId}/edit`, label: 'Edit client' },
    { title: 'Kickoff answers', how: '12-month goal, why them (USP), ideal client', done: !!(c.success12mo && c.usp && c.idealClient), link: `/clients/${c.siteId}/edit`, label: 'Edit client' },
    { title: 'Account checklist', how: 'Search Console, GA4, GBP, Semrush, Whitespark, Clarity', done: pending === 0, link: `/clients/${c.siteId}`, label: 'Overview › Accounts' },
  ]
  const n = items.filter((i) => i.done).length
  return (
    <section className={`${CARD} !gap-0 !p-7 phone:!p-5`} aria-labelledby="need-h">
      <div className="flex items-baseline justify-between gap-2 pb-3">
        <h2 id="need-h" className="m-0 font-display text-[26px] font-semibold phone:text-[21px]">
          1 · What I need from you
        </h2>
        <span className="whitespace-nowrap text-[15px] text-vv-body">
          {n} of {items.length} in
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((i, k) => (
          <li key={i.title} className="flex gap-4 border-0 border-t border-solid border-vv-line py-4">
            <Tick done={i.done} n={k + 1} />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[17px] font-semibold text-vv-ink">{i.title}</span>
              <span className="text-[15px] text-vv-body">{i.how}</span>
              <Link to={i.link} className="text-[14px] font-semibold text-vv-purple-deep">
                {i.label} ›
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <p className="m-0 border-0 border-t border-solid border-vv-line pt-4 text-[14px] text-vv-body">
        Day 1 needs no exports. Pasting kickoff notes or the Services page so Claude can fill these in comes with auto-fill (step 6c).
      </p>
    </section>
  )
}

// ---- Day 2 ------------------------------------------------------------------------------------

function Day2Needs({ client: c }: { client: ClientDetail }) {
  const imports = useImports(c.siteId)
  const list = imports.data ?? []
  const needs = day2Needs(c)
  const required = needs.filter((n) => !n.optional)
  const inCount = required.filter((n) => needDone(n, list, c)).length
  return (
    <section className={`${CARD} !gap-0 !p-7 phone:!p-5`} aria-labelledby="need-h">
      <div className="flex items-baseline justify-between gap-2 pb-3">
        <h2 id="need-h" className="m-0 font-display text-[26px] font-semibold phone:text-[21px]">
          1 · What I need from you
        </h2>
        {imports.data && (
          <span className="whitespace-nowrap text-[15px] text-vv-body">
            {inCount} of {required.length} in
          </span>
        )}
      </div>
      {imports.isPending && <Bone className="h-64 w-full rounded-2xl" />}
      {imports.isError && <p className="m-0 py-3 text-[15px] font-semibold text-vv-red">Couldn’t load this client’s imports.</p>}
      {imports.data && (
        <ul className="m-0 flex list-none flex-col p-0">
          {needs.map((n, k) => (
            <NeedRow key={n.key} need={n} n={k + 1} client={c} imports={list} />
          ))}
        </ul>
      )}
      <DropZone client={c} imports={list} />
      <p className="m-0 pt-4 text-[14px] text-vv-body">Nothing for this step comes from an API. Semrush stays CSV only.</p>
    </section>
  )
}

function Tick({ done, n }: { done: boolean; n: number }) {
  return done ? (
    <span aria-label="Done" className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-vv-purple text-white">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12 5 5 9-10" />
      </svg>
    </span>
  ) : (
    <span aria-label="Not in yet" className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-vv-lavender-100 text-[15px] font-bold text-vv-body">
      {n}
    </span>
  )
}

function NeedRow({ need: n, n: num, client: c, imports }: { need: Need; n: number; client: ClientDetail; imports: ImportRecord[] }) {
  const [open, setOpen] = useState(false)
  const got = importsFor(n, imports)
  const done = needDone(n, imports, c)
  return (
    <li className="flex gap-4 border-0 border-t border-solid border-vv-line py-4">
      <Tick done={done} n={num} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2 text-[17px] font-semibold text-vv-ink">
          {n.title}
          {n.optional && <span className={`${PILL} bg-vv-lavender-100 text-vv-body`}>Optional</span>}
        </span>
        <span className="text-[15px] text-vv-body">{n.how}</span>
        {n.key === 'keyword_magic' && (
          <span className="text-[14px] font-semibold text-vv-purple-deep">
            {got.length} file{got.length === 1 ? '' : 's'} in · aim: one per service category ({serviceCategories(c)})
          </span>
        )}
        {got.length > 0 && n.key !== 'keyword_magic' && <span className="truncate text-[14px] font-semibold text-vv-purple-deep">{got[0].fileName}</span>}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="mt-1 inline-flex min-h-9 items-center self-start rounded-full border border-solid border-vv-field-line bg-vv-lavender-50 px-4 font-body text-[14px] font-semibold text-vv-purple-deep hover:bg-vv-lavender-100"
        >
          {open ? 'Hide steps' : 'How to get this file ›'}
        </button>
        {open && (
          <>
            <ol className="m-0 mt-1 flex flex-col gap-1.5 rounded-2xl border border-solid border-vv-line bg-vv-lavender-50 py-3 pl-9 pr-4 text-[15px] text-vv-ink">
              {n.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <span className="text-[13px] text-vv-body">Menus can move when the tool updates. Tell me if a step looks different.</span>
          </>
        )}
      </div>
    </li>
  )
}

// ---- Drop zone: recognise → preview (nothing saved) → import -----------------------------------

type Queued = {
  id: number
  file: File
  label: string
  payload?: ImportPayload
  preview?: ImportPreview
  state: 'reading' | 'checking' | 'ready' | 'importing' | 'done' | 'error' | 'skipped'
  note?: string
  already?: ImportRecord
}
let qid = 0

function DropZone({ client: c, imports }: { client: ClientDetail; imports: ImportRecord[] }) {
  const [queue, setQueue] = useState<Queued[]>([])
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const previewQ = usePreviewImport()
  const commitQ = useCommitImport(c.siteId)
  const update = (id: number, patch: Partial<Queued>) => setQueue((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const add = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const id = ++qid
      setQueue((q) => [...q, { id, file, label: '…', state: 'reading' }])
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error('Too big for one upload (over 3 MB). Use Keywords › Import with “Only keywords containing” (e.g. the city).')
        const p = await readCsvFile(file)
        if (p.report === 'master_db') throw new Error('This is the Sheet’s master database. Import it on Keywords › Import.')
        const source = sourceOf(p.report)
        const map = initialMap(p, p.report)
        const mapped = applyMap(p, map)
        const a1 = c.areas.find((a) => a.code === 'A1')
        const areaWords = [...c.areas.map((a) => a.name?.toLowerCase()), 'near me'].filter((x): x is string => !!x)
        const payload: ImportPayload = {
          siteId: c.siteId,
          source,
          report: p.report,
          fileName: file.name,
          location: source === 'kp' ? [a1?.name, areaState(a1, c.state)].filter(Boolean).join(', ') : 'US',
          filter: source === 'semrush' ? guessFilter(mapped.rows, areaWords) : '',
          columnMap: map,
          totals: mapped.totals,
          rows: mapped.rows,
        }
        if (!payload.rows.length) throw new Error('No keyword rows found in this file.')
        if (new Blob([JSON.stringify(payload)]).size + (file.size * 4) / 3 > MAX_REQUEST_BYTES)
          throw new Error('Too big for one go. Use Keywords › Import with “Only keywords containing” (e.g. the city).')
        const label = REPORTS.find((r) => r.report === p.report)!.label
        const already = imports.find((i) => i.fileName === file.name && i.report === p.report)
        update(id, { label: `${source === 'kp' ? 'Keyword Planner' : 'Semrush'} · ${label}`, payload, state: 'checking', already })
        const preview = await previewQ.mutateAsync(payload)
        update(id, { preview, state: 'ready' })
      } catch (e) {
        update(id, { state: 'error', label: 'Not imported here', note: e instanceof ApiError && e.detail ? e.detail : e instanceof Error ? e.message : 'Couldn’t read this file.' })
      }
    }
  }

  const importOne = async (q: Queued) => {
    if (!q.payload) return
    update(q.id, { state: 'importing' })
    try {
      const res = await commitQ.mutateAsync({ payload: q.payload, file: { base64: await fileToBase64(q.file), type: q.file.type || 'text/csv' } })
      update(q.id, { state: 'done', preview: res.preview })
    } catch (e) {
      update(q.id, { state: 'error', note: e instanceof ApiError && e.detail ? e.detail : 'The import didn’t go through. Nothing was saved; try again.' })
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void add(e.dataTransfer.files)
        }}
        className={`flex flex-col items-center gap-2 rounded-[18px] border-2 border-dashed px-5 py-7 text-center ${over ? 'border-vv-purple bg-vv-lavender-100' : 'border-vv-lavender bg-vv-lavender-50'}`}
      >
        <span className="text-[17px] font-bold text-vv-ink">Drop the exports here</span>
        <span className="text-[14px] text-vv-body">SEO Hub knows which file is which from its columns. Nothing is saved until you click Import.</span>
        <button type="button" className={`${BTN_GHOST} mt-1`} onClick={() => input.current?.click()}>
          Choose files
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void add(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {queue.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-live="polite">
          {queue.map((q) => (
            <QueueRow key={q.id} q={q} onImport={() => void importOne(q)} onSkip={() => update(q.id, { state: 'skipped' })} busy={commitQ.isPending} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** A KP "Discover new keywords" file this big is usually unfiltered (thousands of off-topic ideas). Warn, never block. */
const BIG_IDEAS_ROWS = 500

function QueueRow({ q, onImport, onSkip, busy }: { q: Queued; onImport: () => void; onSkip: () => void; busy: boolean }) {
  const p = q.preview
  const bigIdeas = q.payload?.report === 'kp_ideas' && q.payload.rows.length > BIG_IDEAS_ROWS
  return (
    <li className={`flex flex-col gap-2 rounded-2xl border border-solid p-3.5 ${q.state === 'error' ? 'border-vv-red-100 bg-vv-red-100' : 'border-vv-line bg-vv-surface'} ${q.state === 'skipped' ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-vv-ink">{q.file.name}</span>
          <span className="block text-[13px] text-vv-body">{q.label}</span>
        </span>
        {(q.state === 'reading' || q.state === 'checking' || q.state === 'importing') && (
          <span className="flex items-center gap-2 text-[13px] text-vv-body">
            <Spinner /> {q.state === 'importing' ? 'Importing…' : 'Checking…'}
          </span>
        )}
        {q.state === 'done' && <span className={`${PILL} bg-vv-green-100 text-vv-green-ink`}>Imported</span>}
        {q.state === 'skipped' && <span className={`${PILL} bg-vv-st-todo text-vv-st-todo-ink`}>Skipped</span>}
      </div>
      {q.state === 'error' && <span className="text-[14px] font-semibold text-vv-red">{q.note}</span>}
      {p && q.state !== 'error' && (
        <span className="text-[14px] text-vv-body">
          {p.rows} rows · {p.newKeywords} new · {p.existing} already in · {p.skippedDuplicates} duplicates skipped · {p.filled} empty numbers {q.state === 'done' ? 'filled' : 'to fill'}
          {p.differences.length > 0 && ` · ${p.differences.length} with different numbers (kept as they are; choose on Keywords › Import)`}
        </span>
      )}
      {p && p.addresses.length > 0 && (
        <span className="text-[13px] font-semibold text-vv-orange-ink">
          Looks like an address, held back (never stored): {p.addresses.join(', ')}
        </span>
      )}
      {bigIdeas && q.state === 'ready' && (
        <span className="text-[13px] font-semibold text-vv-orange-ink">
          Big unfiltered ideas file ({q.payload!.rows.length.toLocaleString('en-US')} rows): filter it first (e.g. Keywords › Import with “Only keywords containing” your city or services) or import anyway.
        </span>
      )}
      {q.already && q.state === 'ready' && (
        <span className="text-[13px] font-semibold text-vv-orange-ink">
          A file with this name was already imported on {new Date(q.already.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Importing again only adds what’s new.
        </span>
      )}
      {q.state === 'ready' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${BTN_LIME} min-h-10`} onClick={onImport} disabled={busy}>
            {bigIdeas ? 'Import anyway' : 'Import'}
          </button>
          <button type="button" className={`${BTN_GHOST} min-h-10`} onClick={onSkip}>
            Skip
          </button>
        </div>
      )}
    </li>
  )
}

// ---- Right column ------------------------------------------------------------------------------

const DAY1_FILLS = [
  { title: 'Services', what: 'Home + S1–S3 and their services, from the Services page' },
  { title: 'Areas', what: 'A1–A3 from the kickoff notes' },
  { title: 'Kickoff answers', what: 'Goal, USP and ideal client, from the notes' },
]

function ClaudeFilled({ day }: { day: string }) {
  const fills = DAY1_FILLS
  void day
  return (
    <section className={`${CARD} !gap-0 !p-7 phone:!p-5`} aria-labelledby="filled-h">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <h2 id="filled-h" className="m-0 font-display text-[26px] font-semibold phone:text-[21px]">
          2 · What Claude filled
        </h2>
        <button type="button" className={BTN_LIME} disabled title="Nothing to approve yet">
          Approve all
        </button>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {fills.map((f) => (
          <li key={f.title} className="flex items-center justify-between gap-3 border-0 border-t border-solid border-vv-line py-3.5">
            <span className="flex min-w-0 flex-col">
              <span className="text-[16px] font-semibold text-vv-ink">{f.title}</span>
              <span className="text-[14px] text-vv-body">{f.what}</span>
            </span>
            <span className={`${PILL} flex-none bg-vv-st-todo text-vv-st-todo-ink`}>Not run yet</span>
          </li>
        ))}
      </ul>
      <p className="m-0 border-0 border-t border-solid border-vv-line pt-3.5 text-[14px] text-vv-body">
        Day 1 auto-fill reads pasted notes and the Services page, so it uses Claude: it comes in step 6c. Everything it fills waits here as “Ready to review”.
      </p>
    </section>
  )
}

function NeedsYou({ client: c, day }: { client: ClientDetail; day: string }) {
  const kws = useKeywords(c.siteId)
  const matrix = useMatrix(c.siteId)
  const autofill = useAutofill(c.siteId)
  if (day === 'day1') return null
  const all = (kws.data ?? []).filter((k) => k.status !== 'rejected')
  // Keywords the service rules couldn't match, still without a service (set them by hand).
  const stillNoService = new Set(all.filter((k) => !k.serviceId).map((k) => k.id))
  const noServiceMatch = (autofill.data?.find((r) => r.kind === 'services')?.unmatched ?? []).filter((u) => stillNoService.has(u.keywordId))
  const cells = matrix.data?.rows.flatMap((r) => r.cells) ?? []
  const pendingCells = cells.filter((x) => x.state === 'pending').length
  const primNoKp = cells.filter((x) => x.primary && !x.primary.kpVolume).length
  const items = [
    pendingCells > 0 && { text: `Pick the final primary for ${pendingCells} matrix cell${pendingCells === 1 ? '' : 's'}`, to: 'keywords' },
    primNoKp > 0 && { text: `Type KP ranges for ${primNoKp} matrix primar${primNoKp === 1 ? 'y' : 'ies'} with no range`, to: 'keywords/database' },
    all.filter((k) => !k.role).length > 0 && { text: `${all.filter((k) => !k.role).length} keywords need a role`, to: 'keywords/database' },
    noServiceMatch.length > 0 && {
      text: `${noServiceMatch.length} keyword${noServiceMatch.length === 1 ? '' : 's'} match no service (set by hand or reject): ${noServiceMatch
        .slice(0, 3)
        .map((u) => u.keyword)
        .join(', ')}${noServiceMatch.length > 3 ? '…' : ''}`,
      to: 'keywords/database',
    },
    all.filter((k) => k.semrushVolume === null).length > 0 && {
      text: `${all.filter((k) => k.semrushVolume === null).length} keywords have no Semrush volume (bulk Keyword Overview)`,
      to: 'keywords/database',
    },
  ].filter((x): x is { text: string; to: string } => !!x)
  return (
    <section className="flex flex-col gap-0 rounded-[22px] border border-solid border-[#f0d894] bg-[#fffaeb] px-7 py-6 dark:border-vv-field-line dark:bg-vv-surface phone:px-5" aria-labelledby="needs-h">
      <h2 id="needs-h" className="m-0 pb-3 font-display text-[26px] font-semibold phone:text-[21px] text-vv-ink">
        3 · Needs you
      </h2>
      {kws.isPending || matrix.isPending ? (
        <Bone className="h-24 w-full rounded-xl" />
      ) : items.length === 0 ? (
        <p className="m-0 border-0 border-t border-solid border-[#f0d894] py-3.5 text-[15px] text-vv-body dark:border-vv-line">Nothing needs you for Day 2 right now.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((i) => (
            <li key={i.text} className="border-0 border-t border-solid border-[#f0d894] dark:border-vv-line">
              <Link to={`/clients/${c.siteId}/${i.to}`} className="flex items-center gap-3 py-3.5 text-[16px] text-vv-ink no-underline hover:underline">
                <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-full bg-[#d39b16]" />
                {i.text}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
