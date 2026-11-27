// Phase 2f · Report notes: the numbers check (CLAUDE.md: Claude never invents facts or changes exported numbers).
// Every number written in the notes must come from the report: a value (baseline or this month, as written or
// rounded), a change between them (difference or %), a date in the report, or a small count (1–10, "30 days").
// Anything else is FLAGGED for Angel, never removed. Shared by the server (when Claude drafts) and the Results page
// (live while Angel edits). Only types + agencyTime (no imports of its own), so both sides can use it.
import type { ReportAction, ReportNumbers } from '../types/seo.js'
import { agencyDay } from './agencyTime.js'

/** Every number the notes may mention. */
export function allowedNumbers(n: ReportNumbers, actions: Pick<ReportAction, 'due' | 'body'>[] = []): number[] {
  const out = new Set<number>()
  const add = (v: number | null | undefined) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return
    const a = Math.abs(v)
    for (const x of [a, Math.round(a), Math.round(a * 10) / 10, Math.round(a * 100) / 100]) out.add(x)
  }
  const pctOf = (v: number | null | undefined) => (v === null || v === undefined ? null : v * 100)
  const dates = (d: string | null | undefined) => {
    if (!d) return
    const [y, m, day] = d.split('-').map(Number)
    add(y)
    add(m)
    add(day)
  }
  for (let i = 1; i <= 10; i++) out.add(i)
  for (const x of [28, 30, 100]) out.add(x) // 28-day window, "next 30 days", "top 100"
  const all = [...n.baseline.snapshots, ...n.snapshots]
  for (const s of all) {
    dates(s.from)
    dates(s.to)
    for (const [k, v] of Object.entries(s.values)) {
      add(v)
      if (k === 'ctr') add(pctOf(v))
      if (k === 'avg_engagement_sec' && v !== null) {
        add(v / 60)
        add(Math.floor(v / 60))
        add(Math.round(v % 60))
      }
    }
  }
  // Changes: month vs baseline for every metric both have (difference, % change, CTR in points).
  for (const m of n.snapshots) {
    const b = n.baseline.snapshots.find((x) => x.source === m.source)
    if (!b) continue
    for (const [k, now] of Object.entries(m.values)) {
      const base = b.values[k]
      if (now === null || now === undefined || base === null || base === undefined) continue
      add(now - base)
      if (base !== 0) add(((now - base) / base) * 100)
      if (k === 'ctr') add((now - base) * 100)
    }
  }
  dates(n.month)
  dates(agencyDay(n.baseline.savedAt))
  // The next actions are given to Claude too: their due dates and any number written in them ("480/mo", "4 → 7").
  for (const a of actions) {
    dates(a.due)
    for (const raw of a.body.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) add(Number(raw.replace(/,/g, '')))
  }
  return [...out]
}

/** Numbers written in the text that aren't in the report (as written, e.g. "4,212" or "12.5%"). */
export function unmatchedNumbers(text: string, allowed: number[]): string[] {
  const found = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []
  const bad = new Set<string>()
  for (const raw of found) {
    const v = Number(raw.replace(/,/g, ''))
    if (!Number.isFinite(v)) continue
    const decimals = raw.includes('.') ? raw.split('.')[1].length : 0
    const tol = decimals === 0 ? 0.5 : 0.5 * 10 ** -decimals
    if (!allowed.some((a) => Math.abs(a - v) <= tol + 1e-9)) bad.add(raw)
  }
  return [...bad]
}
