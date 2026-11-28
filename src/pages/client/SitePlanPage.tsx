import { useState } from 'react'
import { Link } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import AddPageDialog from '../../components/pages/AddPageDialog'
import { Bone, Spinner } from '../../components/ui/Loading'
import { usePageParent, usePages, useRedirectStatus } from '../../hooks/usePages'
import { ApiError } from '../../lib/api'
import { ACTION_TONE, ACTION_LABEL, NEXT_REDIRECT, REDIRECT_LABEL, REDIRECT_TONE, STRUCTURE_LABEL } from '../../lib/pages'
import { BTN_GHOST, BTN_LIME, CARD, PILL } from '../../lib/ui'
import type { PagesState, PageType, SitePage, SiteRedirect } from '../../types/seo'

// Strategy Builder › Day 5 · Site plan (/clients/{site id}/strategy/plan). Design: docs/design/SitePlan.png.
// How the pages connect: the tree for the client's structure (Home → service / location pages → children → supporting),
// each page can be put under another ("Move under"), and the redirects queue that fills itself when a live page's URL
// changes on Sitemap + hotspots. Statuses Queued → Sent to site → Live are moved by hand: sending to the site needs
// the Vibe SEO update (phase 5); Vibe Admin does the real redirect. "Start from a website" comes later.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)

/** The groups under Home, in the order the structure puts them. Pages with a parent sit under that parent instead. */
function groups(s: PagesState): { label: string; types: PageType[] }[] {
  if (s.structure === 'location_first') return [{ label: 'Location pages', types: ['location'] }, { label: 'Service pages', types: ['service'] }, { label: 'Supporting', types: ['supporting'] }]
  if (s.structure === 'flat') return [{ label: 'Pages', types: ['service', 'location'] }, { label: 'Supporting', types: ['supporting'] }]
  return [{ label: 'Service pages', types: ['service'] }, { label: 'Location pages', types: ['location'] }, { label: 'Supporting', types: ['supporting'] }]
}

export default function SitePlanPage() {
  const c = useClientContext()
  const q = usePages(c.siteId)
  const [adding, setAdding] = useState(false)
  const s = q.data
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Site <em className="font-medium text-vv-purple">plan.</em>
          </h1>
          <p className="m-0 text-[17px] leading-normal text-vv-body">Day 5 · how the pages connect · URL changes go to the redirects queue</p>
        </div>
        <HeaderTools>
          <span className={`${BTN_GHOST} pointer-events-none opacity-60`} title="Reading an existing website's pages comes later">
            Start from a website <span className={`${PILL} !py-0 !text-[11px] bg-vv-st-todo text-vv-st-todo-ink`}>Later</span>
          </span>
          <button type="button" className={BTN_LIME} onClick={() => setAdding(true)} disabled={!s}>
            + Add page
          </button>
        </HeaderTools>
      </header>

      {q.isPending && <Bone className="h-[420px] w-full rounded-[22px]" />}
      {q.isError && <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load the pages. Try again in a moment.')}</p>}

      {s && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start gap-5 [@media(max-width:1100px)]:grid-cols-1">
          <Tree siteId={c.siteId} s={s} />
          <Redirects siteId={c.siteId} s={s} />
        </div>
      )}

      {adding && s && <AddPageDialog siteId={c.siteId} state={s} onClose={() => setAdding(false)} onAdded={() => setAdding(false)} />}
    </>
  )
}

function Tree({ siteId, s }: { siteId: string; s: PagesState }) {
  const parent = usePageParent(siteId)
  const [moving, setMoving] = useState<string | null>(null)
  const ids = new Set(s.pages.map((p) => p.id))
  const childrenOf = (id: string) => s.pages.filter((p) => p.parentId === id)
  const top = s.pages.filter((p) => !p.parentId || !ids.has(p.parentId))
  const home = top.filter((p) => p.type === 'home')
  const used = new Set<string>(home.map((p) => p.id))
  const sections = groups(s).map((g) => {
    const list = top.filter((p) => !used.has(p.id) && p.type && g.types.includes(p.type))
    list.forEach((p) => used.add(p.id))
    return { ...g, list }
  })
  const unsorted = top.filter((p) => !used.has(p.id))

  /** Pages this one may move under: any other page that isn't inside it. */
  const optionsFor = (p: SitePage) => {
    const inside = new Set<string>([p.id])
    let grew = true
    while (grew) {
      grew = false
      for (const x of s.pages) {
        if (x.parentId && inside.has(x.parentId) && !inside.has(x.id)) {
          inside.add(x.id)
          grew = true
        }
      }
    }
    return s.pages.filter((x) => !inside.has(x.id))
  }

  const node = (p: SitePage, depth: number): React.ReactNode => (
    <li key={p.id} className="flex flex-col gap-1.5">
      <div className={`flex flex-wrap items-center gap-2 rounded-[16px] border border-solid px-4 py-2.5 text-[15px] ${p.type === 'home' ? 'border-vv-purple bg-vv-surface' : p.action === 'new' ? 'border-dashed border-vv-line bg-vv-surface' : 'border-vv-line bg-vv-surface'}`}>
        <strong className="text-vv-ink">{p.code ?? '·'}</strong>
        <span className="text-vv-ink">· {p.name}</span>
        {p.type === 'home' && p.keywords.find((k) => k.role === 'primary') && <span className="text-vv-body">· {p.keywords.find((k) => k.role === 'primary')!.keyword}</span>}
        {p.action === 'new' && <span className={`${PILL} !py-0.5 ${ACTION_TONE.new}`}>{ACTION_LABEL.new}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {moving === p.id ? (
            <>
              <select
                aria-label={`Move ${p.name} under`}
                autoFocus
                className="max-w-[200px] rounded-full border border-solid border-vv-field-line bg-vv-field px-2.5 py-1 font-body text-[13px] text-vv-ink"
                defaultValue={p.parentId ?? ''}
                disabled={parent.isPending}
                onChange={(e) => parent.mutate({ pageId: p.id, parentId: e.target.value || null }, { onSuccess: () => setMoving(null) })}
              >
                <option value="">Top level</option>
                {optionsFor(p).map((x) => (
                  <option key={x.id} value={x.id}>
                    Under {x.code ?? ''} {x.name}
                  </option>
                ))}
              </select>
              {parent.isPending ? <Spinner /> : <button type="button" className="border-0 bg-transparent p-0 font-body text-[12px] text-vv-body" onClick={() => setMoving(null)}>Cancel</button>}
            </>
          ) : (
            p.type !== 'home' && (
              <button type="button" className="border-0 bg-transparent p-0 font-body text-[12px] font-semibold text-vv-purple-deep" onClick={() => setMoving(p.id)}>
                Move under…
              </button>
            )
          )}
        </span>
      </div>
      {childrenOf(p.id).length > 0 && (
        <ul className={`m-0 flex list-none flex-col gap-1.5 border-0 border-l-2 border-solid border-vv-lavender py-0 pl-4 pr-0 ${depth > 3 ? '' : 'ml-3'}`}>{childrenOf(p.id).map((x) => node(x, depth + 1))}</ul>
      )}
    </li>
  )

  return (
    <section className={`${CARD} !gap-4`} aria-labelledby="sitemap-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sitemap-title" className="m-0 font-display text-[24px] font-semibold">
          Sitemap
        </h2>
        <Link to={`/clients/${siteId}/strategy/pages`} className={`${PILL} bg-vv-lavender-100 text-vv-purple-ink no-underline`} title="Change it on Sitemap + hotspots">
          {STRUCTURE_LABEL[s.structure]}
        </Link>
      </div>
      {s.pages.length === 0 ? (
        <p className="m-0 text-[14px] text-vv-body">No pages yet. Pages come from the keyword clusters (Day 2) or “+ Add page”.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {home.map((p) => node(p, 0))}
          <li>
            <ul className="m-0 ml-3 flex list-none flex-col gap-3 border-0 border-l-2 border-solid border-vv-lavender py-1 pl-4 pr-0">
              {sections
                .filter((g) => g.list.length)
                .map((g) => (
                  <li key={g.label} className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-vv-body">{g.label}</span>
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{g.list.map((p) => node(p, 1))}</ul>
                  </li>
                ))}
              {unsorted.length > 0 && (
                <li className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-vv-orange-ink">No type yet (set it on Sitemap + hotspots)</span>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{unsorted.map((p) => node(p, 1))}</ul>
                </li>
              )}
            </ul>
          </li>
        </ul>
      )}
      {parent.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(parent.error, 'Couldn’t move the page.')}</p>}
      <p className="m-0 text-[13px] text-vv-body">Body copy links: each service page links to its child and supporting pages (FAQ, first-timer), children link back to their parent, and every page has a route to contact. Don’t over-mention other areas on a page (cannibalization).</p>
    </section>
  )
}

function Redirects({ siteId, s }: { siteId: string; s: PagesState }) {
  const move = useRedirectStatus(siteId)
  const [busy, setBusy] = useState<string | null>(null)
  const click = (r: SiteRedirect) => {
    setBusy(r.id)
    move.mutate({ id: r.id, status: NEXT_REDIRECT[r.status] }, { onSettled: () => setBusy(null) })
  }
  return (
    <section className={`${CARD} !gap-4`} aria-labelledby="redirects-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="redirects-title" className="m-0 font-display text-[24px] font-semibold">
          Redirects queue
        </h2>
        <span className="text-[13px] text-vv-body">Added automatically when a live page’s URL changes</span>
      </div>
      {s.redirects.length === 0 ? (
        <p className="m-0 text-[14px] text-vv-body">No redirects. Changing a live page’s URL on Sitemap + hotspots adds one here (old URL → new URL).</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-solid border-vv-line">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-vv-lavender-50 text-left text-[11px] uppercase tracking-[0.05em] text-vv-purple-ink">
                <th className="px-3 py-2.5 font-bold">Old URL</th>
                <th className="px-3 py-2.5 font-bold">New URL</th>
                <th className="px-3 py-2.5 font-bold">Why</th>
                <th className="px-3 py-2.5 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {s.redirects.map((r) => (
                <tr key={r.id} className="border-0 border-t border-solid border-vv-line align-top">
                  <td className="break-all px-3 py-2.5 text-vv-body">{r.oldUrl}</td>
                  <td className="break-all px-3 py-2.5 font-semibold">{r.newUrl}</td>
                  <td className="px-3 py-2.5 text-vv-body">{r.why ?? (r.pageName ? `${r.pageCode ?? ''} ${r.pageName}` : '—')}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => click(r)}
                      disabled={move.isPending}
                      title={`Move to ${REDIRECT_LABEL[NEXT_REDIRECT[r.status]]}`}
                      className={`${PILL} cursor-pointer border-0 font-body ${REDIRECT_TONE[r.status]}`}
                    >
                      {busy === r.id && <Spinner />}
                      {REDIRECT_LABEL[r.status]}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-vv-body">
        <span className={`${PILL} ${REDIRECT_TONE.queued}`}>Queued</span>→<span className={`${PILL} ${REDIRECT_TONE.sent}`}>Sent to site</span>→<span className={`${PILL} ${REDIRECT_TONE.live}`}>Live</span>
        <span>· click a status to move it on</span>
      </div>
      {move.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(move.error, 'Couldn’t move the redirect.')}</p>}
      <p className="m-0 rounded-[16px] border border-dashed border-vv-lavender px-4 py-3 text-[13px] text-vv-body">Today redirects reach the site through the agency hub’s check-in reply. For SEO Hub to send them, Vibe SEO needs an update (phase 5). Vibe Admin keeps doing the actual redirect.</p>
    </section>
  )
}
