import { Link } from 'react-router'
import HeaderTools from '../components/layout/HeaderTools'
import { Bone } from '../components/ui/Loading'
import { useClients } from '../hooks/useClients'
import { BTN_LIME, CARD, PILL_TODO, PILL_WAITING, siteLabel } from '../lib/ui'
import type { ClientSummary } from '../types/seo'

// Clients list (/): every SEO client as a card, plus Add client.
export default function ClientsPage() {
  const q = useClients()
  const clients = q.data ?? []
  const active = clients.filter((c) => c.status !== 'archived')

  return (
    <>
      <span className="text-[15px] text-vv-muted">
        SEO Hub <span aria-hidden="true">›</span> <strong className="text-vv-ink">All clients</strong>
      </span>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            SEO <em className="font-medium text-vv-purple">clients</em>
          </h1>
          <p className="m-0 max-w-[680px] text-[17px] leading-normal text-vv-body">
            One workspace per client, following Sam’s 10-day process: setup, keywords, baseline, GBP, pages and links.
          </p>
        </div>
        <HeaderTools>
          <Link to="/clients/new" className={BTN_LIME}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add client
          </Link>
        </HeaderTools>
      </header>

      {q.isPending && (
        <div aria-busy="true" className="grid grid-cols-3 gap-4 [@media(min-width:901px)_and_(max-width:1199px)]:grid-cols-2 phone:grid-cols-1">
          <span role="status" className="sr-only">
            Loading clients
          </span>
          {[0, 1, 2].map((i) => (
            <div key={i} className={CARD}>
              <Bone className="h-6 w-2/3 rounded-xl" />
              <Bone className="h-3.5 w-1/2" />
              <Bone className="h-3.5 w-4/5" />
            </div>
          ))}
        </div>
      )}
      {q.isError && <p className="m-0 text-[15px] font-semibold text-vv-red">Couldn’t load the clients. Try again in a moment.</p>}

      {q.isSuccess && active.length === 0 && (
        <div className={`${CARD} items-start`}>
          <h2 className="m-0 font-display text-[22px] font-semibold">No clients yet</h2>
          <p className="m-0 text-[15px] text-vv-body">Add the first one: its site, top 3 services and areas, and the account checklist.</p>
          <Link to="/clients/new" className={BTN_LIME}>
            Add client
          </Link>
        </div>
      )}

      {active.length > 0 && (
        <ul aria-label="Clients" className="m-0 grid list-none grid-cols-3 gap-4 p-0 [@media(min-width:901px)_and_(max-width:1199px)]:grid-cols-2 phone:grid-cols-1">
          {active.map((c) => (
            <li key={c.siteId}>
              <ClientCard client={c} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function ClientCard({ client: c }: { client: ClientSummary }) {
  const services = c.categories.filter((k) => k.code === 'S1' || k.code === 'S2' || k.code === 'S3')
  return (
    <Link
      to={`/clients/${c.siteId}`}
      className={`${CARD} h-full text-vv-ink no-underline transition-transform hover:-translate-y-0.5 hover:border-vv-lavender motion-reduce:transition-none`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="m-0 font-display text-[24px] font-semibold leading-tight">{c.name}</h2>
          <span className="truncate text-sm text-vv-muted">
            {siteLabel(c.siteUrl)}
            {c.city ? ` · ${c.city}${c.state ? `, ${c.state}` : ''}` : ''}
          </span>
        </div>
        {c.status === 'paused' && <span className={PILL_WAITING}>Paused</span>}
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-vv-body">
        {services.map((s) => (
          <li key={s.code}>
            <strong className="text-vv-purple-deep">{s.code}</strong> {s.name}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <span className={PILL_TODO}>{c.counts.keywords} keywords</span>
        <span className={PILL_TODO}>{c.counts.pages} pages</span>
        <span className={PILL_TODO}>
          {c.counts.lastImportAt ? `Last import ${new Date(c.counts.lastImportAt).toLocaleDateString()}` : 'No imports yet'}
        </span>
      </div>
    </Link>
  )
}
