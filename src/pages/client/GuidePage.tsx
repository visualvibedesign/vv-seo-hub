import { Link, useSearchParams } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import { Bone, Spinner } from '../../components/ui/Loading'
import { useGuide, useGuideChange } from '../../hooks/useGuide'
import { ApiError } from '../../lib/api'
import { GUIDE, GUIDE_STEPS, type GuideStep } from '../../lib/guide'
import { BTN_GHOST, BTN_LIME, CARD, PILL, PILL_DONE } from '../../lib/ui'
import type { GuideState, GuideStepState } from '../../types/seo'

// Step-by-step guide (/clients/{site id}/guide), design docs/design/Guide.png: Sam's 10 days as 9 steps,
// tick the tasks, then mark the step done. Some tasks tick themselves from the client's data (never stored).

export default function GuidePage() {
  const c = useClientContext()
  const q = useGuide(c.siteId)
  const [params, setParams] = useSearchParams()

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Step by <em className="font-medium text-vv-purple">step.</em>
          </h1>
          <p className="m-0 max-w-[720px] text-[17px] leading-normal text-vv-body">
            Sam’s 10-Day Rank Yourself process for this client. Tick the tasks, then move to the next step.
          </p>
        </div>
        <div className="flex items-end gap-4 phone:w-full">
          {q.data && <Progress guide={q.data} />}
          <HeaderTools />
        </div>
      </header>

      {q.isPending && (
        <div aria-busy="true" className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 phone:grid-cols-1">
          <span role="status" className="sr-only">
            Loading the guide
          </span>
          <Bone className="h-[420px] rounded-[22px]" />
          <Bone className="h-[420px] rounded-[22px]" />
        </div>
      )}
      {q.isError && (
        <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">
          Couldn’t load the guide. Try again in a moment.
        </p>
      )}
      {q.data && (
        <Guide
          guide={q.data}
          siteId={c.siteId}
          selected={pick(params.get('step'), q.data)}
          onSelect={(n) => {
            setParams({ step: String(n) }, { replace: true })
            // Narrow screens show the open step above the list: bring it into view.
            if (window.matchMedia('(max-width: 1100px)').matches) document.getElementById('step-h')?.closest('section')?.scrollIntoView({ block: 'start' })
          }}
        />
      )}
    </>
  )
}

/** ?step=N, else the current step (the last one once everything is done). */
function pick(raw: string | null, g: GuideState): number {
  const n = raw === null ? NaN : Number(raw)
  if (Number.isInteger(n) && n >= 0 && n < GUIDE_STEPS) return n
  return Math.min(g.current, GUIDE_STEPS - 1)
}

function Progress({ guide: g }: { guide: GuideState }) {
  return (
    <div className="flex w-[260px] flex-col gap-2 phone:w-auto phone:flex-1">
      <span className="text-[15px] font-bold text-vv-ink">
        {g.doneCount} of {GUIDE_STEPS} steps done
      </span>
      <div
        role="progressbar"
        aria-label="Steps done"
        aria-valuemin={0}
        aria-valuemax={GUIDE_STEPS}
        aria-valuenow={g.doneCount}
        className="h-2.5 overflow-hidden rounded-full bg-vv-lavender-100 dark:bg-vv-field-line"
      >
        <div className="h-full rounded-full bg-vv-purple transition-[width] motion-reduce:transition-none" style={{ width: `${(g.doneCount / GUIDE_STEPS) * 100}%` }} />
      </div>
    </div>
  )
}

function Guide({ guide: g, siteId, selected, onSelect }: { guide: GuideState; siteId: string; selected: number; onSelect: (n: number) => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-6 [@media(max-width:1100px)]:grid-cols-1">
      <nav aria-label="Guide steps" className={`${CARD} !gap-1 !p-3.5 [@media(max-width:1100px)]:order-last`}>
        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {GUIDE.map((s) => {
            const st = g.steps[s.n]
            const on = s.n === selected
            const done = st.status === 'done'
            const here = s.n === g.current
            return (
              <li key={s.n}>
                <button
                  type="button"
                  onClick={() => onSelect(s.n)}
                  aria-current={on ? 'step' : undefined}
                  className={`flex min-h-[60px] w-full items-center gap-3.5 rounded-[16px] border-0 px-3 py-2 text-left font-body ${on ? 'bg-vv-lavender-100' : 'bg-transparent hover:bg-vv-lavender-50'}`}
                >
                  <StepBadge n={s.n} done={done} here={here} />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[16px] font-semibold text-vv-ink">{s.title}</span>
                    <span className="text-[13px] text-vv-body">
                      {s.day}
                      {st.status === 'in_progress' && !done ? ' · in progress' : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <StepDetail key={selected} step={GUIDE[selected]} state={g.steps[selected]} here={selected === g.current} siteId={siteId} onNext={(n) => onSelect(n)} />
    </div>
  )
}

function StepBadge({ n, done, here }: { n: number; done: boolean; here: boolean }) {
  const base = 'inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[15px] font-bold'
  if (done)
    return (
      <span className={`${base} bg-vv-purple text-white`} aria-label="Done">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12 5 5 9-10" />
        </svg>
      </span>
    )
  return <span className={`${base} ${here ? 'bg-vv-green text-vv-on-green' : 'bg-vv-lavender-100 text-vv-body'}`}>{n + 1}</span>
}

function StepDetail({ step: s, state: st, here, siteId, onNext }: { step: GuideStep; state: GuideStepState; here: boolean; siteId: string; onNext: (n: number) => void }) {
  const change = useGuideChange(siteId)
  const isDone = (key: string, auto?: boolean) => (auto ? st.autoDone.includes(key) : st.tasksDone.includes(key))
  const ticked = s.tasks.filter((t) => isDone(t.key, t.auto)).length
  const done = st.status === 'done'
  const error = change.error ? (change.error instanceof ApiError && change.error.detail ? change.error.detail : 'Couldn’t save. Try again.') : ''
  const openPath = s.open.path === 'edit' ? `/clients/${siteId}/edit` : `/clients/${siteId}/${s.open.path}`

  const markDone = () =>
    change.mutate(
      { kind: 'step', step: s.n, done: true },
      { onSuccess: ({ guide }) => guide.current < GUIDE_STEPS && guide.current !== s.n && onNext(guide.current) },
    )

  return (
    <section className={`${CARD} !gap-5 !p-7 phone:!p-5`} aria-labelledby="step-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`${PILL} bg-vv-lavender-100 text-vv-purple-ink`}>{s.day}</span>
        {done ? (
          <span className={PILL_DONE}>Done{st.doneAt ? ` · ${new Date(st.doneAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
        ) : here ? (
          <span className={`${PILL} bg-vv-green-100 text-vv-green-ink`}>You are here</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <h2 id="step-h" className="m-0 font-display text-[30px] font-semibold leading-tight phone:text-[26px]">
          {s.title}
        </h2>
        <p className="m-0 text-[16px] leading-normal text-vv-body">{s.why}</p>
      </div>

      <div className="flex flex-col">
        <h3 className="m-0 border-0 border-b border-solid border-vv-line pb-2 text-[13px] font-bold uppercase tracking-[0.12em] text-vv-body">
          Do this ({ticked} / {s.tasks.length})
        </h3>
        <ul className="m-0 flex list-none flex-col p-0">
          {s.tasks.map((t) => {
            const on = isDone(t.key, t.auto)
            return (
              <li key={t.key} className="border-0 border-b border-solid border-vv-line last:border-b-0">
                <label className={`flex min-h-[52px] items-start gap-3.5 py-3 ${t.auto ? 'cursor-default' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    className="mt-0.5 h-[22px] w-[22px] flex-none accent-vv-purple"
                    checked={on}
                    disabled={t.auto || change.isPending}
                    onChange={(e) => change.mutate({ kind: 'task', step: s.n, task: t.key, done: e.target.checked })}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className={`text-[16px] ${on ? 'text-vv-muted line-through' : 'text-vv-ink'}`}>
                      {t.label}
                      {t.auto && <span className={`${PILL} ml-2 !px-2 !py-0.5 align-middle !text-[11px] bg-vv-lavender-100 text-vv-purple-ink no-underline`}>Auto</span>}
                    </span>
                    {t.auto && !on && t.hint && <span className="text-[13px] text-vv-muted">{t.hint}</span>}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4 phone:grid-cols-1">
        <div className="flex flex-col gap-2 rounded-[18px] border border-solid border-vv-line bg-vv-lavender-50 p-4">
          <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-vv-body">Tools</span>
          <span className="text-[15px] leading-relaxed text-vv-ink">{s.tools}</span>
        </div>
        <div className="flex flex-col gap-2 rounded-[18px] border border-solid border-vv-line bg-vv-green-100 p-4">
          <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-vv-green-ink">Tip</span>
          <span className="text-[15px] leading-relaxed text-vv-green-ink">{s.tip}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-2xl bg-vv-red-100 px-4 py-3 text-[15px] font-semibold text-vv-red">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link to={openPath} className={BTN_GHOST}>
          {s.open.label} ›
        </Link>
        {s.videos.map((v) => (
          <a key={v.url} href={v.url} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>
            {s.videos.length > 1 ? `Sam’s ${v.label} video` : 'Watch Sam’s video'}
          </a>
        ))}
        <span className="ml-auto phone:ml-0 phone:w-full">
          {done ? (
            <button type="button" className={`${BTN_GHOST} phone:w-full`} disabled={change.isPending} onClick={() => change.mutate({ kind: 'step', step: s.n, done: false })}>
              {change.isPending ? <Spinner /> : null}
              Reopen step
            </button>
          ) : (
            <button type="button" className={`${BTN_LIME} phone:w-full`} disabled={change.isPending} onClick={markDone}>
              {change.isPending ? <Spinner /> : null}
              Mark step done ({ticked}/{s.tasks.length}) ›
            </button>
          )}
        </span>
      </div>
    </section>
  )
}
