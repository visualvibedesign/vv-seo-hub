// Phase 2d helpers shared by the Overview cards, the Sources popover and Baseline.
import type { MapGrid } from '../types/seo'

const d12 = (d: string) => new Date(`${d}T12:00:00`)
const short = (d: string) => d12(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/** "Oct 2026" for a whole calendar month, else "Oct 3 – Oct 28". */
export function periodLabel(from: string, to: string): string {
  const a = d12(from)
  const b = d12(to)
  const lastDay = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate()
  if (a.getDate() === 1 && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() && b.getDate() === lastDay) return a.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return `${short(from)} – ${short(to)}`
}

/** Average rank over the points where the business was found, points in the top 3, points found. */
export function gridStats(g: MapGrid) {
  const all = g.ranks.flat()
  const found = all.filter((r): r is number => r !== null)
  return { points: all.length, found: found.length, top3: found.filter((r) => r <= 3).length, avg: found.length ? found.reduce((a, b) => a + b, 0) / found.length : null }
}

