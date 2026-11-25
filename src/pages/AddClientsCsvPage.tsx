import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import HeaderTools from '../components/layout/HeaderTools'
import { Spinner } from '../components/ui/Loading'
import { addBulkClients, ApiError, previewBulkClients } from '../lib/api'
import { autoMapClients, BULK_FIELDS, mapClientRows, parseClientsCsv, type BulkField, type BulkFile } from '../lib/clientsCsv'
import { BTN_GHOST, BTN_LIME, CARD, CARD_TITLE, FIELD, LABEL, PILL, PILL_DONE, PILL_TODO, PILL_WAITING, siteLabel } from '../lib/ui'
import type { BulkClientCheck } from '../types/seo'

// Add clients from CSV (/clients/import): name, URL, city, state, industry (optional). Read the file → match the
// columns → Check (server works out site ids, skips clients that exist and repeats, nothing saved) → Add the new ones.
// New clients get no services (filled in later per client), every account Ready. No address column, ever.

const STATUS: Record<BulkClientCheck['status'], { label: string; cls: string }> = {
  new: { label: 'New', cls: PILL_DONE },
  exists: { label: 'Already a client', cls: PILL_TODO },
  repeat: { label: 'Twice in file', cls: PILL_TODO },
  problem: { label: 'Problem', cls: `${PILL} bg-vv-red-100 text-vv-red` },
}

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : e instanceof Error && e.message ? e.message : fallback)

export default function AddClientsCsvPage() {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<BulkFile | null>(null)
  const [map, setMap] = useState<Partial<Record<BulkField, number>>>({})
  const [readError, setReadError] = useState('')
  const [drag, setDrag] = useState(false)
  const rows = file ? mapClientRows(file, map) : []
  const missing = BULK_FIELDS.filter((f) => f.required && map[f.field] === undefined)

  const preview = useMutation({ mutationFn: () => previewBulkClients(rows).then((r) => r.rows) })
  const add = useMutation({
    mutationFn: () => addBulkClients(rows),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['industries'] })
    },
  })
  const checked = preview.data
  const counts = (s: BulkClientCheck['status']) => checked?.filter((r) => r.status === s).length ?? 0
  const newIndustries = [...new Set((checked ?? []).filter((r) => r.status === 'new' && r.industryNew).map((r) => r.industryLabel!))]

  const read = async (f: File | undefined) => {
    if (!f) return
    setReadError('')
    preview.reset()
    add.reset()
    try {
      if (f.size > 1024 * 1024) throw new Error('That file is over 1 MB. A client list should be much smaller: check it’s the right file.')
      const parsed = parseClientsCsv(await f.text(), f.name)
      if (!parsed.headers.length || !parsed.rows.length) throw new Error('This file has no rows under the header line.')
      setFile(parsed)
      setMap(autoMapClients(parsed.headers))
    } catch (e) {
      setFile(null)
      setReadError(errText(e, 'Couldn’t read that file.'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <span className="text-[15px] text-vv-muted">
        <Link to="/clients" className="text-vv-muted no-underline hover:text-vv-purple-deep">
          Clients
        </Link>{' '}
        <span aria-hidden="true">›</span> <strong className="text-vv-ink">Add from CSV</strong>
      </span>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Add clients <em className="font-medium text-vv-purple">from a list.</em>
          </h1>
          <p className="m-0 max-w-[720px] text-[17px] leading-normal text-vv-body">
            One row per client: name, website, city, state and (optional) industry. You see every row before anything is saved. Services are filled in later on each client.
          </p>
        </div>
        <HeaderTools />
      </header>

      {/* 1 · File */}
      <section className={CARD} aria-labelledby="bulk-file">
        <h2 id="bulk-file" className={CARD_TITLE}>
          1 · The file
        </h2>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            void read(e.dataTransfer.files[0])
          }}
          className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center ${drag ? 'border-vv-purple bg-vv-lavender-50' : 'border-vv-field-line'}`}
        >
          <span className="text-[16px] font-semibold text-vv-ink">{file ? `${file.fileName} · ${file.rows.length} rows` : 'Drop a CSV here'}</span>
          <button type="button" className={BTN_GHOST} onClick={() => input.current?.click()}>
            {file ? 'Choose another file' : 'Choose a file'}
          </button>
          <input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => void read(e.target.files?.[0])} />
          <span className="text-[13px] text-vv-muted">
            Header line example: <code>name,url,city,state,industry</code>. No address column: addresses are never stored.
          </span>
        </div>
        {readError && <p className="m-0 text-[14px] font-semibold text-vv-red">{readError}</p>}
      </section>

      {/* 2 · Columns */}
      {file && (
        <section className={CARD} aria-labelledby="bulk-cols">
          <h2 id="bulk-cols" className={CARD_TITLE}>
            2 · Match the columns
          </h2>
          <div className="grid grid-cols-5 gap-3 [@media(max-width:1100px)]:grid-cols-2 phone:grid-cols-1">
            {BULK_FIELDS.map(({ field, label, required }) => (
              <label key={field} className={LABEL}>
                {label}
                {required ? '' : ' (optional)'}
                <select
                  className={`${FIELD} ${required && map[field] === undefined ? '!border-vv-error-line' : ''}`}
                  value={map[field] ?? ''}
                  onChange={(e) => {
                    preview.reset()
                    setMap((m) => ({ ...m, [field]: e.target.value === '' ? undefined : Number(e.target.value) }))
                  }}
                >
                  <option value="">— not in this file —</option>
                  {file.headers.map((h, i) => (
                    <option key={`${h}-${i}`} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={BTN_LIME} disabled={!!missing.length || !rows.length || preview.isPending} onClick={() => preview.mutate()}>
              {preview.isPending && <Spinner />}
              Check {rows.length} row{rows.length === 1 ? '' : 's'}
            </button>
            {missing.length > 0 && <span className="text-[14px] text-vv-body">Pick a column for: {missing.map((m) => m.label).join(', ')}.</span>}
            {preview.error && <span className="text-[14px] font-semibold text-vv-red">{errText(preview.error, 'Couldn’t check the rows.')}</span>}
          </div>
        </section>
      )}

      {/* 3 · Preview + add */}
      {checked && (
        <section className={CARD} aria-labelledby="bulk-check">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="bulk-check" className={CARD_TITLE}>
              3 · Check, then add
            </h2>
            <span className="text-[14px] text-vv-body">
              <strong>{counts('new')}</strong> new · {counts('exists')} already clients · {counts('repeat')} twice in the file · {counts('problem')} with a problem
            </span>
          </div>
          {newIndustries.length > 0 && (
            <p className="m-0 rounded-2xl bg-vv-lavender-50 px-4 py-3 text-[14px] text-vv-body">
              New industries, added to the list on save: <strong>{newIndustries.join(', ')}</strong>. They use the generic templates until you make a version.
            </p>
          )}
          <div className="max-h-[520px] overflow-auto rounded-xl border border-solid border-vv-line">
            <table className="w-full border-collapse text-left text-[14px]">
              <thead className="sticky top-0 bg-vv-lavender-50 text-xs font-bold uppercase tracking-[0.08em] text-vv-body">
                <tr>
                  {['Line', 'Client', 'City', 'Industry', 'Status'].map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checked.map((r) => (
                  <tr key={r.line} className={`border-0 border-t border-solid border-vv-line ${r.status === 'new' ? '' : 'opacity-70'}`}>
                    <td className="px-3 py-2 tabular-nums text-vv-muted">{r.line}</td>
                    <td className="px-3 py-2">
                      <span className="block font-semibold text-vv-ink">{r.name || '—'}</span>
                      <span className="block text-[13px] text-vv-muted">{r.siteUrl ? siteLabel(r.siteUrl) : r.url || '—'}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{[r.city, r.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="px-3 py-2">
                      {r.industryLabel ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          {r.industryLabel}
                          {r.industryNew && <span className={PILL_WAITING}>new</span>}
                        </span>
                      ) : (
                        <span className="text-vv-muted">Generic</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={STATUS[r.status].cls}>{STATUS[r.status].label}</span>
                      {r.note && <span className="mt-1 block text-[12px] text-vv-body">{r.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!add.data ? (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={BTN_LIME} disabled={!counts('new') || add.isPending} onClick={() => add.mutate()}>
                {add.isPending && <Spinner />}
                Add {counts('new')} client{counts('new') === 1 ? '' : 's'}
              </button>
              <span className="text-[13px] text-vv-muted">Only the New rows are saved. Every account starts Ready; services come later per client.</span>
              {add.error && <span className="text-[14px] font-semibold text-vv-red">{errText(add.error, 'Couldn’t add them. Nothing new was saved for the rows that failed.')}</span>}
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-2xl bg-vv-green-100 px-4 py-3 text-[15px] text-vv-green-ink">
              <strong>
                {add.data.added} client{add.data.added === 1 ? '' : 's'} added · {add.data.skipped} skipped
                {add.data.industriesAdded.length ? ` · new industries: ${add.data.industriesAdded.join(', ')}` : ''}
              </strong>
              {add.data.failed.length > 0 && (
                <span className="text-vv-red">
                  Not added: {add.data.failed.map((f) => `line ${f.line} (${f.note})`).join('; ')}
                </span>
              )}
              <Link to="/clients" className="font-semibold text-vv-purple-deep">
                Go to All clients: the new ones show “Needs services”
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
