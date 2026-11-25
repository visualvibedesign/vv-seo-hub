// Settings › Claude usage: what the Claude calls cost, per client, per month and per task, from seo_ai_log
// (migration 0006: one row per call: task, client, model, tokens, estimated cost, ok/error). Read only.
// Costs are estimates worked out at call time; Anthropic's bill is the source of truth.
import type { AiUsage } from '../../src/types/seo.js'
import { db, must, pagedRows } from '../clients/supabase.js'

type LogRow = { client_id: string | null; task: string; input_tokens: number; output_tokens: number; cost_usd: string | number | null; ok: boolean; created_at: string }

const month = (iso: string) => iso.slice(0, 7) // "2026-11" (UTC)
const money = (n: number) => Math.round(n * 10000) / 10000

export async function aiUsage(): Promise<AiUsage> {
  const clients = must(await db().from('seo_clients').select('id, site_id, name'), 'Loading clients') as { id: string; site_id: string; name: string }[]
  const byId = new Map(clients.map((c) => [c.id, c]))
  const thisMonth = month(new Date().toISOString())

  type Sum = { calls: number; failed: number; costUsd: number; inputTokens: number; outputTokens: number }
  const empty = (): Sum => ({ calls: 0, failed: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 })
  const add = (s: Sum, r: LogRow) => {
    s.calls++
    if (!r.ok) s.failed++
    s.costUsd += Number(r.cost_usd ?? 0)
    s.inputTokens += r.input_tokens
    s.outputTokens += r.output_tokens
  }
  const total = empty()
  const months = new Map<string, Sum>()
  const tasks = new Map<string, Sum>()
  const perClient = new Map<string, { all: Sum; month: Sum; lastAt: string }>()

  for await (const r of pagedRows<LogRow>(
    (from, to) => db().from('seo_ai_log').select('client_id, task, input_tokens, output_tokens, cost_usd, ok, created_at').order('created_at', { ascending: false }).order('id').range(from, to),
    'Loading the Claude call log',
  )) {
    add(total, r)
    const m = month(r.created_at)
    if (!months.has(m)) months.set(m, empty())
    add(months.get(m)!, r)
    if (!tasks.has(r.task)) tasks.set(r.task, empty())
    add(tasks.get(r.task)!, r)
    const key = r.client_id ?? 'deleted'
    if (!perClient.has(key)) perClient.set(key, { all: empty(), month: empty(), lastAt: r.created_at })
    const pc = perClient.get(key)!
    add(pc.all, r)
    if (m === thisMonth) add(pc.month, r)
    if (r.created_at > pc.lastAt) pc.lastAt = r.created_at
  }

  const round = (s: Sum) => ({ ...s, costUsd: money(s.costUsd) })
  return {
    thisMonth,
    total: round(total),
    months: [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([m, s]) => ({ month: m, ...round(s) })),
    tasks: [...tasks.entries()].map(([task, s]) => ({ task, ...round(s) })).sort((a, b) => b.costUsd - a.costUsd),
    clients: [...perClient.entries()]
      .map(([id, s]) => {
        const c = byId.get(id)
        return { siteId: c?.site_id ?? null, name: c?.name ?? 'Deleted client', month: round(s.month), all: round(s.all), lastAt: s.lastAt }
      })
      .sort((a, b) => b.all.costUsd - a.all.costUsd),
  }
}
