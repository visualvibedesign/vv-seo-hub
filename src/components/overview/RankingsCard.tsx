import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useKeywords } from '../../hooks/useKeywords'
import { useRankings } from '../../hooks/useRankings'
import { strategyPath } from '../../lib/clientSetup'
import { PILL } from '../../lib/ui'
import type { ClientDetail, RankingsOverview, RankRow } from '../../types/seo'
import { Bone } from '../ui/Loading'
import { Panel, Ring } from './OverviewParts'
import Icon, { type IconName } from '../ui/Icon'
import RankImport from './RankImport'

// Overview › Keyword rankings (phase 2c): the Semrush Position Tracking CSV, every number exactly as exported.
// Change = Semrush's own "difference" column (vs the export's period start), or the previous saved CSV date.
// Ranking keywords first; "Not ranking yet" folded. Swapped page = Google ranks a different page than the one the
// keyword belongs to in Clusters. Left column: biggest moves + visibility, est. traffic, local pack, opportunities.

const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const urlPath = (u: string) => u.replace(/^https?:\/\/[^/]+/i, '') || '/'
const pct = (n: number) => `${n.toFixed(2)}%`

/** Position pill: 1–3 green, 4–10 lime, 11–20 lilac, 21–100 grey. */
function Pos({ p }: { p: number | null }) {
  if (p === null) return <span className="text-vv-muted">—</span>
  const tone = p <= 3 ? 'bg-vv-pos-top text-vv-pos-top-ink' : p <= 10 ? 'bg-vv-green text-vv-on-green' : p <= 20 ? 'bg-vv-lavender-100 text-vv-purple-ink' : 'bg-vv-st-todo text-vv-st-todo-ink'
  return <span className={`inline-flex min-w-[30px] justify-center rounded-full px-2 py-0.5 text-[12px] font-bold ${tone}`}>{p}</span>
}

function Move({ from, to }: { from: number | null; to: number | null }) {
  if (from === to) return <span className="text-vv-muted">·</span>
  if (from === null) return <span className="font-semibold text-vv-purple-deep">new</span>
  if (to === null) return <span className="font-semibold text-vv-red">out</span>
  const d = from - to
  return <span className={`whitespace-nowrap font-semibold ${d > 0 ? 'text-vv-green-ink' : 'text-vv-red'}`}>{`${d > 0 ? '↑' : '↓'} ${Math.abs(d)}`}</span>
}

/** Small line over dates. invert = lower is better (positions): better is drawn higher. */
function Spark({ values, invert, className }: { values: (number | null)[]; invert?: boolean; className: string }) {
  const pts = values.map((v, i) => [i, v] as const).filter((x): x is readonly [number, number] => x[1] !== null)
  if (pts.length < 2) return null
  const ys = pts.map(([, v]) => v)
  const lo = Math.min(...ys)
  const span = Math.max(...ys) - lo || 1
  const w = 64
  const h = 20
  const d = pts.map(([i, v], k) => `${k ? 'L' : 'M'}${((i / Math.max(1, values.length - 1)) * w).toFixed(1)},${(invert ? 2 + ((v - lo) / span) * (h - 4) : h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`h-5 w-16 ${className}`} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const FEATURE_TIP: Record<string, string> = {
  local: 'Shows in the Google Maps 3-pack for this search',
  'ai overview': 'Cited in Google’s AI Overview for this search',
}

/** Small badge with a tooltip on hover and keyboard focus (title kept as a fallback). */
function Tip({ tip, children, className }: { tip: string; children: ReactNode; className: string }) {
  return (
    <span tabIndex={0} title={tip} aria-label={tip} className={`group relative ${PILL} !px-2 !py-0.5 !text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-vv-purple ${className}`}>
      {children}
      <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-max max-w-[220px] whitespace-normal rounded-lg bg-vv-ink px-2.5 py-1.5 text-[12px] font-medium text-vv-surface shadow-lg group-hover:block group-focus:block">
        {tip}
      </span>
    </span>
  )
}

function Feature({ t }: { t: string | null }) {
  if (!t || t === 'organic') return null
  if (t === 'local')
    return (
      <Tip tip={FEATURE_TIP.local} className="bg-vv-pink-100 text-vv-pink-ink">
        <Icon name="map-pin" className="h-3 w-3" /> Local pack
      </Tip>
    )
  const label = t.replace(/\b(ai)\b/i, 'AI').replace(/^./, (x) => x.toUpperCase())
  return (
    <Tip tip={FEATURE_TIP[t] ?? `Semrush result type: ${label}`} className="bg-vv-lavender-100 text-vv-purple-ink">
      <Icon name="sparkles" className="h-3 w-3" /> {label}
    </Tip>
  )
}

const SEGMENTS = ['bg-vv-seg-top', 'bg-vv-green', 'bg-vv-lavender', 'bg-vv-seg-21', 'bg-vv-seg-51', 'bg-vv-seg-out']

/** One stacked horizontal bar of the position ranges + a legend with counts and change vs the comparison date. */
function StackedBar({ r }: { r: RankingsOverview }) {
  const total = Math.max(1, r.buckets.reduce((a, b) => a + b.now, 0))
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={r.buckets.map((b) => `${b.label}: ${b.now}`).join(', ')}>
        {r.buckets.map((b, i) =>
          b.now > 0 ? <span key={b.label} title={`${b.label}: ${b.now}`} className={`h-full ${SEGMENTS[i]}`} style={{ width: `${(b.now / total) * 100}%`, minWidth: 6 }} /> : null,
        )}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-[12px]">
        {r.buckets.map((b, i) => {
          const d = b.prev === null ? null : b.now - b.prev
          const good = i === r.buckets.length - 1 ? (d ?? 0) < 0 : (d ?? 0) > 0
          return (
            <li key={b.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${SEGMENTS[i]}`} />
              <span className="text-vv-body">{b.label}</span>
              <strong>{b.now}</strong>
              {d !== null && d !== 0 && <span className={`font-semibold ${good ? 'text-vv-green-ink' : 'text-vv-red'}`}>{`${d > 0 ? '+' : ''}${d}`}</span>}
            </li>
          )
        })}
        {r.previous && <li className="text-vv-muted">change vs {day(r.previous)}</li>}
      </ul>
    </div>
  )
}

export default function RankingsCard({ client: c }: { client: ClientDetail }) {
  const q = useRankings(c.siteId)
  const r = q.data
  // One Panel for every state, so the upload dialog stays open when the first import swaps the content.
  const sub = r?.latest
    ? `Semrush Position Tracking · ${day(r.latest)}${r.previous ? ` vs ${day(r.previous)}` : ''} · ${r.ranking} of ${r.total} ranking${r.avgPosition !== null ? ` · avg ${r.avgPosition.toFixed(1)} (ranking only)` : ''}`
    : `Semrush Position Tracking · ${c.counts.tracked} tracked keywords`
  return (
    <Panel title="Keyword rankings" sub={sub} right={<RankImport siteId={c.siteId} primary={!q.isPending && !r?.latest} />}>
      {q.isPending ? <Bone className="h-[140px] w-full rounded-2xl" /> : q.isError || !r?.latest ? <NoCsvYet client={c} error={q.isError} /> : <Ranked r={r} siteId={c.siteId} />}
    </Panel>
  )
}

function Ranked({ r, siteId }: { r: RankingsOverview; siteId: string }) {
  const [showOut, setShowOut] = useState(false)
  const ranking = r.rows.filter((x) => x.position !== null)
  const out = r.rows.filter((x) => x.position === null)
  const trend = r.rows.some((x) => x.history.length >= 3)
  const cols = r.columns
  const head: { label: string; right?: boolean; phoneHide?: boolean; show: boolean }[] = [
    { label: 'Keyword', show: true },
    { label: 'Position', right: true, show: true },
    { label: 'Change', right: true, show: true },
    { label: 'Trend', phoneHide: true, show: trend },
    { label: 'Volume', right: true, show: cols.volume },
    { label: 'KD %', right: true, phoneHide: true, show: cols.kd },
    { label: 'Visibility', right: true, phoneHide: true, show: cols.visibility },
    { label: 'Est. traffic', right: true, phoneHide: true, show: cols.traffic },
    { label: 'Ranking page', phoneHide: true, show: true },
  ]
  const shown = head.filter((h) => h.show)
  return (
    <>
      <StackedBar r={r} />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] items-start gap-4 [@media(max-width:1100px)]:grid-cols-1">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-[12px] font-bold uppercase tracking-[0.05em] text-vv-body">Biggest moves</h3>
            {!r.previous ? (
              <p className="m-0 text-[13px] text-vv-body">One date so far. Moves show after the next CSV (a later date).</p>
            ) : r.moves.length === 0 ? (
              <p className="m-0 text-[13px] text-vv-body">No position changed since {day(r.previous)}.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {r.moves.map((m) => (
                  <li key={m.keyword} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate">{m.keyword}</span>
                    <span className="flex flex-none items-baseline gap-2 text-vv-body">
                      {m.from ?? '—'} → <strong className="text-vv-ink">{m.to ?? '—'}</strong> <Move from={m.from} to={m.to} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <SideCards r={r} siteId={siteId} />
          {r.swapped > 0 && (
            <p className="m-0 rounded-xl bg-vv-orange-100 px-3 py-2 text-[13px] text-vv-orange-ink">
              {r.swapped} keyword{r.swapped === 1 ? '' : 's'} rank{r.swapped === 1 ? 's' : ''} with a different page than the one in Clusters (marked “swapped”).
            </p>
          )}
        </div>

        <div className="min-w-0 overflow-x-auto rounded-2xl border border-solid border-vv-line">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-vv-lavender-50 text-left text-[12px] text-vv-body">
                {shown.map((h) => (
                  <th key={h.label} className={`whitespace-nowrap px-3 py-2 font-semibold ${h.right ? 'text-right' : ''} ${h.phoneHide ? 'phone:hidden' : ''}`}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((x) => (
                <Row key={x.keyword} x={x} hasPrev={!!r.previous} cols={cols} trend={trend} />
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={shown.length} className="px-3 py-3 text-vv-body">
                    No keyword ranks in the top 100 yet.
                  </td>
                </tr>
              )}
              {out.length > 0 && (
                <tr className="border-0 border-t border-solid border-vv-line">
                  <td colSpan={shown.length} className="p-0">
                    <button type="button" aria-expanded={showOut} onClick={() => setShowOut(!showOut)} className="flex w-full items-center gap-2 border-0 bg-transparent px-3 py-2.5 text-left font-body text-[13px] font-semibold text-vv-purple-deep hover:bg-vv-lavender-50">
                      <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${showOut ? 'rotate-90' : ''}`} aria-hidden="true">
                        <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Not ranking yet ({out.length})
                    </button>
                  </td>
                </tr>
              )}
              {showOut && out.map((x) => <Row key={x.keyword} x={x} hasPrev={!!r.previous} cols={cols} trend={trend} />)}
            </tbody>
          </table>
        </div>
      </div>
      {r.lastImport && <p className="m-0 break-all text-[12px] text-vv-muted">Last CSV: {r.lastImport.fileName} · imported {new Date(r.lastImport.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Numbers exactly as exported.</p>}
    </>
  )
}

function Row({ x, hasPrev, cols, trend }: { x: RankRow; hasPrev: boolean; cols: RankingsOverview['columns']; trend: boolean }) {
  const td = 'border-0 border-t border-solid border-vv-line px-3 py-2 align-middle'
  return (
    <tr>
      <td className={td}>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="min-w-[120px]">{x.keyword}</span>
          <Feature t={x.serpType} />
        </span>
      </td>
      <td className={`${td} text-right`}>
        <Pos p={x.position} />
      </td>
      <td className={`${td} text-right`}>{hasPrev ? <Move from={x.prevPosition} to={x.position} /> : <span className="text-vv-muted">·</span>}</td>
      {trend && <td className={`${td} phone:hidden`}>{x.history.length >= 3 ? <Spark values={x.history} invert className="text-vv-chart-clicks" /> : null}</td>}
      {cols.volume && <td className={`${td} text-right`}>{x.volume ?? '—'}</td>}
      {cols.kd && <td className={`${td} text-right phone:hidden`}>{x.kd ?? '—'}</td>}
      {cols.visibility && <td className={`${td} text-right phone:hidden`}>{x.visibility === null ? '—' : pct(x.visibility)}</td>}
      {cols.traffic && <td className={`${td} text-right phone:hidden`}>{x.traffic ?? '—'}</td>}
      <td className={`${td} phone:hidden`}>
        <span className="flex flex-wrap items-center gap-1.5">
          {x.landingUrl ? (
            <a href={x.landingUrl} target="_blank" rel="noopener noreferrer" className="max-w-[200px] truncate text-vv-purple-deep no-underline hover:underline" title={x.landingUrl}>
              {urlPath(x.landingUrl)}
            </a>
          ) : (
            <span className="text-vv-muted">—</span>
          )}
          {x.swappedWith && (
            <span className={`${PILL} !px-2 !py-0.5 !text-[11px] bg-vv-orange-100 text-vv-orange-ink`} title={`In Clusters this keyword belongs to ${x.swappedWith.name} (${urlPath(x.swappedWith.url)})`}>
              swapped · should be {urlPath(x.swappedWith.url)}
            </span>
          )}
        </span>
      </td>
    </tr>
  )
}

/** Graph cards under Biggest moves. Every number from the CSV; a card without its column is hidden. */
function SideCards({ r, siteId }: { r: RankingsOverview; siteId: string }) {
  const prevDay = r.previous ? day(r.previous) : ''
  const maxVol = Math.max(1, ...r.opportunities.map((o) => Number(o.volume) || 0))
  const vis = r.visibility
  const visD = vis && vis.prev !== null ? vis.now - vis.prev : null
  return (
    <div className="flex flex-col gap-2.5">
      {vis && (
        <Mini icon="eye" title="Visibility" tone="bg-vv-lavender-50">
          <span className="flex items-center gap-3">
            <Ring value={vis.now} max={100} color="text-vv-chart-clicks" center={pct(vis.now)} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              {visD !== null &&
                (Math.abs(visD) < 0.005 ? (
                  <span className="text-[12px] text-vv-body">same as {prevDay}</span>
                ) : (
                  <span className={`text-[12px] font-semibold ${visD > 0 ? 'text-vv-green-ink' : 'text-vv-red'}`}>{`${visD > 0 ? '+' : '−'}${Math.abs(visD).toFixed(2)} pts vs ${prevDay}`}</span>
                ))}
              <Spark values={vis.series.map((x) => x.value)} className="text-vv-chart-clicks" />
              <span className="text-[11px] text-vv-body">Semrush visibility (sum of the keywords)</span>
            </span>
          </span>
        </Mini>
      )}
      {(r.localPack !== null || r.aiOverview !== null) && (
        <div className="grid grid-cols-2 gap-2.5">
          {r.localPack !== null && (
            <Mini icon="map-pin" title="Local pack" tone="bg-vv-pink-100">
              <span className="flex items-center gap-2.5">
                <Ring value={r.localPack} max={r.total} color="text-vv-chart-impr" center={`${r.localPack}/${r.total}`} />
                <span className="text-[12px] text-vv-body">in the Maps 3-pack</span>
              </span>
            </Mini>
          )}
          {r.aiOverview !== null && (
            <Mini icon="sparkles" title="AI overview" tone="bg-vv-lavender-50">
              <span className="flex items-center gap-2.5">
                <Ring value={r.aiOverview} max={r.total} color="text-vv-purple" center={`${r.aiOverview}/${r.total}`} />
                <span className="text-[12px] text-vv-body">cited</span>
              </span>
            </Mini>
          )}
        </div>
      )}
      {r.traffic && (
        <Mini icon="trending-up" title="Est. traffic" tone="bg-vv-pink-100">
          <span className="font-display text-[24px] font-semibold leading-none">{r.traffic.now.toLocaleString('en-US')}</span>
        </Mini>
      )}
      <Mini icon="target" title="Opportunities" tone="bg-vv-orange-100">
        {r.opportunities.length === 0 ? (
          <span className="text-[13px] text-vv-body">Every tracked keyword ranks.</span>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {r.opportunities.map((o) => {
              const v = Number(o.volume)
              return (
                <li key={o.keyword} className="flex flex-col gap-1 text-[13px]">
                  <span className="flex items-baseline justify-between gap-2">
                    <Link to={`${strategyPath(siteId, 'keywords/database')}?q=${encodeURIComponent(o.keyword)}`} className="min-w-0 truncate text-vv-ink no-underline hover:text-vv-purple-deep hover:underline" title="Open in Strategy › Database">
                      {o.keyword}
                    </Link>
                    <span className="flex-none text-[12px]">
                      <strong>{o.volume ?? '—'}</strong>
                      {o.kd !== null && <span className="text-vv-body"> · KD {o.kd}</span>}
                    </span>
                  </span>
                  <span className="h-1.5 rounded-full bg-vv-surface">
                    <span className="block h-1.5 rounded-full bg-vv-chart-impr" style={{ width: `${Number.isFinite(v) && v > 0 ? Math.max(3, (v / maxVol) * 100) : 0}%` }} />
                  </span>
                </li>
              )
            })}
            <li className="text-[11px] text-vv-body">Tracked, not ranking yet · by search volume</li>
          </ul>
        )}
      </Mini>
    </div>
  )
}

function Mini({ icon, title, tone, children }: { icon: IconName; title: string; tone: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 rounded-[16px] px-3.5 py-3 ${tone}`}>
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-vv-body">
        <Icon name={icon} className="h-3.5 w-3.5" />
        {title}
      </span>
      {children}
    </div>
  )
}

/** Before the first Position Tracking CSV: the tracked keywords (real) with "—", and how to add the CSV. */
function NoCsvYet({ client: c, error }: { client: ClientDetail; error: boolean }) {
  const q = useKeywords(c.siteId)
  const tracked = (q.data ?? []).filter((k) => k.track && k.status === 'keep')
  return (
    <>
      {error && <p className="m-0 text-[13px] font-semibold text-vv-red">Couldn’t load the rankings. Try again in a moment.</p>}
      <p className="m-0 text-[13px] text-vv-body">No positions yet. In Semrush: Position Tracking › Overview › Rankings Overview › Export › CSV, then Upload CSV here.</p>
      {tracked.length === 0 ? (
        <p className="m-0 text-[13px] text-vv-body">
          No keywords tracked yet. Pick them in{' '}
          <Link to={strategyPath(c.siteId, 'keywords/database')} className="font-semibold text-vv-purple-deep">
            Database
          </Link>{' '}
          (Track).
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-2 gap-x-6 p-0 [@media(max-width:760px)]:grid-cols-1">
          {tracked.slice(0, 10).map((k) => (
            <li key={k.id} className="flex justify-between gap-3 border-0 border-t border-solid border-vv-line py-2 text-[13px]">
              <span className="min-w-0 truncate">{k.keyword}</span>
              <span className="flex-none text-vv-muted">—</span>
            </li>
          ))}
          {tracked.length > 10 && <li className="pt-1 text-[12px] text-vv-muted">+ {tracked.length - 10} more</li>}
        </ul>
      )}
    </>
  )
}
