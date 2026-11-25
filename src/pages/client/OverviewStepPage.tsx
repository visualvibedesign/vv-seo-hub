import { useLocation } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import ComingCard from '../../components/ui/ComingCard'
import { Bone } from '../../components/ui/Loading'
import { useGuide } from '../../hooks/useGuide'
import { ALL_SECTIONS } from '../../lib/clientSetup'
import { GUIDE } from '../../lib/guide'
import { StepDetail } from './GuidePage'

// Client Overview › Baseline (/clients/{site id}/baseline, Sam's Day 3) and Results (/results, Day 10 + monthly).
// They live in the Overview, not the Strategy Builder (Angel, Nov 26). Their checklist is the guide step's (same saved
// progress: step 2 / step 8). The uploads, numbers and reports come in phase 2.

const PAGES = {
  baseline: { step: 2, lead: 'The ', accent: 'baseline.', blurb: 'Day 3: record where the client starts, so Day 10 and every monthly report compare like with like.' },
  results: { step: 8, lead: 'What ', accent: 'changed.', blurb: 'Day 10 + monthly: results vs the baseline, the client update and the next actions.' },
} as const

export default function OverviewStepPage() {
  const c = useClientContext()
  const { pathname } = useLocation()
  const key = pathname.replace(/\/+$/, '').endsWith('/results') ? 'results' : 'baseline'
  const p = PAGES[key]
  const q = useGuide(c.siteId)
  const section = ALL_SECTIONS.find((s) => s.key === key)!
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            {p.lead}
            <em className="font-medium text-vv-purple">{p.accent}</em>
          </h1>
          <p className="m-0 max-w-[720px] text-[17px] leading-normal text-vv-body">{p.blurb}</p>
        </div>
        <HeaderTools />
      </header>
      <ComingCard section={section} />
      {q.isPending && <Bone className="h-[420px] w-full rounded-[22px]" />}
      {q.isError && (
        <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">
          Couldn’t load the checklist. Try again in a moment.
        </p>
      )}
      {q.data && <StepDetail step={GUIDE[p.step]} state={q.data.steps[p.step]} here={false} siteId={c.siteId} showOpen={false} />}
    </>
  )
}
