import { useState } from 'react'
import { useDeleteGbp, useDeleteMapGrid, useLocal, useSaveGbp, useSaveMapGrid } from '../../hooks/useLocal'
import { ApiError } from '../../lib/api'
import { rememberAuthor, savedAuthor } from '../../lib/notes'
import { BTN_GHOST, BTN_LIME, BTN_LINK, FIELD, LABEL } from '../../lib/ui'
import { gridStats, periodLabel } from '../../lib/local'
import type { GbpInput, GbpSnapshot, MapGrid } from '../../types/seo'
import ConfirmDialog from '../ui/ConfirmDialog'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import { Bone, Spinner } from '../ui/Loading'
import { Dash, Panel, Ring } from './OverviewParts'

// Phase 2d · Overview cards for the numbers the team types in: Google Business Profile (once a month) and the
// Whitespark map grid (typed scan now, CSV once the sample is in). Real values only; empty = "—". The grid centre is an
// area name only, never an address.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const d12 = (d: string) => new Date(`${d}T12:00:00`)
const short = (d: string) => d12(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`


// ---- GBP ----------------------------------------------------------------------------------------------------

/** The three things people do from the profile, in a fixed colour order (checked for colour blindness). */
const ACTIONS = [
  { key: 'calls', label: 'Calls', bar: 'bg-vv-gbp-calls' },
  { key: 'websiteClicks', label: 'Website clicks', bar: 'bg-vv-gbp-web' },
  { key: 'directions', label: 'Directions', bar: 'bg-vv-gbp-dir' },
] as const

/**
 * Typed actions (calls, website clicks, directions) per 100 profile views. Uses the actions that ARE typed: a
 * service-area business never has directions. Unknown only when views are missing / 0 or no action is typed.
 * `used` = which actions went in, so two months are only compared when they used the same ones.
 */
const per100 = (s: GbpSnapshot | undefined): { value: number; used: string; missing: string[] } | null => {
  if (!s || !s.views) return null
  const typed = ACTIONS.filter((a) => s[a.key] !== null)
  if (!typed.length) return null
  return { value: (typed.reduce((t, a) => t + (s[a.key] ?? 0), 0) / s.views) * 100, used: typed.map((a) => a.key).join(','), missing: ACTIONS.filter((a) => s[a.key] === null).map((a) => a.label.toLowerCase()) }
}

/** Axis label: "Oct" for a calendar month, else the start date. */
const tick = (s: GbpSnapshot) => {
  const l = periodLabel(s.periodFrom, s.periodTo)
  return l.includes('–') ? short(s.periodFrom) : d12(s.periodFrom).toLocaleDateString('en-US', { month: 'short' })
}

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
    return have ?? { periodFrom: from, periodTo: to, views: null, viewsSearchDesktop: null, viewsSearchMobile: null, viewsMapsDesktop: null, viewsMapsMobile: null, calls: null, directions: null, websiteClicks: null, reviews: null, rating: null, newestReviewOn: null, typedBy: null, note: null }
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
            <div className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-vv-pink-100 p-3">
              <div className="text-[22px] font-bold">{now?.views ?? <Dash />}</div>
              <div className="text-[12px] text-vv-body">Profile views</div>
              {now && prev && <Change now={now.views} prev={prev.views} prevLabel={prevLabel} />}
            </div>
            <Per100 now={now} prev={prev} prevLabel={prevLabel} />
          </div>
          {now ? (
            <>
              <ActionsChart months={list.slice(0, 6).reverse()} />
              <Reviews now={now} prev={prev} prevLabel={prevLabel} />
              <ViewsDonut s={now} />
            </>
          ) : (
            <p className="m-0 text-[13px] text-vv-body">Nothing typed yet. Once a month: GBP › Performance, pick last month, type the four numbers + reviews.</p>
          )}
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
    return { periodFrom: start.periodFrom, periodTo: start.periodTo, views: s(start.views), viewsSearchDesktop: s(start.viewsSearchDesktop), viewsSearchMobile: s(start.viewsSearchMobile), viewsMapsDesktop: s(start.viewsMapsDesktop), viewsMapsMobile: s(start.viewsMapsMobile), calls: s(start.calls), directions: s(start.directions), websiteClicks: s(start.websiteClicks), reviews: s(start.reviews), rating: s(start.rating), newestReviewOn: start.newestReviewOn ?? '', typedBy: author, note: start.note ?? '' }
  })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  const n = (k: string) => (v[k].trim() === '' ? null : Number(v[k]))
  // A gentle check only: GBP's total is normally the sum of the four (nothing is changed or blocked).
  const parts = ['viewsSearchDesktop', 'viewsSearchMobile', 'viewsMapsDesktop', 'viewsMapsMobile'].map(n)
  const partsSum = parts.every((x) => x !== null && Number.isFinite(x)) ? (parts as number[]).reduce((a, b) => a + b, 0) : null
  const splitNote = partsSum !== null && n('views') !== null && partsSum !== n('views') ? `The four add up to ${partsSum}, Profile views says ${n('views')}. Fine if that’s what GBP shows.` : ''
  const submit = () => {
    if (v.typedBy.trim()) rememberAuthor(v.typedBy)
    save.mutate(
      { periodFrom: v.periodFrom, periodTo: v.periodTo, views: n('views'), viewsSearchDesktop: n('viewsSearchDesktop'), viewsSearchMobile: n('viewsSearchMobile'), viewsMapsDesktop: n('viewsMapsDesktop'), viewsMapsMobile: n('viewsMapsMobile'), calls: n('calls'), directions: n('directions'), websiteClicks: n('websiteClicks'), reviews: n('reviews'), rating: n('rating'), newestReviewOn: v.newestReviewOn || null, typedBy: v.typedBy || null, note: v.note || null },
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
      <fieldset className="m-0 flex flex-col gap-2 rounded-2xl border border-solid border-vv-line p-3">
        <legend className="px-1 text-[13px] font-semibold text-vv-body">Where the views came from (optional)</legend>
        <div className="grid grid-cols-2 gap-3">
          {num('viewsSearchDesktop', 'Google Search · desktop')}
          {num('viewsSearchMobile', 'Google Search · mobile')}
          {num('viewsMapsDesktop', 'Google Maps · desktop')}
          {num('viewsMapsMobile', 'Google Maps · mobile')}
        </div>
        {splitNote && <span className="text-[12px] text-vv-orange-ink">{splitNote}</span>}
      </fieldset>
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


// ---- Actions per 100 views, actions by month, reviews ----------------------------------------------------------

function Per100({ now, prev, prevLabel }: { now: GbpSnapshot | undefined; prev: GbpSnapshot | undefined; prevLabel: string }) {
  const a = per100(now)
  const b = per100(prev)
  const d = a && b && a.used === b.used ? Math.round((a.value - b.value) * 10) / 10 : null
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-vv-lavender-50 p-3" title="Typed actions (calls + website clicks + directions) per 100 profile views">
      <div className="text-[22px] font-bold">{a === null ? <Dash /> : a.value.toFixed(1)}</div>
      <div className="text-[12px] text-vv-body">Actions per 100 views</div>
      {a && a.missing.length > 0 && <span className="text-[11px] text-vv-muted">{a.missing.join(', ')} not tracked</span>}
      {d !== null &&
        (d === 0 ? (
          <span className="text-[11px] text-vv-body">same as {prevLabel}</span>
        ) : (
          <span className={`text-[11px] font-semibold ${d > 0 ? 'text-vv-green-ink' : 'text-vv-red'}`}>{`${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} vs ${prevLabel}`}</span>
        ))}
    </div>
  )
}

/** Grouped bars: calls / website clicks / directions per typed month (up to 6, oldest left). Grey stub = not typed. */
function ActionsChart({ months }: { months: GbpSnapshot[] }) {
  const [hover, setHover] = useState<string | null>(null)
  const vals = months.flatMap((m) => ACTIONS.map((a) => m[a.key])).filter((v): v is number => v !== null)
  if (vals.length === 0) return null
  const max = Math.max(1, ...vals)
  const now = months[months.length - 1]
  const prev = months.length > 1 ? months[months.length - 2] : undefined
  const prevLabel = prev ? periodLabel(prev.periodFrom, prev.periodTo) : ''
  const hasGap = months.some((m) => ACTIONS.some((a) => m[a.key] === null))
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.05em] text-vv-body">Actions by month</h3>
        <span className="text-[11px] text-vv-muted">{months.length === 1 ? 'one month so far' : `last ${months.length} months`}</span>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px]">
        {ACTIONS.map((a) => (
          <li key={a.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${a.bar}`} />
            <span className="text-vv-body">{a.label}</span>
            <strong>{now[a.key] ?? '—'}</strong>
            {prev && <Change now={now[a.key]} prev={prev[a.key]} prevLabel={prevLabel} />}
          </li>
        ))}
      </ul>
      <div className="relative pl-7">
        <span className="absolute left-0 top-0 w-6 text-right text-[10px] leading-none text-vv-muted">{max}</span>
        <span className="absolute bottom-[18px] left-0 w-6 text-right text-[10px] leading-none text-vv-muted">0</span>
        <span aria-hidden="true" className="absolute left-7 right-0 top-0 border-0 border-t border-dashed border-vv-line" />
        <div className="flex h-[120px] items-end gap-2 border-0 border-b border-solid border-vv-line">
          {months.map((m, i) => {
            const label = periodLabel(m.periodFrom, m.periodTo)
            const tipPos = i === 0 ? 'left-0' : i === months.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'
            return (
              <div
                key={m.id}
                tabIndex={0}
                aria-label={`${label}: ${ACTIONS.map((a) => `${a.label} ${m[a.key] ?? 'not typed'}`).join(', ')}`}
                onMouseEnter={() => setHover(m.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.id)}
                onBlur={() => setHover(null)}
                className={`relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center gap-[2px] rounded-t-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-vv-purple ${hover === m.id ? 'bg-vv-lavender-50' : ''}`}
              >
                {ACTIONS.map((a) => {
                  const v = m[a.key]
                  return v === null ? (
                    <span key={a.key} className="h-[3px] w-full max-w-[14px] rounded-full bg-vv-line" />
                  ) : (
                    <span key={a.key} className={`w-full max-w-[14px] rounded-t-[4px] ${a.bar}`} style={{ height: `${(v / max) * 100}%` }} />
                  )
                })}
                {hover === m.id && (
                  <span role="tooltip" className={`pointer-events-none absolute bottom-full z-20 mb-1.5 flex w-max flex-col gap-0.5 rounded-lg bg-vv-ink px-2.5 py-1.5 text-[12px] text-vv-surface shadow-lg ${tipPos}`}>
                    <strong>{label}</strong>
                    {ACTIONS.map((a) => (
                      <span key={a.key} className="flex items-center gap-1.5">
                        <span aria-hidden="true" className={`h-2 w-2 rounded-sm ${a.bar}`} />
                        {a.label} <strong className="ml-auto pl-3">{m[a.key] ?? '—'}</strong>
                      </span>
                    ))}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex gap-2">
          {months.map((m) => (
            <span key={m.id} className="min-w-0 flex-1 truncate text-center text-[11px] text-vv-body">
              {tick(m)}
            </span>
          ))}
        </div>
      </div>
      {hasGap && <span className="text-[11px] text-vv-muted">Grey stub = not typed for that month.</span>}
    </div>
  )
}

/** Day after an ISO date, to tell whether two typed periods follow each other. */
const nextDay = (d: string) => {
  const x = d12(d)
  x.setDate(x.getDate() + 1)
  return iso(x)
}

function Reviews({ now, prev, prevLabel }: { now: GbpSnapshot; prev: GbpSnapshot | undefined; prevLabel: string }) {
  if (now.rating === null && now.reviews === null && !now.newestReviewOn) return <p className="m-0 text-[13px] text-vv-body">No review numbers typed for this month.</p>
  const added = now.reviews !== null && prev && prev.reviews !== null ? now.reviews - prev.reviews : null
  const when = prev && nextDay(prev.periodTo) === now.periodFrom ? 'this month' : `since ${prevLabel}`
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-vv-orange-100 p-3">
      {now.rating !== null ? (
        <span role="img" aria-label={`Rating ${now.rating.toFixed(1)} of 5`}>
          <Ring
            value={now.rating}
            max={5}
            color="text-vv-orange-ink"
            center={
              <span className="flex items-center gap-0.5">
                <Icon name="star" className="h-3 w-3 text-vv-orange-ink" fill />
                {now.rating.toFixed(1)}
              </span>
            }
          />
        </span>
      ) : (
        <span className="flex h-[68px] w-[68px] flex-none items-center justify-center rounded-full border-[7px] border-solid border-vv-line text-[12px] text-vv-muted">—</span>
      )}
      <div className="flex min-w-0 flex-col gap-0.5 text-[13px]">
        <strong>{now.reviews !== null ? `${now.reviews.toLocaleString('en-US')} reviews` : 'Reviews not typed'}</strong>
        {added !== null && (
          <span className={added > 0 ? 'font-semibold text-vv-green-ink' : 'text-vv-body'}>{added > 0 ? `+${added} ${when}` : added === 0 ? `No new reviews ${when}` : `${added} ${when}`}</span>
        )}
        {now.newestReviewOn && <span className="text-vv-body">Newest review {short(now.newestReviewOn)}</span>}
      </div>
    </div>
  )
}

// ---- Profile views: Search vs Maps donut (device split on hover / focus) ----------------------------------------

type Part = { key: 'search' | 'maps'; label: string; desktop: number | null; mobile: number | null; color: string; dot: string }

/** Sum of the known parts; null when neither is known (unknown, never 0). */
const known = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0))

function ViewsDonut({ s }: { s: GbpSnapshot }) {
  const [hover, setHover] = useState<Part['key'] | null>(null)
  const parts: Part[] = [
    { key: 'search', label: 'Google Search', desktop: s.viewsSearchDesktop, mobile: s.viewsSearchMobile, color: 'text-vv-chart-clicks', dot: 'bg-vv-chart-clicks' },
    { key: 'maps', label: 'Google Maps', desktop: s.viewsMapsDesktop, mobile: s.viewsMapsMobile, color: 'text-vv-chart-impr', dot: 'bg-vv-chart-impr' },
  ]
  const totals = parts.map((p) => known(p.desktop, p.mobile))
  if (totals.every((t) => t === null)) return null
  const sum = totals.reduce<number>((a, b) => a + (b ?? 0), 0)
  const r = 26
  const c = 2 * Math.PI * r
  let offset = 0

  const fmt = (n: number | null) => (n === null ? '—' : n.toLocaleString('en-US'))
  const pctOf = (n: number | null) => (n === null || sum === 0 ? '' : ` · ${Math.round((n / sum) * 100)}%`)
  const shown = parts.find((p) => p.key === hover)
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[14px] bg-vv-lavender-50 p-3">
      <span className="relative flex h-[84px] w-[84px] flex-none items-center justify-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" role="img" aria-label={parts.map((p, i) => `${p.label}: ${fmt(totals[i])}`).join(', ')}>
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="9" className="stroke-vv-line" />
          {sum > 0 &&
            parts.map((p, i) => {
              const t = totals[i] ?? 0
              if (!t) return null
              const len = (t / sum) * c
              const gap = parts.filter((_, j) => (totals[j] ?? 0) > 0).length > 1 ? 1.5 : 0
              const el = (
                <circle
                  key={p.key}
                  cx="32"
                  cy="32"
                  r={r}
                  fill="none"
                  strokeWidth={hover === p.key ? 11 : 9}
                  stroke="currentColor"
                  className={`${p.color} cursor-default transition-[stroke-width]`}
                  strokeDasharray={`${Math.max(0.01, len - gap)} ${c}`}
                  strokeDashoffset={-offset}
                  onMouseEnter={() => setHover(p.key)}
                  onMouseLeave={() => setHover(null)}
                />
              )
              offset += len
              return el
            })}
        </svg>
        <span className="relative text-center leading-tight">
          <span className="block text-[15px] font-bold">{fmt(sum)}</span>
          <span className="block text-[10px] text-vv-body">views split</span>
        </span>
      </span>
      <ul className="m-0 flex min-w-[150px] flex-1 list-none flex-col gap-1.5 p-0 text-[13px]">
        {parts.map((p, i) => (
          <li
            key={p.key}
            tabIndex={0}
            onMouseEnter={() => setHover(p.key)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(p.key)}
            onBlur={() => setHover(null)}
            className={`flex cursor-default items-center gap-2 rounded-lg px-1.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-vv-purple ${hover === p.key ? 'bg-vv-surface' : ''}`}
          >
            <span aria-hidden="true" className={`h-2.5 w-2.5 flex-none rounded-full ${p.dot}`} />
            <span className="text-vv-body">{p.label}</span>
            <strong className="ml-auto">{fmt(totals[i])}</strong>
            <span className="w-9 text-right text-[12px] text-vv-body">{pctOf(totals[i]).replace(' · ', '')}</span>
          </li>
        ))}
        <li className="min-h-[18px] px-1.5 text-[12px] text-vv-body" aria-live="polite">
          {shown ? `${shown.label}: desktop ${fmt(shown.desktop)} · mobile ${fmt(shown.mobile)}` : 'Hover a part for desktop / mobile'}
        </li>
      </ul>
    </div>
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
