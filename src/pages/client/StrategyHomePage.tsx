import { Link } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import { Spinner } from '../../components/ui/Loading'
import { useGuide } from '../../hooks/useGuide'
import { clientPath, strategyPath } from '../../lib/clientSetup'
import { GUIDE, GUIDE_STEPS, isOverviewStep, overviewLine, stepDay, strategyCurrent } from '../../lib/guide'
import { BTN_GHOST, BTN_LIME, CARD, CARD_TITLE, PILL, PILL_TODO, splitAccent } from '../../lib/ui'
import type { ClientDetail, GuideStatus } from '../../types/seo'

// Strategy Builder home (/clients/{site id}/strategy): the work area. Sam's days for this client (Day 3 and Day 10
// live in the client Overview: shown here as thin lines in Sam's order) and the services + areas set on Day 1.

export default function StrategyHomePage() {
  const c = useClientContext()
  const [lead, accent] = splitAccent(c.name)
  const done = new Set(c.guide.doneSteps)
  const current = strategyCurrent((n) => done.has(n))
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-2.5">
          <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-vv-purple-deep">Strategy Builder</span>
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            {lead}
            <em className="font-medium text-vv-purple">{accent}.</em>
          </h1>
        </div>
        <HeaderTools>
          <Link to={clientPath(c.siteId)} className={BTN_GHOST}>
            ← Client overview
          </Link>
          <Link to={`${strategyPath(c.siteId, 'guide')}${current < GUIDE_STEPS ? `?step=${current}` : ''}`} className={BTN_LIME}>
            {current < GUIDE_STEPS ? `Continue ${stepDay(current)} in the guide ›` : 'Open the guide ›'}
          </Link>
        </HeaderTools>
      </header>

      <div className="grid grid-cols-[minmax(0,13fr)_minmax(0,8fr)] items-start gap-6 [@media(max-width:1100px)]:grid-cols-1">
        <StepsCard client={c} />
        <TargetsCard client={c} />
      </div>
    </>
  )
}

/** Day 3 / Day 10: a thin line in Sam's order, pointing to where they live (the client Overview). */
function OverviewLine({ siteId, n }: { siteId: string; n: number }) {
  const s = GUIDE[n]
  return (
    <li className="border-0 border-t border-solid border-vv-line first:border-t-0">
      <Link to={clientPath(siteId, s.open.path)} className="flex min-h-10 items-center gap-2 py-1.5 pl-[54px] text-[14px] text-vv-muted no-underline hover:text-vv-purple-deep phone:pl-[50px]">
        {overviewLine(s.n)} <span aria-hidden="true">→</span> in Overview
      </Link>
    </li>
  )
}

const STATUS_PILL: Record<GuideStatus, { cls: string; text: string }> = {
  done: { cls: `${PILL} bg-vv-lavender-100 text-vv-purple-ink`, text: 'Done' },
  in_progress: { cls: `${PILL} bg-vv-green-100 text-vv-green-ink`, text: 'In progress' },
  not_started: { cls: PILL_TODO, text: 'Not started' },
}

function StepsCard({ client: c }: { client: ClientDetail }) {
  const g = useGuide(c.siteId)
  const done = new Set(c.guide.doneSteps)
  const current = strategyCurrent((n) => done.has(n))
  return (
    <section className={CARD} aria-labelledby="ov-steps">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ov-steps" className={CARD_TITLE}>
          Sam’s 10 days
        </h2>
        <Link to={strategyPath(c.siteId, 'guide')} className="text-[15px] font-semibold text-vv-purple-deep underline">
          {current < GUIDE_STEPS ? `${stepDay(current)} is next` : 'All Strategy days done'} · open the guide ›
        </Link>
      </div>
      {g.isError && <p className="m-0 text-[14px] font-semibold text-vv-red">Couldn’t load the guide progress.</p>}
      <ol className="m-0 flex list-none flex-col p-0">
        {GUIDE.map((s) => {
          if (isOverviewStep(s.n)) return <OverviewLine key={s.n} siteId={c.siteId} n={s.n} />
          const st = g.data?.steps[s.n]
          const status: GuideStatus = st?.status ?? 'not_started'
          const done = status === 'done'
          const here = s.n === current
          const blurb = s.n === 1 && c.counts.keywords ? `${c.counts.keywords.toLocaleString('en-US')} ${s.overview.blurb}` : s.overview.blurb
          return (
            <li key={s.n} className="border-0 border-t border-solid border-vv-line first:border-t-0">
              <Link to={`${strategyPath(c.siteId, 'guide')}?step=${s.n}`} className="flex min-h-[64px] items-center gap-3.5 py-2.5 text-vv-ink no-underline hover:bg-vv-lavender-50 phone:gap-3">
                <span
                  aria-hidden="true"
                  className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[15px] font-bold ${
                    done ? 'bg-vv-purple text-white' : here ? 'bg-vv-green text-vv-on-green' : 'bg-vv-lavender-100 text-vv-body'
                  }`}
                >
                  {s.n + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[16px] font-semibold">{s.overview.title}</span>
                  <span className="truncate text-[14px] text-vv-body phone:whitespace-normal phone:text-[13px]">
                    {s.day} · {blurb}
                  </span>
                </span>
                {g.isPending ? <Spinner /> : <span className={STATUS_PILL[status].cls}>{STATUS_PILL[status].text}</span>}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function TargetsCard({ client: c }: { client: ClientDetail }) {
  const shown = c.categories.filter((k) => k.code !== 'FAQ')
  return (
    <section className={CARD} aria-labelledby="ov-targets">
      <h2 id="ov-targets" className={CARD_TITLE}>
        Services &amp; areas
      </h2>
      <dl className="m-0 flex flex-col gap-3.5">
        {shown.map((k) => (
          <div key={k.code} className="grid grid-cols-[56px_minmax(0,1fr)] gap-2">
            <dt className="pt-0.5 text-[14px] font-bold text-vv-purple-deep">{k.code}</dt>
            <dd className="m-0 flex min-w-0 flex-col">
              <span className="text-[16px] font-semibold">{k.name || <span className="text-vv-muted">No name yet</span>}</span>
              <span className="text-[14px] text-vv-body">{serviceLine(k.services.map((s) => s.name)) || (k.code === 'Home' ? 'No main service yet: add it in Client setup › Home' : 'No services yet')}</span>
            </dd>
          </div>
        ))}
      </dl>
      <ul className="m-0 flex list-none flex-wrap gap-2 border-0 border-t border-solid border-vv-line p-0 pt-3.5">
        {c.areas.map((a) => (
          <li key={a.code} className={`${PILL} ${a.status === 'active' ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-st-todo text-vv-st-todo-ink'}`}>
            {a.code} {a.status === 'active' ? [a.name, a.state].filter(Boolean).join(', ') : 'N/A'}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** "Service A, Service B, Service C + 7 more" (first 3 names). */
function serviceLine(names: string[]): string {
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} + ${names.length - 3} more` : names.join(', ')
}
