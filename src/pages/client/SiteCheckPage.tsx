import { Link } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import { Dash, LilacTable, PageHead, Panel, Soon, Tile } from '../../components/overview/OverviewParts'
import { Bone } from '../../components/ui/Loading'
import { useClusters } from '../../hooks/useMatrix'
import { strategyPath } from '../../lib/clientSetup'
import { PILL, siteLabel } from '../../lib/ui'
import type { PageStatus } from '../../types/seo'

// Client Overview › Site check (/clients/{site id}/site-check): every live page checked against the plan (title,
// meta, H1, indexed, mobile speed). Design: docs/design/overview/SiteCheck.dc.html. Real now: the planned pages with
// their keyword owner (Clusters). The live checks come with the sitemap crawl + Vibe SEO plugin: empty until then.

const STATUS: Record<PageStatus, { cls: string; text: string }> = {
  live: { cls: 'bg-vv-green-100 text-vv-green-ink', text: 'Live' },
  scheduled: { cls: 'bg-vv-st-waiting text-vv-st-waiting-ink', text: 'Not live yet' },
  planned: { cls: 'bg-vv-st-todo text-vv-st-todo-ink', text: 'Planned' },
}

export default function SiteCheckPage() {
  const c = useClientContext()
  const q = useClusters(c.siteId)
  const pages = q.data ?? []
  const path = (u: string | null) => (u ? u.replace(/^https?:\/\/[^/]+/, '') || '/' : null)
  return (
    <>
      <PageHead
        lead="Site check,"
        accent="page by page."
        sub={`${pages.length ? `${pages.length} pages in the plan` : 'No pages in the plan yet'} · ${siteLabel(c.siteUrl)} · the live checks come with phase 3 and the Vibe SEO plugin`}
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <Tile label="Site health" value={<Dash />} note="Score out of 100" tone="purple" />
        <Tile label="Problems" value={<Dash />} note="Missing meta, H1s, not indexed" tone="pink" />
        <Tile label="Warnings" value={<Dash />} note="Lengths, slow mobile pages" tone="orange" />
        <Tile label="Indexed" value={<Dash />} note="Search Console" tone="green" />
        <Tile label="Mobile speed" value={<Dash />} note="PageSpeed average" tone="purple" />
      </div>

      <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] items-start gap-4 [@media(max-width:1100px)]:grid-cols-1">
        <Panel flush title="Pages" sub="From the plan (Clusters) · live columns fill in once the site is checked" right={<Soon>Checks in phase 3</Soon>}>
          {q.isPending && <Bone className="m-5 h-40 rounded-[14px]" />}
          {q.isSuccess && pages.length === 0 && (
            <p className="m-0 px-5 pb-5 text-[13px] text-vv-body">
              No pages yet. They come from{' '}
              <Link to={strategyPath(c.siteId, 'keywords/clusters')} className="font-semibold text-vv-purple-deep">
                Clusters
              </Link>
              .
            </p>
          )}
          {pages.length > 0 && (
            <LilacTable
              head={['Page', 'Keyword owner', 'Title', 'Meta', 'H1', 'Indexed', 'Speed', 'Plan']}
              minWidth={760}
              rows={pages.map((p) => [
                <div key="p" className="min-w-0">
                  <div className="font-semibold">{path(p.url) ?? p.name}</div>
                  {p.url && <div className="text-[11px] text-vv-body">{p.name}</div>}
                </div>,
                p.keywords.find((k) => k.role === 'primary')?.keyword ?? <Dash key="o" />,
                <Dash key="t" />,
                <Dash key="m" />,
                <Dash key="h" />,
                <Dash key="i" />,
                <Dash key="s" />,
                <span key="st" className={`${PILL} !py-0.5 ${STATUS[p.status].cls}`}>
                  {STATUS[p.status].text}
                </span>,
              ])}
            />
          )}
          <p className="m-0 border-0 border-t border-solid border-vv-line px-5 py-3 text-[12px] text-vv-body">Rules from Sam’s playbook: title 50–60 characters, meta 150–160 ending with a call to action, one H1 per page.</p>
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Live page vs plan" right={<Soon>Phase 3</Soon>}>
            <p className="m-0 text-[13px] leading-relaxed text-vv-body">Pick a page to see its live title and meta next to the planned ones, and a fix list. “Push fix to site” waits for the Vibe SEO plugin and your OK.</p>
          </Panel>
          <Panel title="From the plugin" right={<Soon>Later</Soon>} dashed>
            <p className="m-0 text-[13px] leading-relaxed text-vv-body">Yoast / Rank Math keyphrase and score, orphan pages, missing image alt, form entries and QA scan results show here once Vibe SEO checks in.</p>
          </Panel>
        </div>
      </div>
    </>
  )
}
