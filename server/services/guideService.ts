// Step-by-step guide progress (redesign step 3). Table: seo_guide_progress (migration 0003).
// Only hand-ticked task keys are stored. Auto tasks (src/lib/guide.ts `auto: true`) are worked out here from
// the client's real data every time, so they never go stale and are never faked.
import { z } from 'zod'
import { GUIDE, GUIDE_STEPS } from '../../src/lib/guide.js'
import type { ClientDetail, GuideState, GuideStatus, GuideStepState } from '../../src/types/seo.js'
import { db, must } from '../clients/supabase.js'
import { getClient, guideSummaryOf } from './clientService.js'

/** A problem the person can fix (400). */
export class GuideInputError extends Error {}

type ProgressRow = {
  client_id: string
  step: number
  status: GuideStatus
  tasks_done: string[]
  started_at: string | null
  done_at: string | null
}

async function clientId(siteId: string): Promise<string> {
  if (!/^[0-9a-f]{32}$/.test(siteId)) throw new GuideInputError('That client doesn’t exist.')
  const row = must(await db().from('seo_clients').select('id').eq('site_id', siteId).maybeSingle(), 'Loading the client') as { id: string } | null
  if (!row) throw new GuideInputError('That client doesn’t exist.')
  return row.id
}

/** Which auto tasks the data says are done, per step. */
async function autoDone(c: ClientDetail, id: string): Promise<Map<number, string[]>> {
  const reports = must(await db().from('seo_imports').select('source, report').eq('client_id', id), 'Loading imports') as { source: string; report: string }[]
  const cat = (code: string) => c.categories.find((k) => k.code === code)
  const named = (code: string) => !!cat(code)?.name.trim()
  const a1 = c.areas.find((a) => a.code === 'A1')
  const facts: Record<string, boolean> = {
    '0.services': ['Home', 'S1', 'S2', 'S3'].every(named) && ['S1', 'S2', 'S3'].every((k) => (cat(k)?.services.length ?? 0) > 0),
    '0.areas': a1?.status === 'active' && !!a1.name?.trim(),
    '0.kickoff': !!(c.success12mo?.trim() && c.usp?.trim() && c.idealClient?.trim()),
    '0.accounts': c.accounts.length > 0 && c.counts.accountsPending === 0,
    '1.kp': reports.some((r) => r.source === 'kp'),
    '1.semrush': reports.some((r) => r.report === 'keyword_magic'),
    '1.import': c.counts.keywords > 0,
    '1.roles': c.counts.keywords > 0 && c.counts.needsRole === 0,
    '2.tracking': c.counts.tracked > 0,
  }
  const out = new Map<number, string[]>()
  for (const s of GUIDE) out.set(s.n, s.tasks.filter((t) => t.auto && facts[`${s.n}.${t.key}`]).map((t) => t.key))
  return out
}

export async function getGuide(siteId: string): Promise<GuideState> {
  const c = await getClient(siteId)
  if (!c) throw new GuideInputError('That client doesn’t exist.')
  const id = await clientId(siteId)
  const [rows, auto] = await Promise.all([
    db().from('seo_guide_progress').select('client_id, step, status, tasks_done, started_at, done_at').eq('client_id', id),
    autoDone(c, id),
  ])
  const progress = must(rows, 'Loading guide progress') as ProgressRow[]
  const steps: GuideStepState[] = GUIDE.map((s) => {
    const r = progress.find((p) => p.step === s.n)
    const handKeys = new Set(s.tasks.filter((t) => !t.auto).map((t) => t.key))
    return {
      step: s.n,
      status: r?.status ?? 'not_started',
      tasksDone: (r?.tasks_done ?? []).filter((k) => handKeys.has(k)),
      autoDone: auto.get(s.n) ?? [],
      startedAt: r?.started_at ?? null,
      doneAt: r?.done_at ?? null,
    }
  })
  const summary = guideSummaryOf(steps.filter((s) => s.status === 'done').map((s) => s.step))
  return { current: summary.current, doneCount: summary.doneCount, steps }
}

async function currentRow(id: string, step: number): Promise<ProgressRow | null> {
  return must(
    await db().from('seo_guide_progress').select('client_id, step, status, tasks_done, started_at, done_at').eq('client_id', id).eq('step', step).maybeSingle(),
    'Loading guide progress',
  ) as ProgressRow | null
}

const TaskSchema = z.object({
  siteId: z.string(),
  step: z.number().int().min(0).max(GUIDE_STEPS - 1),
  task: z.string().min(1).max(40),
  done: z.boolean(),
})

/** Tick / untick one hand task. Touching a step that wasn't started starts it. */
export async function setTask(raw: unknown): Promise<GuideState> {
  const p = TaskSchema.safeParse(raw)
  if (!p.success) throw new GuideInputError('That task isn’t right.')
  const { siteId, step, task, done } = p.data
  const def = GUIDE[step].tasks.find((t) => t.key === task)
  if (!def) throw new GuideInputError('That task isn’t in this step.')
  if (def.auto) throw new GuideInputError('This task ticks itself from the client’s data.')
  const id = await clientId(siteId)
  const row = await currentRow(id, step)
  const keys = new Set(row?.tasks_done ?? [])
  if (done) keys.add(task)
  else keys.delete(task)
  const now = new Date().toISOString()
  must(
    await db()
      .from('seo_guide_progress')
      .upsert(
        {
          client_id: id,
          step,
          tasks_done: [...keys],
          status: !row || row.status === 'not_started' ? 'in_progress' : row.status,
          started_at: row?.started_at ?? now,
          done_at: row?.done_at ?? null,
        },
        { onConflict: 'client_id,step' },
      ),
    'Saving the task',
  )
  return getGuide(siteId)
}

const StepSchema = z.object({
  siteId: z.string(),
  step: z.number().int().min(0).max(GUIDE_STEPS - 1),
  done: z.boolean(),
})

/** Mark a step done, or reopen it (back to in progress). Angel decides: open tasks don't block it. */
export async function setStep(raw: unknown): Promise<GuideState> {
  const p = StepSchema.safeParse(raw)
  if (!p.success) throw new GuideInputError('That step isn’t right.')
  const { siteId, step, done } = p.data
  const id = await clientId(siteId)
  const row = await currentRow(id, step)
  const now = new Date().toISOString()
  must(
    await db()
      .from('seo_guide_progress')
      .upsert(
        {
          client_id: id,
          step,
          tasks_done: row?.tasks_done ?? [],
          status: done ? 'done' : 'in_progress',
          started_at: row?.started_at ?? now,
          done_at: done ? now : null,
        },
        { onConflict: 'client_id,step' },
      ),
    done ? 'Marking the step done' : 'Reopening the step',
  )
  return getGuide(siteId)
}
