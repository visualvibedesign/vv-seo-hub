// Placeholder home page (project setup). Shows the HQ look: Fraunces heading with a purple
// italic word, white cards, lime pill button, status pills. Real screens start in phase 1.

const CARD =
  'box-border flex min-w-0 flex-col gap-3 rounded-[22px] border border-vv-line bg-vv-surface px-6 py-[22px] shadow-[0_14px_30px_-24px_rgba(91,63,208,0.45)] phone:p-[18px] dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,.7)]'

const PHASES: { n: string; title: string; text: string; status: 'next' | 'later' }[] = [
  { n: '1', title: 'Clients + keywords', text: 'Keyword database, CSV import, 3×3 matrix, clusters (Sam Days 1–2).', status: 'next' },
  { n: '2', title: 'Baseline + results', text: 'Semrush ranking import, GSC + GA4, GBP numbers, map grid (Days 3 + 10).', status: 'later' },
  { n: '3', title: 'Sitemap + hotspots', text: 'Page list, keyword owner, titles, metas, page briefs (Days 5–6).', status: 'later' },
  { n: '4', title: 'GBP + links', text: 'GBP check and care, citation waves, link database (Days 4, 7, 8–9).', status: 'later' },
  { n: '5', title: 'Sites + automation', text: 'Vibe SEO check-ins, pushes, Slack alerts, ClickUp tasks, Claude drafts.', status: 'later' },
]

export default function HomePage() {
  return (
    <>
      <span className="text-[15px] text-vv-muted">
        SEO Hub <span aria-hidden="true">›</span> <strong className="text-vv-ink">Overview</strong>
      </span>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            SEO <em className="font-medium text-vv-purple">Hub</em>
          </h1>
          <p className="m-0 max-w-[680px] text-[17px] leading-normal text-vv-body">
            Every SEO client’s strategy, data and automation in one place. Project set up; the first screens come in phase 1.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex min-h-[46px] items-center gap-2 rounded-full border-0 bg-vv-green px-[22px] text-[15px] font-bold text-vv-on-green disabled:cursor-not-allowed disabled:opacity-70"
        >
          Add a client (phase 1)
        </button>
      </header>

      <section aria-label="Build phases" className="grid grid-cols-3 gap-4 [@media(max-width:1199px)]:grid-cols-2 phone:grid-cols-1">
        {PHASES.map((p) => (
          <article key={p.n} className={CARD}>
            <div className="flex items-center justify-between gap-3">
              <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-vv-lavender-100 font-display text-base font-semibold text-vv-purple-deep">
                {p.n}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  p.status === 'next' ? 'bg-vv-st-review text-vv-st-review-ink' : 'bg-vv-st-todo text-vv-st-todo-ink'
                }`}
              >
                {p.status === 'next' ? 'Up next' : 'Later'}
              </span>
            </div>
            <h2 className="m-0 font-display text-[22px] font-semibold leading-tight">Phase {p.n} · {p.title}</h2>
            <p className="m-0 text-[15px] leading-normal text-vv-body">{p.text}</p>
          </article>
        ))}
      </section>
    </>
  )
}
