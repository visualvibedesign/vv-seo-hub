import { Link } from 'react-router'
import { useBaseline } from '../../hooks/useBaseline'
import { agencyDate } from '../../lib/agencyTime'
import { CHANGE_TONE as TONE, changeOf, COMPARE_ROWS, fmtMetric, shortDates, SOURCE_NAME } from '../../lib/baseline'
import { clientPath } from '../../lib/clientSetup'
import { PILL } from '../../lib/ui'
import { Bone } from '../ui/Loading'
import { LilacTable, Panel } from './OverviewParts'

// Overview › Baseline vs now (phase 2e): the current baseline's frozen numbers next to the latest ones, each with its
// own dates. Search Console + GA4 "now" = the last 28 days (same length as the baseline's). Green = better (for
// positions and map grid rank, lower is better). Missing on either side = "—", never 0.

const SHORT_SOURCE = { ...SOURCE_NAME, semrush: 'Semrush CSV', gbp: 'GBP (typed in)', whitespark: 'Whitespark' }
/** Saved-at dates in the agency's time zone (Asia/Manila). */
const savedOn = agencyDate

export default function BaselineCompare({ siteId }: { siteId: string }) {
  const q = useBaseline(siteId)
  const s = q.data
  const cur = s?.current ?? null
  const links = (
    <span className="flex gap-4 text-[13px] font-semibold">
      <Link to={clientPath(siteId, 'baseline')} className="text-vv-purple-deep">
        Baseline ›
      </Link>
      <Link to={clientPath(siteId, 'results')} className="text-vv-purple-deep">
        Results ›
      </Link>
    </span>
  )
  const sub = cur ? `${cur.label ?? 'Baseline'} · saved ${savedOn(cur.savedAt)} vs the latest numbers` : 'The Day 3 baseline compared with the latest numbers'

  if (q.isPending)
    return (
      <Panel flush title="Baseline vs now" sub={sub} right={links}>
        <div className="px-5 pb-5">
          <Bone className="h-[200px] w-full rounded-2xl" />
        </div>
      </Panel>
    )
  if (q.isError || !s || !cur)
    return (
      <Panel flush title="Baseline vs now" sub={sub} right={links}>
        <p className="m-0 px-5 pb-5 text-[13px] text-vv-body">
          {q.isError ? (
            <span className="font-semibold text-vv-red">Couldn’t load the baseline. Try again in a moment.</span>
          ) : (
            <>
              No baseline saved yet. Save one on{' '}
              <Link to={clientPath(siteId, 'baseline')} className="font-semibold text-vv-purple-deep">
                Baseline
              </Link>{' '}
              (Day 3) and the numbers show here.
            </>
          )}
        </p>
      </Panel>
    )

  // The map grid row only shows once the client uses it (a scan, or it's in the baseline).
  const rows = COMPARE_ROWS.filter((r) => r.source !== 'whitespark' || s.required.includes('whitespark'))
  const cell = (n: number | null | undefined, kind: (typeof rows)[number]['kind'], dates: string, strong = false) => (
    <span className="flex flex-col items-end leading-tight">
      <span className={strong ? 'font-semibold' : ''}>{fmtMetric(kind, n)}</span>
      {dates && <span className="whitespace-nowrap text-[11px] text-vv-muted">{dates}</span>}
    </span>
  )
  return (
    <Panel flush title="Baseline vs now" sub={sub} right={links}>
      <LilacTable
        head={['Metric', 'Source', 'Baseline', 'Now', 'Change']}
        right={[2, 3, 4]}
        rows={rows.map((r) => {
          const b = cur.snapshots.find((x) => x.source === r.source)
          const n = s.live.find((x) => x.source === r.source)
          const ch = changeOf(r, b?.values[r.metric], n?.values[r.metric])
          return [
            <strong key="m" title={r.lowerIsBetter ? 'Lower is better' : undefined}>
              {r.label}
            </strong>,
            <span key="s" className="text-vv-body">
              {SHORT_SOURCE[r.source]}
            </span>,
            cell(b?.values[r.metric], r.kind, b ? shortDates(b) : 'not in baseline'),
            cell(n?.values[r.metric], r.kind, n ? shortDates(n) : 'no data', true),
            ch.tone === 'none' ? (
              <span key="c" className={TONE.none}>
                —
              </span>
            ) : (
              <span key="c" className={`${PILL} !px-2.5 !py-0.5 ${TONE[ch.tone]}`} title={r.lowerIsBetter ? 'Lower is better' : undefined}>
                {ch.text}
              </span>
            ),
          ]
        })}
      />
    </Panel>
  )
}
