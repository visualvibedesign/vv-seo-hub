import { Link } from 'react-router'
import HeaderTools from '../components/layout/HeaderTools'
import { Bone } from '../components/ui/Loading'
import StatCard from '../components/ui/StatCard'
import { useClients } from '../hooks/useClients'
import { useTemplates } from '../hooks/useTemplates'
import { useIndustryLabel } from '../hooks/useIndustries'
import { GUIDE, GUIDE_STEPS, stepLabel } from '../lib/guide'
import { needsYouItems, type NeedsYouItem } from '../lib/needsYou'
import { BTN_GHOST, BTN_LIME, CARD, CARD_TITLE, PILL, siteLabel } from '../lib/ui'
import type { ClientSummary } from '../types/seo'

// Hub Overview (/), design docs/design/Main.png: every SEO client, where they are in Sam's 10 days, and what
// needs you next. Not faked: the SEO overview table waits for the Vibe SEO plugin ("Connect the site
// (coming soon)"), the Templates number counts the generic templates (industry versions are copies of them). Login is the shared team password,
// so there's no person's name to greet.

const RECENT = 3

function greeting(d = new Date()): string {
  const h = d.getHours()
  return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,'
}

export default function HomePage() {
  const q = useClients()
  const templates = useTemplates()
  const all = q.data ?? []
  const active = all.filter((c) => c.status === 'active')
  const keywords = active.reduce((n, c) => n + c.counts.keywords, 0)
  const tracked = active.reduce((n, c) => n + c.counts.tracked, 0)
  const recent = [...all].filter((c) => c.status !== 'archived').sort((a, b) => b.counts.lastWorkedAt.localeCompare(a.counts.lastWorkedAt)).slice(0, RECENT)
  const needs = active
    .flatMap((c) => needsYouItems(c).map((item) => ({ item, client: c })))
    .sort((a, b) => a.item.rank - b.item.rank || b.client.counts.lastWorkedAt.localeCompare(a.client.counts.lastWorkedAt))
    .slice(0, 6)

  return (
    <>
      <span className="text-[15px] text-vv-muted">
        SEO Hub <span aria-hidden="true">›</span> <strong className="text-vv-ink">Overview</strong>
      </span>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            {greeting()} <em className="font-medium text-vv-purple">team.</em>
          </h1>
          <p className="m-0 max-w-[720px] text-[17px] leading-normal text-vv-body">Every SEO client, where they are in Sam’s 10 days, and what needs you next.</p>
        </div>
        <HeaderTools>
          <Link to="/templates" className={BTN_GHOST}>
            Templates
          </Link>
          <Link to="/clients/new" className={BTN_LIME}>
            + Add client
          </Link>
        </HeaderTools>
      </header>

      {q.isError && (
        <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">
          Couldn’t load the clients. Try again in a moment.
        </p>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-4 gap-4 [@media(max-width:1199px)]:grid-cols-2 phone:gap-2.5">
        {q.isPending ? (
          [0, 1, 2, 3].map((i) => <Bone key={i} className="h-[150px] rounded-[22px]" />)
        ) : (
          <>
            <StatCard label="Active clients" value={active.length} caption={active.length === 1 ? active[0].name : active.length ? 'with SEO work going' : 'Add the first one'} />
            <StatCard label="Keywords" value={keywords} caption="across all clients" bar="lime" />
            <StatCard label="Tracked in Semrush" value={tracked} caption="US, national" />
            <StatCard label="Templates" value={templates.data ? templates.data.filter((t) => t.industry === null).length : null} caption={templates.data ? "reused on every client" : "Run migration 0004"} bar="orange" />
          </>
        )}
      </section>

      <SeoOverview clients={active} pending={q.isPending} />

      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-6 [@media(max-width:1100px)]:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="m-0 font-display text-[30px] font-semibold leading-tight phone:text-[24px]">Recently worked on</h2>
            <Link to="/clients" className="text-[15px] font-semibold text-vv-purple-deep underline">
              All clients ›
            </Link>
          </div>
          {q.isPending && <Bone className="h-[180px] rounded-[22px]" />}
          {q.isSuccess && recent.length === 0 && (
            <div className={`${CARD} items-start`}>
              <p className="m-0 text-[15px] text-vv-body">No clients yet.</p>
            </div>
          )}
          {recent.map((c) => (
            <RecentCard key={c.siteId} client={c} />
          ))}
          <div className="flex flex-col items-start gap-3 rounded-[22px] border-[1.5px] border-dashed border-vv-field-line px-6 py-5">
            <h3 className="m-0 text-[17px] font-bold text-vv-ink">Next client</h3>
            <p className="m-0 text-[15px] text-vv-body">Pick an industry template, then the services, areas and accounts. Four short steps.</p>
            <Link to="/clients/new" className={BTN_GHOST}>
              Start from a template
            </Link>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="m-0 font-display text-[30px] font-semibold leading-tight phone:text-[24px]">Needs you</h2>
          <NeedsYou items={needs} pending={q.isPending} />
          <div className="flex flex-col items-start gap-2 rounded-[22px] border border-solid border-vv-line bg-vv-green-100 px-6 py-5">
            <h3 className="m-0 text-[17px] font-bold text-vv-green-ink">Templates you reuse</h3>
            <p className="m-0 text-[15px] leading-normal text-vv-green-ink">
              Keyword research, clusters, SEO hotspots, GBP posts, review email and citation waves, set up once and applied to every new client.
            </p>
            <Link to="/templates" className="text-[15px] font-semibold text-vv-purple-deep underline">
              Open templates ›
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

/** Site numbers from each site's daily Vibe SEO check-in: an empty state until the plugin connects sites. */
function SeoOverview({ clients, pending }: { clients: ClientSummary[]; pending: boolean }) {
  const cols = ['SEO score', 'Pages', 'No meta', 'No keyphrase', 'No alt', 'Visitors · week']
  return (
    <section className={CARD} aria-labelledby="seo-ov">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="seo-ov" className={CARD_TITLE}>
          SEO overview
        </h2>
        <span className="text-[14px] text-vv-body">From each site’s daily Vibe SEO check-in</span>
      </div>
      {pending ? (
        <Bone className="h-24 w-full rounded-xl" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="bg-vv-lavender-50 text-xs font-bold uppercase tracking-[0.1em] text-vv-body">
                <th scope="col" className="rounded-l-xl px-4 py-3">
                  Client
                </th>
                {cols.map((h) => (
                  <th key={h} scope="col" className="whitespace-nowrap px-4 py-3">
                    {h}
                  </th>
                ))}
                <th scope="col" className="whitespace-nowrap rounded-r-xl px-4 py-3">
                  Last check-in
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.siteId} className="border-0 border-b border-solid border-vv-line">
                  <td className="px-4 py-3">
                    <Link to={`/clients/${c.siteId}`} className="whitespace-nowrap font-semibold text-vv-ink underline">
                      {c.name}
                    </Link>
                  </td>
                  {cols.map((h) => (
                    <td key={h} className="px-4 py-3 text-vv-muted">
                      —
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <span className={`${PILL} bg-vv-st-waiting text-vv-st-waiting-ink`}>Not connected</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="m-0 text-[14px] text-vv-body">
        Connect the site (coming soon). Sites connect through the Vibe SEO plugin, after phase 4; scores then turn green / yellow / red like the hub’s SEO overview.
      </p>
    </section>
  )
}

function RecentCard({ client: c }: { client: ClientSummary }) {
  const industryLabel = useIndustryLabel()
  const done = new Set(c.guide.doneSteps)
  const where = [siteLabel(c.siteUrl), [c.city, c.state].filter(Boolean).join(', '), industryLabel(c.industry) && `Template: ${industryLabel(c.industry)}`]
    .filter(Boolean)
    .join(' · ')
  return (
    <Link to={`/clients/${c.siteId}`} className={`${CARD} text-vv-ink no-underline transition-colors hover:border-vv-lavender motion-reduce:transition-none`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="m-0 font-display text-[26px] font-semibold leading-tight phone:text-[22px]">{c.name}</h3>
          <span className="text-[15px] text-vv-body">{where}</span>
        </div>
        <span className={`${PILL} bg-vv-green-100 text-vv-green-ink`}>{stepLabel(c.guide.current)}</span>
      </div>
      <div className="grid grid-cols-9 gap-1.5" role="img" aria-label={`${c.guide.doneCount} of ${GUIDE_STEPS} guide steps done`}>
        {GUIDE.map((s) => (
          <span
            key={s.n}
            title={s.title}
            className={`h-2.5 rounded-full ${done.has(s.n) ? 'bg-vv-purple' : s.n === c.guide.current ? 'bg-vv-green' : 'bg-vv-lavender-100 dark:bg-vv-field-line'}`}
          />
        ))}
      </div>
      <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1 text-[15px] text-vv-body">
        <Stat n={c.counts.keywords} label="keywords" />
        <Stat n={c.counts.tracked} label="tracked in Semrush" />
        <Stat n={c.counts.pages} label="pages planned" />
      </dl>
    </Link>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="m-0">
        <strong className="text-vv-ink">{n.toLocaleString('en-US')}</strong> {label}
      </dd>
    </div>
  )
}

const DOT: Record<NeedsYouItem['tone'], string> = { orange: 'bg-[#d39b16]', red: 'bg-vv-red', purple: 'bg-vv-purple' }

function NeedsYou({ items, pending }: { items: { item: NeedsYouItem; client: ClientSummary }[]; pending: boolean }) {
  return (
    <section className={`${CARD} !gap-0 !py-3`} aria-label="Needs you">
      {pending ? (
        <Bone className="my-2 h-24 w-full rounded-xl" />
      ) : items.length === 0 ? (
        <p className="m-0 py-3 text-[15px] text-vv-body">Nothing needs you right now.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map(({ item, client }) => (
            <li key={`${client.siteId}-${item.title}`} className="border-0 border-b border-solid border-vv-line last:border-b-0">
              <Link to={`/clients/${client.siteId}${item.path ? `/${item.path}` : ''}`} className="flex items-start gap-3 py-3.5 text-vv-ink no-underline hover:bg-vv-lavender-50">
                <span aria-hidden="true" className={`mt-1.5 h-3 w-3 flex-none rounded-full ${DOT[item.tone]}`} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[16px] font-semibold">{item.title}</span>
                  <span className="text-[14px] text-vv-body">
                    {client.name} · {item.where}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
