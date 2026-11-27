import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import { Bone, Spinner } from '../../components/ui/Loading'
import Modal from '../../components/ui/Modal'
import { useAddPage, useBackfillPages, usePages, useSaveHotspots, useSiteStructure } from '../../hooks/usePages'
import { ApiError } from '../../lib/api'
import { hotspotChecks, inRange, META_RANGE, slugPath, TITLE_RANGE } from '../../lib/hotspots'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, FIELD, LABEL, PILL, siteLabel } from '../../lib/ui'
import type { CategoryCode, PageAction, PagesState, PageType, SitePage, SiteStructure } from '../../types/seo'

// Strategy Builder › Day 5 · Sitemap + hotspots (/clients/{site id}/strategy/pages). Design: docs/design/Pages.png.
// One page per keyword cluster (the Clusters pages), each with a code (P1…), keep / improve / new and its SEO hotspots:
// title (50–60), meta description (150–160, ends with a call to action), H1, target URL, with live counters, checks
// (warnings only) and a Google preview. A live page moved to a new URL queues a redirect (Site plan). "Live now" from
// the site waits for the Vibe SEO connection. Claude drafts come in step 4; Push to site in phase 5; ClickUp later.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const STRUCTURE_LABEL: Record<SiteStructure, string> = { service_first: 'service first', location_first: 'location first', flat: 'flat' }
const TYPE_LABEL: Record<PageType, string> = { home: 'Home page', service: 'Service page', location: 'Location page', supporting: 'Supporting page' }
const ACTION_LABEL: Record<PageAction, string> = { keep: 'Keep', improve: 'Improve', new: 'New' }
const ACTION_TONE: Record<PageAction, string> = { keep: 'bg-vv-green-100 text-vv-green-ink', improve: 'bg-vv-lavender-100 text-vv-purple-ink', new: 'bg-vv-orange-100 text-vv-orange-ink' }
const primaryOf = (p: SitePage) => p.keywords.find((k) => k.role === 'primary')?.keyword ?? null

export default function SitemapPage() {
  const c = useClientContext()
  const q = usePages(c.siteId)
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const [filling, setFilling] = useState(false)
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
          <PageList pages={s.pages} selectedId={selected.id} onSelect={select} />
          <HotspotEditor key={`${selected.id}-${selected.hotspotsAt ?? ''}`} siteId={c.siteId} state={s} page={selected} />
        </div>
      )}

      {adding && s && <AddPage siteId={c.siteId} state={s} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); if (id) select(id) }} />}
      {filling && <Backfill siteId={c.siteId} onClose={() => setFilling(false)} />}
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

function PageList({ pages, selectedId, onSelect }: { pages: SitePage[]; selectedId: string; onSelect: (id: string) => void }) {
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
                  {p.hotspotsAt && <span className="text-[11px] text-vv-muted">hotspots saved</span>}
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

function HotspotEditor({ siteId, state, page }: { siteId: string; state: PagesState; page: SitePage }) {
  const save = useSaveHotspots(siteId)
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
        <span className={`${BTN_GHOST} pointer-events-none opacity-60`} title="Claude drafts the hotspots in the next step">
          Draft with Claude <span className={`${PILL} !py-0 !text-[11px] bg-vv-st-todo text-vv-st-todo-ink`}>Next step</span>
        </span>
        <span className={`${BTN_GHOST} pointer-events-none opacity-60`} title="Page briefs come in step 6">
          Open page brief ›
        </span>
        <span className={`${BTN_GHOST} pointer-events-none opacity-60`} title="Sending to the site needs the Vibe SEO plugin (phase 5)">
          Push to site (P5)
        </span>
      </div>
    </section>
  )
}

function AddPage({ siteId, state, onClose, onAdded }: { siteId: string; state: PagesState; onClose: () => void; onAdded: (id: string | null) => void }) {
  const add = useAddPage(siteId)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<CategoryCode>('S1')
  const [type, setType] = useState<PageType>('service')
  return (
    <Modal open title="Add a page" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const before = new Set(state.pages.map((p) => p.id))
          add.mutate({ name, category, type }, { onSuccess: (st) => onAdded(st.pages.find((p) => !before.has(p.id))?.id ?? null) })
        }}
      >
        <p className="m-0 text-[13px] text-vv-body">A planned page (New) with the next free code. Give it its keywords in Clusters (a keyword sits on one page only).</p>
        <label className={LABEL}>
          Page name
          <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Web Design · Springdale" required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={LABEL}>
            Category
            <select className={FIELD} value={category} onChange={(e) => setCategory(e.target.value as CategoryCode)}>
              {(['Home', 'S1', 'S2', 'S3', 'FAQ'] as CategoryCode[]).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Type
            <select className={FIELD} value={type} onChange={(e) => setType(e.target.value as PageType)}>
              {(Object.keys(TYPE_LABEL) as PageType[]).map((k) => (
                <option key={k} value={k}>
                  {TYPE_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {add.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(add.error, 'Couldn’t add the page.')}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={add.isPending}>
            Cancel
          </button>
          <button type="submit" className={BTN_LIME} disabled={add.isPending || !name.trim()}>
            {add.isPending && <Spinner />}
            Add page
          </button>
        </div>
      </form>
    </Modal>
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
