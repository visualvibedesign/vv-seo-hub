import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import { Bone, Spinner } from '../../components/ui/Loading'
import Modal from '../../components/ui/Modal'
import { useBackfillPages, usePages, useSaveHotspots, useSiteStructure, useSkipHotspotDraft } from '../../hooks/usePages'
import { ApiError } from '../../lib/api'
import { hotspotChecks, inRange, META_RANGE, slugPath, TITLE_RANGE } from '../../lib/hotspots'
import { ACTION_LABEL, ACTION_TONE, STRUCTURE_LABEL, TYPE_LABEL } from '../../lib/pages'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, FIELD, LABEL, PILL, siteLabel } from '../../lib/ui'
import AddPageDialog from '../../components/pages/AddPageDialog'
import HotspotsDraftDialog from '../../components/pages/HotspotsDraftDialog'
import type { HotspotDraft, PageAction, PagesState, PageType, SitePage, SiteStructure } from '../../types/seo'

// Strategy Builder › Day 5 · Sitemap + hotspots (/clients/{site id}/strategy/pages). Design: docs/design/Pages.png.
// One page per keyword cluster (the Clusters pages), each with a code (P1…), keep / improve / new and its SEO hotspots:
// title (50–60), meta description (150–160, ends with a call to action), H1, target URL, with live counters, checks
// (warnings only) and a Google preview. A live page moved to a new URL queues a redirect (Site plan). "Live now" from
// the site waits for the Vibe SEO connection. Claude drafts come in step 4; Push to site in phase 5; ClickUp later.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const primaryOf = (p: SitePage) => p.keywords.find((k) => k.role === 'primary')?.keyword ?? null

export default function SitemapPage() {
  const c = useClientContext()
  const q = usePages(c.siteId)
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const [filling, setFilling] = useState(false)
  // Pages to start the Claude dialog with (null = closed)
  const [drafting, setDrafting] = useState<string[] | null>(null)
  const s = q.data
  const selectedId = params.get('page') ?? s?.pages[0]?.id ?? null
  const selected = s?.pages.find((p) => p.id === selectedId) ?? s?.pages[0]
  const select = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('page', id)
    setParams(next, { replace: true })
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Ideal sitemap + <em className="font-medium text-vv-purple">hotspots.</em>
          </h1>
          <div className="m-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[17px] leading-normal text-vv-body">
            Day 5 · one page per keyword cluster · structure: {s ? <StructurePicker siteId={c.siteId} value={s.structure} /> : '…'}
          </div>
        </div>
        <HeaderTools>
          <span className={`${BTN_GHOST} pointer-events-none opacity-60`} title="Sending hotspots to ClickUp Web Page tasks comes later">
            Send to ClickUp <span className={`${PILL} !py-0 !text-[11px] bg-vv-st-todo text-vv-st-todo-ink`}>Later</span>
          </span>
          <button type="button" className={BTN_GHOST} onClick={() => s && setDrafting(s.pages.filter((x) => !x.hotspotsAt && !s.drafts.some((d) => d.pageId === x.id)).map((x) => x.id))} disabled={!s || !s.pages.length}>
            Draft with Claude
          </button>
          <button type="button" className={BTN_LIME} onClick={() => setAdding(true)} disabled={!s}>
            + Add page
          </button>
        </HeaderTools>
      </header>

      {q.isPending && <Bone className="h-[420px] w-full rounded-[22px]" />}
      {q.isError && <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load the pages. Try again in a moment.')}</p>}

      {s && s.pages.length === 0 && (
        <section className={`${CARD} items-start`}>
          <p className="m-0 text-[15px] text-vv-body">No pages yet. Pages come from the keyword clusters (Day 2): build them in Clusters, or add one here.</p>
          <Link to={`/clients/${c.siteId}/strategy/keywords/clusters`} className={BTN_GHOST}>
            Open Clusters
          </Link>
        </section>
      )}

      {s && s.drafts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-vv-lavender-100 px-4 py-3 text-[14px] text-vv-purple-ink">
          <span>
            <strong>Claude’s hotspots for {s.drafts.length} page{s.drafts.length === 1 ? '' : 's'} are ready to review.</strong> Open a page marked “Draft ready”, use or edit the draft, then save. Saving approves it; nothing changes until you do.
          </span>
        </div>
      )}

      {s && s.needsBackfill > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-vv-orange-100 px-4 py-3 text-[14px] text-vv-orange-ink">
          <span>
            <strong>{s.needsBackfill} page{s.needsBackfill === 1 ? '' : 's'}</strong> have no code (P1…), type or keep / improve / new yet. Fill them from what each page already says?
          </span>
          <button type="button" className={`${BTN_LIME} min-h-10 px-4 text-[13px]`} onClick={() => setFilling(true)}>
            See what would change
          </button>
        </div>
      )}

      {s && s.pages.length > 0 && selected && (
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] items-start gap-5 [@media(max-width:1100px)]:grid-cols-1">
          <PageList pages={s.pages} drafts={s.drafts} selectedId={selected.id} onSelect={select} />
          <HotspotEditor key={`${selected.id}-${selected.hotspotsAt ?? ''}`} siteId={c.siteId} state={s} page={selected} onDraft={() => setDrafting([selected.id])} />
        </div>
      )}

      {adding && s && <AddPageDialog siteId={c.siteId} state={s} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); if (id) select(id) }} />}
      {filling && <Backfill siteId={c.siteId} onClose={() => setFilling(false)} />}
      {drafting && s && <HotspotsDraftDialog siteId={c.siteId} state={s} start={drafting} onClose={() => setDrafting(null)} />}
    </>
  )
}

function StructurePicker({ siteId, value }: { siteId: string; value: SiteStructure }) {
  const save = useSiteStructure(siteId)
  return (
    <span className="inline-flex items-center gap-2">
      <select
        aria-label="Site structure"
        className="rounded-full border border-solid border-vv-field-line bg-vv-surface px-3 py-1 font-body text-[15px] font-semibold text-vv-ink"
        value={value}
        disabled={save.isPending}
        onChange={(e) => save.mutate(e.target.value as SiteStructure)}
        title="Service first: /service/ hubs with /service/city/ children (most common). Location first: /city/ hubs. Flat: /service-city/."
      >
        {(Object.keys(STRUCTURE_LABEL) as SiteStructure[]).map((k) => (
          <option key={k} value={k}>
            {STRUCTURE_LABEL[k]}
          </option>
        ))}
      </select>
      {save.isPending && <Spinner />}
      {save.error && <span className="text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save.')}</span>}
    </span>
  )
}

function PageList({ pages, drafts, selectedId, onSelect }: { pages: SitePage[]; drafts: HotspotDraft[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className={`${CARD} !gap-1 !p-3`} aria-label="Pages">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {pages.map((p) => {
          const on = p.id === selectedId
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-current={on ? 'true' : undefined}
                onClick={() => onSelect(p.id)}
                className={`flex w-full items-center gap-3 rounded-[16px] border-0 px-3 py-3 text-left font-body ${on ? 'bg-vv-lavender-100' : 'bg-transparent hover:bg-vv-lavender-50'}`}
              >
                <span className="w-9 flex-none text-[14px] font-bold text-vv-purple-deep">{p.code ?? '·'}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold text-vv-ink">{p.name}</span>
                  <span className="truncate text-[13px] text-vv-body">{primaryOf(p) ?? 'no primary keyword yet'}</span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1">
                  {p.action && <span className={`${PILL} !py-0.5 ${ACTION_TONE[p.action]}`}>{ACTION_LABEL[p.action]}</span>}
                  {drafts.some((d) => d.pageId === p.id) ? <span className="text-[11px] font-semibold text-vv-purple-deep">Draft ready</span> : p.hotspotsAt && <span className="text-[11px] text-vv-muted">hotspots saved</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="m-0 px-3 pb-1 pt-2 text-[12px] text-vv-muted">{pages.length} pages · from Clusters (Day 2)</p>
    </section>
  )
}

function Counter({ n, range }: { n: number; range: readonly [number, number] }) {
  return <span className={`text-[13px] font-semibold ${inRange(n, range) ? 'text-vv-green-ink' : n ? 'text-vv-orange-ink' : 'text-vv-muted'}`}>{`${n} / ${range[0]}–${range[1]}`}</span>
}

function HotspotEditor({ siteId, state, page, onDraft }: { siteId: string; state: PagesState; page: SitePage; onDraft: () => void }) {
  const save = useSaveHotspots(siteId)
  const draft = state.drafts.find((d) => d.pageId === page.id) ?? null
  const [v, setV] = useState({
    code: page.code ?? '',
    type: page.type ?? ('' as PageType | ''),
    action: page.action ?? ('' as PageAction | ''),
    title: page.seoTitle ?? '',
    meta: page.metaDescription ?? '',
    h1: page.h1 ?? '',
    url: page.urlTarget ?? (page.url ? slugPath(page.url) : ''),
  })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value })
  const primary = primaryOf(page)
  const secondaries = page.keywords.filter((k) => k.role === 'secondary').length
  const faqs = page.keywords.filter((k) => k.role === 'faq').length + page.ideas.length
  const checks = hotspotChecks({ title: v.title, meta: v.meta, h1: v.h1, url: v.url, primary, state: state.state })
  const target = v.url.trim() ? slugPath(v.url) : ''
  const current = page.url ? slugPath(page.url) : null
  const redirect = page.status === 'live' && current && target && current !== target
  const domain = siteLabel(state.siteUrl)
  const eyebrow = [page.code, page.type ? TYPE_LABEL[page.type] : null, page.action ? ACTION_LABEL[page.action] : null].filter(Boolean).join(' · ')
  const dirty =
    v.code !== (page.code ?? '') || v.type !== (page.type ?? '') || v.action !== (page.action ?? '') || v.title !== (page.seoTitle ?? '') || v.meta !== (page.metaDescription ?? '') || v.h1 !== (page.h1 ?? '') || v.url !== (page.urlTarget ?? (page.url ? slugPath(page.url) : ''))

  const submit = () =>
    save.mutate({
      pageId: page.id,
      code: v.code.trim() || null,
      type: v.type || null,
      action: v.action || null,
      seoTitle: v.title || null,
      metaDescription: v.meta || null,
      h1: v.h1 || null,
      urlTarget: v.url.trim() || null,
    })

  return (
    <section className={`${CARD} !gap-4`} aria-label={`Hotspots for ${page.name}`}>
      <div className="flex flex-col gap-1.5">
        {eyebrow && <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-vv-purple-deep">{eyebrow}</span>}
        <h2 className="m-0 font-display text-[28px] font-semibold leading-tight">{page.name}</h2>
        <span className="text-[14px] text-vv-body">
          {primary ? (
            <>
              Owner of <strong className="text-vv-ink">{primary}</strong>
            </>
          ) : (
            'No primary keyword yet'
          )}
          {` · ${secondaries} secondar${secondaries === 1 ? 'y' : 'ies'} · ${faqs} FAQ idea${faqs === 1 ? '' : 's'}`}
        </span>
        {page.swappedUrl && <span className={`${PILL} w-fit bg-vv-orange-100 text-vv-orange-ink`}>Check: Google may show {page.swappedUrl} instead</span>}
      </div>

      {draft && (
        <DraftPanel
          siteId={siteId}
          draft={draft}
          primary={primary}
          stateAbbr={state.state}
          onUse={() => setV({ ...v, title: draft.seoTitle ?? v.title, meta: draft.metaDescription ?? v.meta, h1: draft.h1 ?? v.h1, url: draft.url ?? v.url })}
        />
      )}

      <div className="grid grid-cols-3 gap-3 phone:grid-cols-1">
        <label className={LABEL}>
          Page code
          <input className={FIELD} value={v.code} onChange={set('code')} maxLength={4} placeholder="P1, P2…" />
        </label>
        <label className={LABEL}>
          Type
          <select className={FIELD} value={v.type} onChange={set('type')}>
            <option value="">Not set</option>
            {(Object.keys(TYPE_LABEL) as PageType[]).map((k) => (
              <option key={k} value={k}>
                {TYPE_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Keep / improve / new
          <select className={FIELD} value={v.action} onChange={set('action')}>
            <option value="">Not set</option>
            {(Object.keys(ACTION_LABEL) as PageAction[]).map((k) => (
              <option key={k} value={k}>
                {ACTION_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={LABEL}>
        <span className="flex items-baseline justify-between gap-2">
          SEO title <Counter n={v.title.trim().length} range={TITLE_RANGE} />
        </span>
        <input className={FIELD} value={v.title} onChange={set('title')} maxLength={120} placeholder="Primary keyword in City, Full State | [Trust signal]" />
      </label>
      <label className={LABEL}>
        <span className="flex items-baseline justify-between gap-2">
          Meta description <Counter n={v.meta.trim().length} range={META_RANGE} />
        </span>
        <textarea className={`${FIELD} min-h-[84px] resize-y`} value={v.meta} onChange={set('meta')} maxLength={320} placeholder="What the page offers, for whom, where… then a call to action!" />
      </label>
      <div className="grid grid-cols-2 gap-3 phone:grid-cols-1">
        <label className={LABEL}>
          H1
          <input className={FIELD} value={v.h1} onChange={set('h1')} maxLength={160} />
        </label>
        <label className={LABEL}>
          URL (target)
          <input className={FIELD} value={v.url} onChange={set('url')} maxLength={300} placeholder="/service-city-st/" />
        </label>
      </div>
      <div className="flex flex-col gap-1 text-[12px] text-vv-body">
        <span>Current URL: {current ?? 'none (new page)'} · saved as {target || '—'}</span>
        <span>Live now (from the site): connect the site to see it here (coming soon).</span>
        {redirect && <span className="font-semibold text-vv-orange-ink">Saving queues a redirect {current} → {target} (Site plan).</span>}
      </div>

      <div className="flex flex-col gap-1.5 rounded-[18px] bg-vv-lavender-50 px-4 py-3" aria-label="Google preview">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-vv-body">Google preview</span>
        <span className="text-[19px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{v.title.trim() || page.name}</span>
        <span className="text-[13px] text-[#006621] dark:text-[#81c995]">
          {domain}
          {target && target !== '/' ? ` › ${target.replace(/^\/|\/$/g, '').split('/').join(' › ')}` : ''}
        </span>
        <span className="text-[14px] leading-snug text-vv-body">{v.meta.trim() || 'No meta description yet: Google picks text from the page.'}</span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]" aria-label="Checks">
        {checks.map((ch) => (
          <li key={ch.text} className={`flex items-start gap-2 ${ch.ok ? 'text-vv-green-ink' : 'text-vv-orange-ink'}`}>
            <span aria-hidden="true" className="w-4 flex-none text-center font-bold">
              {ch.ok ? '✓' : '!'}
            </span>
            <span>{ch.text}</span>
          </li>
        ))}
      </ul>

      {save.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save the hotspots.')}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_LIME} onClick={submit} disabled={save.isPending || !dirty}>
          {save.isPending && <Spinner />}
          {dirty ? 'Save hotspots' : 'Saved'}
        </button>
        <button type="button" className={BTN_GHOST} onClick={onDraft} disabled={save.isPending}>
          {draft ? 'Draft again with Claude' : 'Draft with Claude'}
        </button>
        <Link to={`/clients/${siteId}/strategy/briefs?page=${page.id}`} className={`${BTN_GHOST} no-underline`}>
          Open page brief ›
        </Link>
        <span className={`${BTN_GHOST} pointer-events-none opacity-60`} title="Sending to the site needs the Vibe SEO plugin (phase 5)">
          Push to site (P5)
        </span>
      </div>
    </section>
  )
}

function Backfill({ siteId, onClose }: { siteId: string; onClose: () => void }) {
  const run = useBackfillPages(siteId)
  // The dry run starts once when the dialog opens; nothing changes until "Fill N pages".
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    run.mutate(false)
  }, [run])
  const plan = run.data
  return (
    <Modal open title="Fill page codes, types and keep / new" onClose={() => !run.isPending && onClose()} wide>
      <p className="m-0 text-[13px] text-vv-body">Only empty fields are filled, from what each page already says: Home → home page, S1–S3 → service page, FAQ → supporting; live → Keep, planned → New; codes P1, P2… in page order. You can change any of them after.</p>
      {run.isPending && !plan ? (
        <Bone className="h-[160px] w-full rounded-xl" />
      ) : run.isError ? (
        <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(run.error, 'Couldn’t work it out.')}</p>
      ) : plan?.applied ? (
        <p className="m-0 rounded-xl bg-vv-green-100 px-3 py-2 text-[13px] font-semibold text-vv-green-ink">Done: {plan.changes.length} pages filled.</p>
      ) : plan && plan.changes.length === 0 ? (
        <p className="m-0 text-[13px] text-vv-body">Nothing to fill: every page already has them.</p>
      ) : plan ? (
        <ul className="m-0 flex max-h-[320px] list-none flex-col gap-1 overflow-auto rounded-xl bg-vv-lavender-50 p-3 text-[13px]">
          {plan.changes.map((ch) => (
            <li key={ch.pageId} className="flex flex-wrap gap-x-2">
              <strong className="w-9">{ch.code ?? '·'}</strong>
              <span className="min-w-0 flex-1">{ch.name}</span>
              <span className="text-vv-body">{[ch.type ? TYPE_LABEL[ch.type] : null, ch.action ? ACTION_LABEL[ch.action] : null].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={run.isPending}>
          {plan?.applied ? 'Close' : 'Cancel'}
        </button>
        {plan && !plan.applied && plan.changes.length > 0 && (
          <button type="button" className={BTN_LIME} onClick={() => run.mutate(true)} disabled={run.isPending}>
            {run.isPending && <Spinner />}
            Fill {plan.changes.length} pages
          </button>
        )}
      </div>
    </Modal>
  )
}

/** Claude's draft for this page: shown with its own counters / checks; "Use this draft" fills the form (save approves). */
function DraftPanel({ siteId, draft, primary, stateAbbr, onUse }: { siteId: string; draft: HotspotDraft; primary: string | null; stateAbbr: string | null; onUse: () => void }) {
  const skip = useSkipHotspotDraft(siteId)
  const checks = hotspotChecks({ title: draft.seoTitle ?? '', meta: draft.metaDescription ?? '', h1: draft.h1 ?? '', url: draft.url ?? '', primary, state: stateAbbr })
  const warn = checks.filter((c) => !c.ok)
  const row = (label: string, value: string | null, range?: readonly [number, number]) => (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.05em] text-vv-body">
        {label} {range && value ? <Counter n={value.length} range={range} /> : null}
      </span>
      <span className="text-[14px] text-vv-ink">{value ?? '—'}</span>
    </div>
  )
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-solid border-vv-lavender bg-vv-lavender-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`${PILL} bg-vv-lavender-100 text-vv-purple-ink`}>Claude’s draft · Ready to review</span>
        <span className="text-[12px] text-vv-body">{warn.length ? `${warn.length} check${warn.length === 1 ? '' : 's'} to look at` : 'All checks pass'}</span>
      </div>
      {row('SEO title', draft.seoTitle, TITLE_RANGE)}
      {row('Meta description', draft.metaDescription, META_RANGE)}
      <div className="grid grid-cols-2 gap-3 phone:grid-cols-1">
        {row('H1', draft.h1)}
        {row('URL', draft.url)}
      </div>
      {(draft.opening || draft.closing) && (
        <div className="flex flex-col gap-1 text-[13px] text-vv-body">
          {draft.opening && <span><strong className="text-vv-ink">Opening:</strong> {draft.opening}</span>}
          {draft.closing && <span><strong className="text-vv-ink">Closing:</strong> {draft.closing}</span>}
        </div>
      )}
      {draft.notes && <span className="text-[13px] text-vv-orange-ink">Claude’s notes: {draft.notes}</span>}
      {warn.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[12px] text-vv-orange-ink">
          {warn.map((w) => (
            <li key={w.text}>! {w.text}</li>
          ))}
        </ul>
      )}
      {skip.error && <span className="text-[13px] font-semibold text-vv-red">{errText(skip.error, 'Couldn’t skip it.')}</span>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${BTN_LIME} min-h-10 px-4 text-[13px]`} onClick={onUse}>
          Use this draft
        </button>
        <button type="button" className={`${BTN_LINK} px-2`} onClick={() => skip.mutate(draft.pageId)} disabled={skip.isPending}>
          {skip.isPending && <Spinner />}
          Skip draft
        </button>
        <span className="text-[12px] text-vv-muted">“Use” fills the fields below; nothing is saved until you click Save hotspots.</span>
      </div>
    </div>
  )
}
