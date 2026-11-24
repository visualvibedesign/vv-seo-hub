import { Link } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import { Bone } from '../../components/ui/Loading'
import { useClusters } from '../../hooks/useMatrix'
import { num } from '../../lib/keywordUi'
import { BTN_GHOST, CARD, CARD_TITLE, PILL } from '../../lib/ui'
import type { CategoryCode, ClusterKeyword, ClusterPage, ClientDetail, PageStatus } from '../../types/seo'

// Keywords › Clusters (/clients/{site id}/keywords/clusters): one row per page (context pack columns:
// Category, Page, Priority, Primary keyword, Volume · KD, Secondary + FAQ, Why). A keyword sits on one page only.
// Read-only for now: page editing comes with Sitemap + hotspots (phase 3).

const PRIORITY: Record<ClusterPage['priority'], string> = {
  high: `${PILL} bg-vv-lavender text-vv-ink`,
  medium: `${PILL} bg-vv-lavender-100 text-vv-purple-ink`,
  low: `${PILL} bg-vv-st-todo text-vv-st-todo-ink`,
}
const STATUS: Record<PageStatus, { cls: string; text: string }> = {
  live: { cls: `${PILL} bg-vv-green-100 text-vv-green-ink`, text: 'Live' },
  scheduled: { cls: `${PILL} bg-vv-st-waiting text-vv-st-waiting-ink`, text: 'Not live yet' },
  planned: { cls: `${PILL} bg-vv-st-todo text-vv-st-todo-ink`, text: 'Planned' },
}
const ORDER: CategoryCode[] = ['Home', 'S1', 'S2', 'S3', 'FAQ']

export default function ClustersPage() {
  const c = useClientContext()
  const q = useClusters(c.siteId)
  const pages = q.data ?? []
  const groups = ORDER.map((code) => ({ code, name: c.categories.find((k) => k.code === code)?.name ?? code, pages: pages.filter((p) => p.category === code) })).filter(
    (g) => g.pages.length,
  )
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Keyword <em className="font-medium text-vv-purple">clusters.</em>
          </h1>
          <p className="m-0 text-[17px] leading-normal text-vv-body">
            Day 2 · one page per cluster · a keyword sits on one page only{pages.length ? ` · ${pages.length} pages` : ''}
          </p>
        </div>
        <HeaderTools>
          <Link to={`/clients/${c.siteId}/keywords`} className={BTN_GHOST}>
            Matrix
          </Link>
        </HeaderTools>
      </header>

      {q.isPending && <Bone className="h-[360px] w-full rounded-[22px]" />}
      {q.isError && (
        <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">
          Couldn’t load the clusters. Try again in a moment.
        </p>
      )}
      {q.isSuccess && pages.length === 0 && (
        <section className={`${CARD} items-start`}>
          <h2 className={CARD_TITLE}>No clusters yet</h2>
          <p className="m-0 max-w-[680px] text-[15px] text-vv-body">
            Group the keywords into pages: one page per cluster, a primary keyword each, then secondaries and FAQ ideas. Claude drafts this in Uploads + auto-fill (coming in phase 1); a Sheet’s
            Clusters tab can be imported with <code>scripts/import-clusters.ts</code> for now.
          </p>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.code} className={`${CARD} !gap-3`} aria-labelledby={`cl-${g.code}`}>
          <h2 id={`cl-${g.code}`} className={CARD_TITLE}>
            <span className="mr-2 text-[15px] font-bold text-vv-purple-deep">{g.code}</span>
            {g.name}
            <span className="ml-2 text-[14px] font-normal text-vv-muted">
              {g.pages.length} page{g.pages.length === 1 ? '' : 's'}
            </span>
          </h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {g.pages.map((p) => (
              <PageRow key={p.id} page={p} client={c} />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

function PageRow({ page: p, client: c }: { page: ClusterPage; client: ClientDetail }) {
  const primary = p.keywords.find((k) => k.role === 'primary')
  const secondary = p.keywords.filter((k) => k.role === 'secondary')
  const faq = p.keywords.filter((k) => k.role === 'faq')
  const suggested = p.ideas.find((i) => i.startsWith('Primary (suggested'))
  const ideas = p.ideas.filter((i) => i !== suggested)
  const path = p.url ? p.url.replace(c.siteUrl.replace(/\/+$/, ''), '') || '/' : null
  return (
    <li className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,1.6fr)] gap-4 border-0 border-t border-solid border-vv-line py-3.5 first:border-t-0 [@media(max-width:1100px)]:grid-cols-1 [@media(max-width:1100px)]:gap-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[16px] font-bold text-vv-ink">{p.name}</span>
        {path && (
          <a href={p.url!} target="_blank" rel="noopener noreferrer" className="truncate text-[13px] text-vv-purple-deep">
            {path} ↗
          </a>
        )}
        <span className="flex flex-wrap gap-1.5">
          <span className={PRIORITY[p.priority]}>{p.priority[0].toUpperCase() + p.priority.slice(1)}</span>
          <span className={STATUS[p.status].cls}>{STATUS[p.status].text}</span>
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-vv-body">Primary</span>
        {primary ? (
          <>
            <span className="text-[15px] font-semibold">{primary.keyword}</span>
            <span className="text-[13px] text-vv-body">{volKd(primary)}</span>
          </>
        ) : (
          <span className="text-[14px] text-vv-body">{suggested ? suggested.replace('Primary (suggested, no keyword data yet): ', '') + ' (suggested, no data)' : '—'}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {secondary.length > 0 && <KeywordList label={`Secondary (${secondary.length})`} list={secondary} />}
        {faq.length > 0 && <KeywordList label={`FAQ (${faq.length})`} list={faq} />}
        {ideas.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-vv-body">Ideas</span>
            {ideas.map((i) => (
              <span key={i} className="text-[13px] text-vv-body">
                {i}
              </span>
            ))}
          </div>
        )}
        {p.why && (
          <details className="group">
            <summary className="cursor-pointer text-[13px] font-semibold text-vv-purple-deep">Why</summary>
            <p className="m-0 mt-1 text-[13px] leading-normal text-vv-body">{p.why}</p>
          </details>
        )}
      </div>
    </li>
  )
}

function volKd(k: ClusterKeyword): string {
  const v = k.semrushVolume === null ? (k.kpVolume ? `KP ${k.kpVolume}` : 'no data') : `${num(k.semrushVolume)}/mo`
  return k.kd === null ? v : `${v} · KD ${k.kd}`
}

function KeywordList({ label, list }: { label: string; list: ClusterKeyword[] }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-vv-body">{label}</span>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {list.map((k) => (
          <li key={k.id} className="rounded-full bg-vv-lavender-100 px-2.5 py-0.5 text-[13px] text-vv-purple-ink" title={volKd(k)}>
            {k.keyword}
          </li>
        ))}
      </ul>
    </div>
  )
}
