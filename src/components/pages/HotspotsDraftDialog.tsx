import { useState } from 'react'
import { useDraftHotspots, useHotspotsEstimate } from '../../hooks/usePages'
import { formatUsd } from '../../lib/aiModels'
import { ApiError } from '../../lib/api'
import { BTN_LIME, BTN_LINK } from '../../lib/ui'
import type { PagesState } from '../../types/seo'
import { Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// Phase 3 step 4 · "Draft with Claude" on Sitemap + hotspots: pick the pages, see the cost, then one Claude call drafts
// title, meta, H1, URL (+ an opening and a closing line) for each. Drafts are "Ready to review": nothing on a page
// changes until its hotspots are saved. Up to 12 pages at a time.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const MAX = 12

export default function HotspotsDraftDialog({ siteId, state, start, onClose }: { siteId: string; state: PagesState; start: string[]; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>(start.slice(0, MAX))
  const [asked, setAsked] = useState(false)
  const est = useHotspotsEstimate(siteId, picked, asked)
  const draft = useDraftHotspots(siteId)
  const toggle = (id: string) => {
    setAsked(false)
    setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < MAX ? [...picked, id] : picked)
  }
  const drafted = new Set(state.drafts.map((d) => d.pageId))
  return (
    <Modal open title="Draft hotspots with Claude" onClose={() => !draft.isPending && onClose()} wide>
      <p className="m-0 text-[13px] text-vv-body">Claude drafts the SEO title, meta description, H1 and URL (plus an opening and a closing line) from each page’s keywords, the site structure and the Hotspots template. Unknown facts stay in [brackets]. Drafts wait for your review: a page only changes when you save its hotspots.</p>
      <ul className="m-0 flex max-h-[260px] list-none flex-col gap-1 overflow-auto rounded-xl bg-vv-lavender-50 p-2 text-[14px]">
        {state.pages.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-vv-surface">
              <input type="checkbox" className="h-4 w-4 accent-vv-purple" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} disabled={draft.isPending} />
              <strong className="w-8">{p.code ?? '·'}</strong>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="text-[12px] text-vv-muted">{drafted.has(p.id) ? 'draft open' : p.hotspotsAt ? 'has hotspots' : ''}</span>
            </label>
          </li>
        ))}
      </ul>
      <span className="text-[12px] text-vv-muted">
        {picked.length} of {MAX} max picked. A page that already has a draft gets a new one.
      </span>
      <div className="rounded-xl bg-vv-lavender-50 px-3 py-2.5 text-[13px]">
        {!asked ? (
          <button type="button" className={`${BTN_LINK} min-h-8 text-[13px]`} onClick={() => setAsked(true)} disabled={!picked.length}>
            Work out the cost for {picked.length} page{picked.length === 1 ? '' : 's'}
          </button>
        ) : est.isPending ? (
          <span className="flex items-center gap-2 text-vv-body">
            <Spinner /> Working out the cost…
          </span>
        ) : est.isError || !est.data ? (
          <span className="font-semibold text-vv-red">{errText(est.error, 'Couldn’t work out the cost.')}</span>
        ) : (
          <span>
            <strong>{est.data.model}</strong> · {est.data.pages} pages · about {est.data.inputTokens.toLocaleString('en-US')} tokens in, up to {est.data.outputTokens.toLocaleString('en-US')} out · about <strong>{formatUsd(est.data.costUsd)}</strong>
          </span>
        )}
      </div>
      <p className="m-0 text-[12px] text-vv-muted">Logged in Settings › Claude usage. Takes up to a minute or two for many pages.</p>
      {draft.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(draft.error, 'Claude couldn’t draft the hotspots.')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={draft.isPending}>
          Cancel
        </button>
        <button type="button" className={BTN_LIME} onClick={() => draft.mutate(picked, { onSuccess: onClose })} disabled={draft.isPending || !asked || !est.data || !picked.length}>
          {draft.isPending && <Spinner />}
          {draft.isPending ? 'Drafting…' : `Draft ${picked.length} page${picked.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </Modal>
  )
}
