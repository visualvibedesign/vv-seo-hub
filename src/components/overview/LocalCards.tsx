import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDeleteGbp, useDeleteMapGrid, useLocal, useSaveGbp, useSaveMapGrid } from '../../hooks/useLocal'
import { ApiError } from '../../lib/api'
import { rememberAuthor, savedAuthor } from '../../lib/notes'
import { BTN_GHOST, BTN_LIME, BTN_LINK, FIELD, LABEL } from '../../lib/ui'
import { gridStats, periodLabel } from '../../lib/local'
import type { GbpInput, GbpSnapshot, MapGrid } from '../../types/seo'
import ConfirmDialog from '../ui/ConfirmDialog'
import { Bone, Spinner } from '../ui/Loading'
import { Dash, Panel } from './OverviewParts'

// Phase 2d · Overview cards for the numbers the team types in: Google Business Profile (once a month) and the
// Whitespark map grid (typed scan now, CSV once the sample is in). Real values only; empty = "—". The grid centre is an
// area name only, never an address.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const d12 = (d: string) => new Date(`${d}T12:00:00`)
const short = (d: string) => d12(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function Modal({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-auto w-[calc(100%-32px)] ${wide ? 'max-w-[560px]' : 'max-w-[480px]'} rounded-[26px] border-0 bg-vv-surface p-0 text-vv-ink shadow-[0_30px_60px_-30px_rgba(42,28,110,0.5)] backdrop:bg-[rgba(42,28,110,0.18)]`}
    >
      {open && (
        <div className="flex flex-col gap-3.5 p-[26px] phone:p-5">
          <h2 className="m-0 font-display text-[24px] font-semibold leading-[1.2]">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  )
}

// ---- GBP ----------------------------------------------------------------------------------------------------

const GBP_NUMS: { key: 'views' | 'calls' | 'directions' | 'websiteClicks'; label: string }[] = [
  { key: 'views', label: 'Profile views' },
  { key: 'calls', label: 'Calls' },
  { key: 'directions', label: 'Direction requests' },
  { key: 'websiteClicks', label: 'Website clicks' },
]

function Change({ now, prev, prevLabel }: { now: number | null; prev: number | null; prevLabel: string }) {
  if (now === null || prev === null) return null
  if (prev === 0) return now === 0 ? <span className="text-[11px] text-vv-body">same as {prevLabel}</span> : null
  const p = Math.round(((now - prev) / prev) * 100)
  if (p === 0) return <span className="text-[11px] text-vv-body">same as {prevLabel}</span>
  return <span className={`text-[11px] font-semibold ${p > 0 ? 'text-vv-green-ink' : 'text-vv-red'}`}>{`${p > 0 ? '+' : '−'}${Math.abs(p)}% vs ${prevLabel}`}</span>
}

export function GbpCard({ siteId }: { siteId: string }) {
  const q = useLocal(siteId)
  const del = useDeleteGbp(siteId)
  const [edit, setEdit] = useState<GbpInput | null>(null)
  const [remove, setRemove] = useState<GbpSnapshot | null>(null)
  const list = q.data?.gbp ?? []
  const [now, prev] = list
  const prevLabel = prev ? periodLabel(prev.periodFrom, prev.periodTo) : ''

  const lastMonth = (): GbpInput => {
    const t = new Date()
    const from = iso(new Date(t.getFullYear(), t.getMonth() - 1, 1))
    const to = iso(new Date(t.getFullYear(), t.getMonth(), 0))
    const have = list.find((s) => s.periodFrom === from && s.periodTo === to)
    return have ?? { periodFrom: from, periodTo: to, views: null, calls: null, directions: null, websiteClicks: null, reviews: null, rating: null, newestReviewOn: null, typedBy: null, note: null }
  }

  return (
    <Panel
      title="Google Business Profile"
      sub={now ? `Typed in · ${periodLabel(now.periodFrom, now.periodTo)}${prev ? ` vs ${prevLabel}` : ''}` : 'Typed in once a month'}
      right={
        <button type="button" className={`${now ? BTN_GHOST : BTN_LIME} min-h-10 px-4 text-[13px]`} onClick={() => setEdit(lastMonth())} disabled={q.isPending}>
          Add this month’s numbers
        </button>
      }
    >
      {q.isPending ? (
        <Bone className="h-[120px] w-full rounded-2xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {GBP_NUMS.map((n) => (
              <div key={n.key} className="flex flex-col gap-0.5 rounded-[14px] bg-vv-pink-100 p-3">
                <div className="text-[22px] font-bold">{now?.[n.key] ?? <Dash />}</div>
                <div className="text-[12px] text-vv-body">{n.label}</div>
                {now && prev && <Change now={now[n.key]} prev={prev[n.key]} prevLabel={prevLabel} />}
              </div>
            ))}
          </div>
          <p className="m-0 text-[13px] text-vv-body">
            {now ? (
              <>
                {now.rating !== null && <strong className="text-vv-ink">★ {now.rating.toFixed(1)}</strong>}
                {now.rating !== null && now.reviews !== null && ' · '}
                {now.reviews !== null && `${now.reviews} reviews`}
                {now.newestReviewOn && ` · newest ${short(now.newestReviewOn)}`}
                {now.rating === null && now.reviews === null && 'No review numbers typed.'}
              </>
            ) : (
              'Nothing typed yet. Once a month: GBP › Performance, pick last month, type the four numbers + reviews.'
            )}
          </p>
          {list.length > 0 && (
            <details className="text-[13px]">
              <summary className="cursor-pointer font-semibold text-vv-purple-deep">All months ({list.length})</summary>
              <ul className="m-0 mt-1.5 flex list-none flex-col p-0">
                {list.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-0 border-t border-solid border-vv-line py-1.5">
                    <span>
                      <strong>{periodLabel(s.periodFrom, s.periodTo)}</strong>
                      <span className="text-vv-body">
                        {' '}
                        · {s.views ?? '—'} views · {s.calls ?? '—'} calls{s.typedBy ? ` · by ${s.typedBy}` : ''}
                      </span>
                    </span>
                    <span className="flex gap-3">
                      <button type="button" className={`${BTN_LINK} min-h-8 text-[12px]`} onClick={() => setEdit(s)}>
                        Edit
                      </button>
                      <button type="button" className={`${BTN_LINK} min-h-8 text-[12px] !text-vv-red`} onClick={() => setRemove(s)}>
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      <Modal open={!!edit} title="GBP numbers" onClose={() => setEdit(null)}>
        {edit && <GbpForm siteId={siteId} start={edit} onDone={() => setEdit(null)} />}
      </Modal>
      <ConfirmDialog
        open={!!remove}
        title={`Remove ${remove ? periodLabel(remove.periodFrom, remove.periodTo) : ''}?`}
        body="The numbers typed for this period are deleted. You can type them again."
        confirmLabel="Remove"
        busy={del.isPending}
        onCancel={() => setRemove(null)}
        onConfirm={() => remove && del.mutate(remove.id, { onSuccess: () => setRemove(null) })}
      />
    </Panel>
  )
}

function GbpForm({ siteId, start, onDone }: { siteId: string; start: GbpInput; onDone: () => void }) {
  const save = useSaveGbp(siteId)
  const [v, setV] = useState<Record<string, string>>(() => {
    const author = start.typedBy ?? savedAuthor()
    const s = (x: number | null) => (x === null ? '' : String(x))
    return { periodFrom: start.periodFrom, periodTo: start.periodTo, views: s(start.views), calls: s(start.calls), directions: s(start.directions), websiteClicks: s(start.websiteClicks), reviews: s(start.reviews), rating: s(start.rating), newestReviewOn: start.newestReviewOn ?? '', typedBy: author, note: start.note ?? '' }
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  const n = (k: string) => (v[k].trim() === '' ? null : Number(v[k]))
  const submit = () => {
    if (v.typedBy.trim()) rememberAuthor(v.typedBy)
    save.mutate(
      { periodFrom: v.periodFrom, periodTo: v.periodTo, views: n('views'), calls: n('calls'), directions: n('directions'), websiteClicks: n('websiteClicks'), reviews: n('reviews'), rating: n('rating'), newestReviewOn: v.newestReviewOn || null, typedBy: v.typedBy || null, note: v.note || null },
      { onSuccess: onDone },
    )
  }
  const num = (k: string, label: string, step = '1') => (
    <label className={LABEL}>
      {label}
      <input className={FIELD} type="number" inputMode={step === '1' ? 'numeric' : 'decimal'} min={step === '1' ? 0 : 1} max={step === '1' ? undefined : 5} step={step} value={v[k]} onChange={set(k)} />
    </label>
  )
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <p className="m-0 text-[13px] text-vv-body">GBP › Performance › pick the period, then type what it shows. Leave a box empty if you don’t have it (never 0 for “unknown”). The same period typed again replaces it.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className={LABEL}>
          From
          <input className={FIELD} type="date" value={v.periodFrom} onChange={set('periodFrom')} required />
        </label>
        <label className={LABEL}>
          To
          <input className={FIELD} type="date" value={v.periodTo} onChange={set('periodTo')} required />
        </label>
        {num('views', 'Profile views')}
        {num('calls', 'Calls')}
        {num('directions', 'Direction requests')}
        {num('websiteClicks', 'Website clicks')}
        {num('reviews', 'Reviews (total)')}
        {num('rating', 'Rating', '0.1')}
        <label className={LABEL}>
          Newest review
          <input className={FIELD} type="date" value={v.newestReviewOn} onChange={set('newestReviewOn')} />
        </label>
        <label className={LABEL}>
          Typed by
          <input className={FIELD} value={v.typedBy} maxLength={60} onChange={set('typedBy')} />
        </label>
      </div>
      <label className={LABEL}>
        Note (optional)
        <input className={FIELD} value={v.note} maxLength={300} onChange={set('note')} placeholder="e.g. new photos added this month" />
      </label>
      {save.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save.')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className={BTN_LIME} disabled={save.isPending}>
          {save.isPending && <Spinner />}
          Save
        </button>
      </div>
    </form>
  )
}

// ---- Map grid ---------------------------------------------------------------------------------------------------

/** Green 1–3, amber 4–7, red 8+, grey = not found / 20+. */
const pointTone = (r: number | null) => (r === null ? 'bg-vv-st-todo text-vv-st-todo-ink' : r <= 3 ? 'bg-vv-pos-top text-vv-pos-top-ink' : r <= 7 ? 'bg-vv-orange-100 text-vv-orange-ink' : 'bg-vv-red-100 text-vv-red')

export function GridDots({ g, size = 'md' }: { g: MapGrid; size?: 'md' | 'sm' }) {
  return (
    <div className="grid w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${g.gridSize}, minmax(0, 1fr))`, maxWidth: size === 'md' ? Math.min(300, g.gridSize * 48) : 180 }} role="img" aria-label={`Map grid ${g.gridSize}×${g.gridSize} for ${g.keyword}`}>
      {g.ranks.flat().map((r, i) => (
        <span key={i} className={`flex aspect-square items-center justify-center rounded-full text-[12px] font-bold ${pointTone(r)}`}>
          {r ?? '20+'}
        </span>
      ))}
    </div>
  )
}

export function MapGridCard({ siteId }: { siteId: string }) {
  const q = useLocal(siteId)
  const del = useDeleteMapGrid(siteId)
  const [adding, setAdding] = useState(false)
  const [remove, setRemove] = useState<MapGrid | null>(null)
  const grids = q.data?.grids ?? []
  const g = grids[0]
  const before = g ? grids.slice(1).find((x) => x.keyword.toLowerCase() === g.keyword.toLowerCase()) : undefined
  const s = g ? gridStats(g) : null
  const b = before ? gridStats(before) : null
  return (
    <Panel
      title="Map grid"
      sub={g ? `Whitespark · ${g.keyword} · ${short(g.scannedOn)}` : 'Whitespark · typed in (CSV once the sample is in)'}
      right={
        <button type="button" className={`${g ? BTN_GHOST : BTN_LIME} min-h-10 px-4 text-[13px]`} onClick={() => setAdding(true)} disabled={q.isPending}>
          Type in a scan
        </button>
      }
    >
      {q.isPending ? (
        <Bone className="h-[200px] w-full rounded-2xl" />
      ) : !g || !s ? (
        <>
          <div className="grid max-w-[240px] grid-cols-5 gap-2" aria-hidden="true">
            {Array.from({ length: 25 }, (_, i) => (
              <span key={i} className="aspect-square rounded-full border border-dashed border-vv-lavender bg-vv-lavender-50" />
            ))}
          </div>
          <p className="m-0 text-[13px] text-vv-body">No scan yet. Run the grid in Whitespark for the main service + city, then type each point’s rank here (empty = not found / 20+).</p>
        </>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <GridDots g={g} />
          <div className="flex min-w-[160px] flex-1 flex-col gap-2 text-[13px]">
            <div>
              <div className="font-display text-[30px] font-semibold leading-none">{s.avg === null ? <Dash /> : s.avg.toFixed(1)}</div>
              <div className="text-vv-body">avg rank where found</div>
              {b?.avg != null && s.avg !== null && Math.abs(b.avg - s.avg) >= 0.05 && (
                <div className={`text-[12px] font-semibold ${s.avg < b.avg ? 'text-vv-green-ink' : 'text-vv-red'}`}>
                  {s.avg < b.avg ? '↑' : '↓'} from {b.avg.toFixed(1)} on {short(before!.scannedOn)}
                </div>
              )}
            </div>
            <div>
              <strong>{s.top3}</strong> of {s.points} points in the top 3
            </div>
            <div>
              Found in <strong>{s.found}</strong> of {s.points}
            </div>
            <div className="text-vv-body">{[g.centerLabel, g.spacing ? `${g.spacing} apart` : null, `${g.gridSize}×${g.gridSize}`].filter(Boolean).join(' · ')}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-vv-body">
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-vv-pos-top-ink align-middle" />
                1–3
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-vv-orange-ink align-middle" />
                4–7
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-vv-red align-middle" />
                8+
              </span>
              <span>
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-vv-muted align-middle" />
                not found
              </span>
            </div>
          </div>
        </div>
      )}
      {grids.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-semibold text-vv-purple-deep">All scans ({grids.length})</summary>
          <ul className="m-0 mt-1.5 flex list-none flex-col p-0">
            {grids.map((x) => {
              const st = gridStats(x)
              return (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-0 border-t border-solid border-vv-line py-1.5">
                  <span>
                    <strong>{short(x.scannedOn)}</strong>
                    <span className="text-vv-body">
                      {' '}
                      · {x.keyword} · avg {st.avg === null ? '—' : st.avg.toFixed(1)} · {st.top3} in top 3
                    </span>
                  </span>
                  <button type="button" className={`${BTN_LINK} min-h-8 text-[12px] !text-vv-red`} onClick={() => setRemove(x)}>
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        </details>
      )}
      <Modal open={adding} title="Type in a map grid scan" onClose={() => setAdding(false)} wide>
        {adding && <GridForm siteId={siteId} last={g} onDone={() => setAdding(false)} />}
      </Modal>
      <ConfirmDialog
        open={!!remove}
        title="Remove this scan?"
        body={remove ? `${remove.keyword} · ${short(remove.scannedOn)}. The typed ranks are deleted.` : ''}
        confirmLabel="Remove"
        busy={del.isPending}
        onCancel={() => setRemove(null)}
        onConfirm={() => remove && del.mutate(remove.id, { onSuccess: () => setRemove(null) })}
      />
    </Panel>
  )
}

function GridForm({ siteId, last, onDone }: { siteId: string; last: MapGrid | undefined; onDone: () => void }) {
  const save = useSaveMapGrid(siteId)
  const [keyword, setKeyword] = useState(last?.keyword ?? '')
  const [scannedOn, setScannedOn] = useState(iso(new Date()))
  const [size, setSize] = useState(last?.gridSize && last.gridSize <= 7 ? last.gridSize : 5)
  const [spacing, setSpacing] = useState(last?.spacing ?? '')
  const [area, setArea] = useState(last?.centerLabel ?? '')
  const [cells, setCells] = useState<string[]>(() => Array(size * size).fill(''))
  const areaBad = /\d/.test(area)
  const resize = (n: number) => {
    setSize(n)
    setCells(Array(n * n).fill(''))
  }
  const bad = cells.some((c) => c.trim() !== '' && !/^(20\+|\d{1,3})$/.test(c.trim()))
  const submit = () => {
    const toRank = (c: string) => (c.trim() === '' || c.trim() === '20+' ? null : Number(c))
    const ranks = Array.from({ length: size }, (_, r) => cells.slice(r * size, r * size + size).map(toRank))
    save.mutate({ keyword, scannedOn, gridSize: size, spacing: spacing || null, centerLabel: area || null, ranks }, { onSuccess: onDone })
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="grid grid-cols-2 gap-3 phone:grid-cols-1">
        <label className={`${LABEL} col-span-2 phone:col-span-1`}>
          Keyword
          <input className={FIELD} value={keyword} maxLength={200} onChange={(e) => setKeyword(e.target.value)} placeholder="the main service + city, as scanned" required />
        </label>
        <label className={LABEL}>
          Scan date
          <input className={FIELD} type="date" value={scannedOn} onChange={(e) => setScannedOn(e.target.value)} required />
        </label>
        <label className={LABEL}>
          Grid
          <select className={FIELD} value={size} onChange={(e) => resize(Number(e.target.value))}>
            <option value={5}>5×5 (25 points)</option>
            <option value={7}>7×7 (49 points)</option>
          </select>
        </label>
        <label className={LABEL}>
          Spacing
          <input className={FIELD} value={spacing} maxLength={40} onChange={(e) => setSpacing(e.target.value)} placeholder="e.g. 1 mi" />
        </label>
        <label className={LABEL}>
          Area (name only)
          <input className={FIELD} value={area} maxLength={80} onChange={(e) => setArea(e.target.value)} placeholder="town or area, never an address" aria-invalid={areaBad} />
          {areaBad && <span className="text-[12px] font-semibold text-vv-red">No numbers: a town or area name only, never a street address or ZIP.</span>}
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-vv-body">Rank at each point (as Whitespark shows it, top row first). Empty or “20+” = not found.</span>
        <div className="grid w-full gap-1.5 self-center" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 44px))`, maxWidth: size * 50 }}>
          {cells.map((c, i) => {
            const n = Number(c)
            const tone = c.trim() === '' || c.trim() === '20+' ? 'bg-vv-field' : !Number.isInteger(n) || n < 1 ? 'bg-vv-red-100' : n <= 3 ? 'bg-vv-pos-top' : n <= 7 ? 'bg-vv-orange-100' : 'bg-vv-red-100'
            return (
              <input
                key={i}
                aria-label={`Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}`}
                inputMode="numeric"
                maxLength={3}
                value={c}
                onChange={(e) => setCells(cells.map((x, j) => (j === i ? e.target.value.replace(/[^\d+]/g, '') : x)))}
                className={`box-border aspect-square w-full min-w-0 rounded-full border border-solid border-vv-field-line p-0 text-center font-body text-[13px] font-bold text-vv-ink ${tone}`}
              />
            )
          })}
        </div>
      </div>
      {bad && <p className="m-0 text-[13px] font-semibold text-vv-red">Each point: a number (1–100), “20+”, or empty.</p>}
      {save.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save.')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className={BTN_LIME} disabled={save.isPending || bad || areaBad || !keyword.trim()}>
          {save.isPending && <Spinner />}
          Save scan
        </button>
      </div>
    </form>
  )
}
