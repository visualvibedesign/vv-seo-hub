import { useState } from 'react'
import { Link } from 'react-router'
import { useKeywords } from '../../hooks/useKeywords'
import { useRankings } from '../../hooks/useRankings'
import { strategyPath } from '../../lib/clientSetup'
import { BTN_LINK, PILL } from '../../lib/ui'
import type { ClientDetail, RankingsOverview, RankRow } from '../../types/seo'
import { Bone } from '../ui/Loading'
import { Panel } from './OverviewParts'
import RankImport from './RankImport'

// Overview › Keyword rankings (phase 2c): positions from the Semrush Position Tracking CSV, exactly as exported.
// Buckets (now vs the previous CSV date), biggest moves, and a "swapped page" flag when Google ranks a different
// page than the one the keyword belongs to in Clusters. Before the first CSV: the tracked keywords with "—".

const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const urlPath = (u: string) => u.replace(/^https?:\/\/[^/]+/i, '') || '/'

function Move({ from, to }: { from: number | null; to: number | null }) {
  if (from === to) return <span className="text-vv-muted">·</span>
  if (from === null) return <span className="font-semibold text-vv-purple-deep">new</span>
  if (to === null) return <span className="font-semibold text-vv-red">out</span>
  const d = from - to
  return <span className={`whitespace-nowrap font-semibold ${d > 0 ? 'text-vv-green-ink' : 'text-vv-red'}`}>{`${d > 0 ? '↑' : '↓'} ${Math.abs(d)}`}</span>
}

export default function RankingsCard({ client: c }: { client: ClientDetail }) {
  const q = useRankings(c.siteId)
  const [all, setAll] = useState(false)
  const r = q.data
  // One Panel for every state, so the upload dialog stays open when the first import swaps the content.
  const sub = r?.latest
    ? `Semrush Position Tracking · ${day(r.latest)}${r.previous ? ` vs ${day(r.previous)}` : ''} · ${r.rows.length} keywords${r.avgPosition !== null ? ` · avg ${r.avgPosition.toFixed(1)}` : ''}`
    : `Semrush Position Tracking · ${c.counts.tracked} tracked keywords`
  return (
    <Panel title="Keyword rankings" sub={sub} right={<RankImport siteId={c.siteId} primary={!q.isPending && !r?.latest} />}>
      {q.isPending ? <Bone className="h-[140px] w-full rounded-2xl" /> : q.isError || !r?.latest ? <NoCsvYet client={c} error={q.isError} /> : <Ranked r={{ ...r, latest: r.latest }} all={all} setAll={setAll} />}
    </Panel>
  )
}

function Ranked({ r, all, setAll }: { r: RankingsOverview & { latest: string }; all: boolean; setAll: (v: boolean) => void }) {
  const rows = all ? r.rows : r.rows.slice(0, 10)
  return (
    <>
      <div className="grid grid-cols-6 gap-2 [@media(max-width:900px)]:grid-cols-3">
        {r.buckets.map((b, i) => {
          const d = b.prev === null ? null : b.now - b.prev
          const good = i === r.buckets.length - 1 ? (d ?? 0) < 0 : (d ?? 0) > 0
          return (
            <div key={b.label} className={`flex flex-col gap-0.5 rounded-[14px] px-3 py-2.5 ${i < 2 ? 'bg-vv-green-100' : i === r.buckets.length - 1 ? 'bg-vv-st-todo' : 'bg-vv-lavender-50'}`}>
              <span className="font-display text-[24px] font-semibold leading-none">{b.now}</span>
              <span className="text-[12px] text-vv-body">{b.label}</span>
              {d !== null && d !== 0 && <span className={`text-[11px] font-semibold ${good ? 'text-vv-green-ink' : 'text-vv-red'}`}>{`${d > 0 ? '+' : ''}${d} vs ${day(r.previous!)}`}</span>}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-4 [@media(max-width:1000px)]:grid-cols-1">
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[13px] font-bold uppercase tracking-[0.05em] text-vv-body">Biggest moves</h3>
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
          {r.swapped > 0 && (
            <p className="m-0 mt-1 rounded-xl bg-vv-orange-100 px-3 py-2 text-[13px] text-vv-orange-ink">
              {r.swapped} keyword{r.swapped === 1 ? '' : 's'} rank{r.swapped === 1 ? 's' : ''} with a different page than the one in Clusters (marked “swapped”).
            </p>
          )}
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-vv-body">
                <th className="py-1.5 pr-2 font-semibold">Keyword</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Position</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Change</th>
                <th className="py-1.5 font-semibold">Ranking page</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <Row key={x.keyword} x={x} hasPrev={!!r.previous} />
              ))}
            </tbody>
          </table>
          {r.rows.length > 10 && (
            <button type="button" className={`${BTN_LINK} mt-1 text-[13px]`} onClick={() => setAll(!all)}>
              {all ? 'Show top 10' : `Show all ${r.rows.length}`}
            </button>
          )}
        </div>
      </div>
      {r.lastImport && <p className="m-0 text-[12px] text-vv-muted">Last CSV: {r.lastImport.fileName} · imported {new Date(r.lastImport.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Positions exactly as exported.</p>}
    </>
  )
}

function Row({ x, hasPrev }: { x: RankRow; hasPrev: boolean }) {
  return (
    <tr className="border-0 border-t border-solid border-vv-line align-top">
      <td className="py-2 pr-2">{x.keyword}</td>
      <td className="py-2 pr-2 text-right font-bold">{x.position ?? <span className="font-normal text-vv-muted">—</span>}</td>
      <td className="py-2 pr-2 text-right">{hasPrev ? <Move from={x.prevPosition} to={x.position} /> : <span className="text-vv-muted">·</span>}</td>
      <td className="py-2">
        <span className="flex flex-wrap items-center gap-1.5">
          {x.landingUrl ? (
            <a href={x.landingUrl} target="_blank" rel="noopener noreferrer" className="max-w-[220px] truncate text-vv-purple-deep no-underline hover:underline" title={x.landingUrl}>
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
