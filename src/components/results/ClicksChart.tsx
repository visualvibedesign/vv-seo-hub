import { useState } from 'react'
import type { ReportsState } from '../../types/seo'

// Results › Clicks from Google: Search Console clicks per calendar month (last 6), straight from the daily numbers.
// One series, so no legend (the title names it). Every bar is labelled; a month not fully pulled is lighter + "so far";
// a month before the pulled history has no bar and shows "—" (unknown, never 0).

const mon = (m: string) => new Date(`${m}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })
const monYear = (m: string) => new Date(`${m}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

export default function ClicksChart({ data }: { data: ReportsState['clicksByMonth'] }) {
  const [hover, setHover] = useState<string | null>(null)
  const known = data.filter((d) => d.clicks !== null)
  if (!known.length) return <p className="m-0 text-[13px] text-vv-body">No Search Console clicks yet. Connect Search Console on the Overview.</p>
  const max = Math.max(1, ...known.map((d) => d.clicks!))
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-[150px] items-end gap-2 border-0 border-b border-solid border-vv-line">
        {data.map((d) => {
          const label = d.clicks === null ? `${monYear(d.month)}: no data` : `${monYear(d.month)}: ${d.clicks.toLocaleString('en-US')} clicks${d.partial ? ' so far' : ''}`
          return (
            <div
              key={d.month}
              tabIndex={0}
              aria-label={label}
              title={label}
              onMouseEnter={() => setHover(d.month)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(d.month)}
              onBlur={() => setHover(null)}
              className={`flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end gap-1 rounded-t-md outline-none focus-visible:ring-2 focus-visible:ring-vv-purple ${hover === d.month ? 'bg-vv-lavender-50' : ''}`}
            >
              <span className="text-[12px] font-semibold leading-none">{d.clicks === null ? '—' : d.clicks.toLocaleString('en-US')}</span>
              {d.clicks !== null && (
                <span
                  className={`w-full max-w-[34px] rounded-t-[4px] bg-vv-chart-clicks ${d.partial ? 'opacity-45' : ''}`}
                  style={{ height: `${Math.max(d.clicks > 0 ? 2 : 0, (d.clicks / max) * 100 * 0.82)}%` }}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        {data.map((d) => (
          <span key={d.month} className="min-w-0 flex-1 text-center text-[11px] leading-tight text-vv-body">
            {mon(d.month)}
            {d.partial && <span className="block text-[10px] text-vv-muted">so far</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
