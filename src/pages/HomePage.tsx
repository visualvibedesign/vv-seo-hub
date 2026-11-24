import { Link } from 'react-router'
import HeaderTools from '../components/layout/HeaderTools'
import { Bone } from '../components/ui/Loading'
import { useClients } from '../hooks/useClients'
import { BTN_LIME, CARD, CARD_TITLE, PILL_PROGRESS, PILL_TODO, siteLabel } from '../lib/ui'

// SEO Hub Overview (/): numbers across all active clients, each client's progress, and the build phases.
const PHASES: { n: string; title: string; text: string }[] = [
  { n: '1', title: 'Clients + keywords', text: 'Keyword database, CSV import, 3×3 matrix, clusters (Sam Days 1–2).' },
  { n: '2', title: 'Baseline + results', text: 'Semrush ranking import, GSC + GA4, GBP numbers, map grid (Days 3 + 10).' },
  { n: '3', title: 'Sitemap + hotspots', text: 'Page list, keyword owner, titles, metas, page briefs (Days 5–6).' },
  { n: '4', title: 'GBP + links', text: 'GBP check and care, citation waves, link database (Days 4, 7, 8–9).' },
  { n: '5', title: 'Sites + automation', text: 'Vibe SEO check-ins, pushes, Slack alerts, ClickUp tasks, Claude drafts.' },
]

export default function HomePage() {
  const q = useClients()
  const clients = (q.data ?? []).filter((c) => c.status !== 'archived')
  const keywords = clients.reduce((n, c) => n + c.counts.keywords, 0)
  const imports = clients.reduce((n, c) => n + c.counts.imports, 0)

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
          <p className="m-0 max-w-[680px] text-[17px] leading-normal text-vv-body">Every SEO client’s strategy, data and (later) automation in one place.</p>
        </div>
        <HeaderTools>
          <Link to="/clients/new" className={BTN_LIME}>
            Add client
          </Link>
        </HeaderTools>
      </header>

      <section aria-label="Key numbers" className="grid grid-cols-3 gap-4 phone:gap-2.5">
        {[
          ['Active clients', clients.length],
          ['Keywords', keywords],
          ['CSV imports', imports],
        ].map(([label, value]) => (
          <div key={label} className={`${CARD} gap-1.5 phone:rounded-[18px] phone:px-3.5 phone:py-3.5`}>
            {q.isPending ? <Bone className="h-11 w-16 rounded-xl" /> : <span className="font-display text-[44px] font-semibold leading-none text-vv-purple-ink phone:text-[30px]">{value}</span>}
            <span className="text-[15px] font-semibold text-vv-body phone:text-[13px] phone:leading-tight">{label}</span>
          </div>
        ))}
      </section>

      <section className={CARD} aria-labelledby="hub-clients">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="hub-clients" className={CARD_TITLE}>
            Clients
          </h2>
          <Link to="/clients" className="text-sm font-bold text-vv-purple-deep no-underline">
            All clients ›
          </Link>
        </div>
        {q.isSuccess && clients.length === 0 && <p className="m-0 text-[15px] text-vv-muted">No clients yet. Add the first one to start.</p>}
        <ul className="m-0 flex list-none flex-col p-0">
          {clients.map((c) => (
            <li key={c.siteId} className="border-b border-solid border-vv-line last:border-0">
              <Link to={`/clients/${c.siteId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-vv-ink no-underline hover:text-vv-purple-deep">
                <span className="min-w-0 flex-[1_1_200px]">
                  <strong className="text-[15px]">{c.name}</strong>
                  <span className="block text-[13px] text-vv-muted">{siteLabel(c.siteUrl)}</span>
                </span>
                <span className={c.counts.keywords ? PILL_PROGRESS : PILL_TODO}>{c.counts.keywords ? `${c.counts.keywords} keywords` : 'Keywords next'}</span>
                <span className={PILL_TODO}>{c.counts.lastImportAt ? `Last import ${new Date(c.counts.lastImportAt).toLocaleDateString()}` : 'No imports yet'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={CARD} aria-labelledby="hub-phases">
        <h2 id="hub-phases" className={CARD_TITLE}>
          Build <em className="font-medium text-vv-purple">phases</em>
        </h2>
        <ol className="m-0 grid list-none grid-cols-5 gap-3 p-0 [@media(min-width:901px)_and_(max-width:1199px)]:grid-cols-2 phone:grid-cols-1">
          {PHASES.map((p) => (
            <li key={p.n} className="flex flex-col gap-1.5 rounded-2xl bg-vv-lavender-50 p-4">
              <span className={`${p.n === '1' ? PILL_PROGRESS : PILL_TODO} self-start`}>{p.n === '1' ? 'Building now' : 'Later'}</span>
              <strong className="font-display text-[17px] font-semibold">
                {p.n} · {p.title}
              </strong>
              <span className="text-[13px] leading-normal text-vv-muted">{p.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
