import { useEffect, useState } from 'react'
import { useCareDraft, useCareEstimate, useGbpCareWrite } from '../../hooks/useGbpCare'
import { formatUsd } from '../../lib/aiModels'
import { agencyDateTime } from '../../lib/agencyTime'
import { ApiError } from '../../lib/api'
import { POST_BODY_MAX } from '../../lib/gbpCare'
import { BTN_GHOST, BTN_LIME, BTN_LINK, FIELD } from '../../lib/ui'
import type { CarePage, GbpCareState, PostsDraft, ProductDraft } from '../../types/seo'
import { Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// 4b step 4 · Claude drafts on GBP care: a run popup (cost first, then one call) and a review popup per draft.
// Nothing changes until "Use …" (kept items go through the normal saves); "Skip draft" drops it.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const cell = `${FIELD} !rounded-xl !px-3 !py-2 !text-[14px]`

// ---- Run (estimate → draft) -------------------------------------------------------------------------------------

export function DraftRunDialog({ siteId, kind, onClose, onDone }: { siteId: string; kind: 'products' | 'posts'; onClose: () => void; onDone: () => void }) {
  const est = useCareEstimate(siteId, kind)
  const run = useCareDraft(siteId, kind)
  const [full, setFull] = useState<3 | 13>(3)
  const { mutate } = est
  useEffect(() => mutate(kind === 'posts' ? { fullWeeks: full } : {}), [mutate, kind, full])
  return (
    <Modal open wide title={kind === 'products' ? 'Draft product descriptions' : 'Draft 13 weeks of posts'} onClose={() => !run.isPending && onClose()}>
      <p className="m-0 text-[13px] text-vv-body">
        {kind === 'products'
          ? 'Claude writes 2–3 sentences per service page from the page’s facts (keyword, hotspots, page brief) and the BrandScript. Unknown details come back as [bracketed questions]; no prices or claims are made up.'
          : 'Claude plans 13 weeks from the GBP posts template, your live pages (the only pages a post links to), the BrandScript and last quarter’s topics. Weeks already Approved, Scheduled or Live are kept.'}
      </p>
      {kind === 'posts' && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="How much to write">
          {([3, 13] as const).map((n) => (
            <button key={n} type="button" aria-pressed={full === n} onClick={() => setFull(n)} className={`rounded-full border border-solid px-4 py-2 font-body text-[14px] font-semibold ${full === n ? 'border-vv-lavender bg-vv-lavender text-vv-ink' : 'border-vv-line bg-vv-surface text-vv-body'}`}>
              {n === 3 ? 'Write weeks 1–3, plan the rest (Sam)' : 'Write all 13'}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-xl bg-vv-lavender-50 px-3 py-2.5 text-[13px]">
        {est.isPending ? (
          <span className="flex items-center gap-2 text-vv-body">
            <Spinner /> Working out the cost…
          </span>
        ) : est.isError || !est.data ? (
          <span className="font-semibold text-vv-red">{errText(est.error, 'Couldn’t work out the cost.')}</span>
        ) : (
          <span>
            <strong>{est.data.model}</strong> · about {est.data.inputTokens.toLocaleString('en-US')} tokens in, up to {est.data.outputTokens.toLocaleString('en-US')} out · about <strong>{formatUsd(est.data.costUsd)}</strong>
          </span>
        )}
      </div>
      <p className="m-0 text-[12px] text-vv-muted">Saved as “Ready to review”: nothing changes until you check it. Logged in Settings › Claude usage.</p>
      {run.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(run.error, 'Claude couldn’t draft it.')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={run.isPending}>
          Cancel
        </button>
        <button type="button" className={BTN_LIME} disabled={run.isPending || !est.data} onClick={() => run.mutate(kind === 'posts' ? { fullWeeks: full } : {}, { onSuccess: onDone })}>
          {run.isPending && <Spinner />}
          {run.isPending ? 'Drafting…' : 'Draft it'}
        </button>
      </div>
    </Modal>
  )
}

function Footer({ busy, kept, label, onSkip, onLater, onUse, error }: { busy: boolean; kept: number; label: string; onSkip: () => void; onLater: () => void; onUse: () => void; error: unknown }) {
  return (
    <>
      {error ? <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(error, 'Couldn’t save.')}</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" className={`${BTN_GHOST} mr-auto !min-h-10 !px-4`} disabled={busy} onClick={onSkip}>
          Skip draft
        </button>
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onLater} disabled={busy}>
          Later
        </button>
        <button type="button" className={BTN_LIME} disabled={busy || !kept} onClick={onUse}>
          {busy && <Spinner />}
          {label}
        </button>
      </div>
    </>
  )
}

const Notes = ({ notes }: { notes: string | null }) =>
  notes ? (
    <details className="rounded-xl bg-vv-st-waiting px-3 py-2 text-[13px] text-vv-st-waiting-ink">
      <summary className="cursor-pointer font-semibold">Claude’s notes: questions for the owner + missing inputs</summary>
      <p className="m-0 mt-1.5 whitespace-pre-line">{notes}</p>
    </details>
  ) : null

// ---- Products review --------------------------------------------------------------------------------------------

export function ProductDraftReview({ siteId, draft, s, onClose }: { siteId: string; draft: ProductDraft; s: GbpCareState; onClose: () => void }) {
  const use = useGbpCareWrite(siteId, 'gbp-products-approve')
  const skip = useGbpCareWrite(siteId, 'gbp-draft-skip')
  const [rows, setRows] = useState(() => draft.items.map((i) => ({ ...i, keep: true })))
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const kept = rows.filter((r) => r.keep)
  const busy = use.isPending || skip.isPending
  return (
    <Modal open wide="xl" title="Check the product descriptions" onClose={() => !busy && onClose()}>
      <div className="flex max-h-[68vh] flex-col gap-3 overflow-y-auto pr-1 outline-none">
        <p className="m-0 text-[13px] text-vv-body">Drafted {agencyDateTime(draft.createdAt)}. Answer or remove every [bracketed question] before it goes on GBP. Using a description fills that page’s product (image and “Added” ticks stay as they are).</p>
        <Notes notes={draft.notes} />
        {rows.map((r, i) => {
          const page = s.servicePages.find((p) => p.id === r.pageId)
          return (
            <div key={r.pageId} className={`flex flex-col gap-2 rounded-2xl border border-solid p-3 ${r.keep ? 'border-vv-lavender' : 'border-vv-line opacity-60'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <input type="checkbox" aria-label={`Use ${r.name}`} className="h-4 w-4 accent-[#7C5CE6]" checked={r.keep} onChange={(e) => set(i, { keep: e.target.checked })} />
                <strong className="text-[13px] text-vv-purple">{r.code}</strong>
                <input className={`${cell} min-w-0 flex-1`} aria-label="Product name" value={r.name} maxLength={120} onChange={(e) => set(i, { name: e.target.value })} />
                {page && page.status !== 'live' && <span className="text-[12px] font-semibold text-vv-st-waiting-ink">page not live yet</span>}
              </div>
              {r.keep && <textarea className={`${cell} min-h-[80px]`} aria-label="Description" value={r.description} onChange={(e) => set(i, { description: e.target.value })} />}
            </div>
          )
        })}
      </div>
      <Footer
        busy={busy}
        kept={kept.length}
        label={`Use ${kept.length} description${kept.length === 1 ? '' : 's'}`}
        error={use.error ?? skip.error}
        onLater={onClose}
        onSkip={() => skip.mutate({ kind: 'gbp_products' }, { onSuccess: onClose })}
        onUse={() => use.mutate({ id: draft.id, items: kept.map((r) => ({ pageId: r.pageId, name: r.name, description: r.description })) }, { onSuccess: onClose })}
      />
    </Modal>
  )
}

// ---- Posts review -----------------------------------------------------------------------------------------------

export function PostsDraftReview({ siteId, draft, s, onClose }: { siteId: string; draft: PostsDraft; s: GbpCareState; onClose: () => void }) {
  const use = useGbpCareWrite(siteId, 'gbp-posts-approve')
  const skip = useGbpCareWrite(siteId, 'gbp-draft-skip')
  const locked = new Set(s.posts.filter((p) => ['approved', 'scheduled', 'live'].includes(p.status)).map((p) => p.week))
  const [rows, setRows] = useState(() => draft.weeks.map((w) => ({ ...w, body: w.body ?? '', takeaway: w.takeaway ?? '', imageNeed: w.imageNeed ?? '', pageId: w.pageId ?? '', keep: !locked.has(w.week) })))
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const kept = rows.filter((r) => r.keep)
  const busy = use.isPending || skip.isPending
  const live: CarePage[] = s.pages.filter((p) => p.status === 'live')
  return (
    <Modal open wide="xl" title="Check the 13-week plan" onClose={() => !busy && onClose()}>
      <div className="flex max-h-[68vh] flex-col gap-3 overflow-y-auto pr-1 outline-none">
        <p className="m-0 text-[13px] text-vv-body">Drafted {agencyDateTime(draft.createdAt)}. Weeks with text become “Drafted”; plan-only weeks keep their topic (Not drafted). Answer or remove every [bracketed question] before scheduling.</p>
        <Notes notes={draft.notes} />
        {rows.map((r, i) => (
          <div key={r.week} className={`flex flex-col gap-2 rounded-2xl border border-solid p-3 ${r.keep ? 'border-vv-lavender' : 'border-vv-line opacity-60'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <input type="checkbox" aria-label={`Use week ${r.week}`} className="h-4 w-4 accent-[#7C5CE6]" checked={r.keep} disabled={locked.has(r.week)} onChange={(e) => set(i, { keep: e.target.checked })} />
              <strong className="w-16 text-[13px] text-vv-purple">Week {r.week}</strong>
              <input className={`${cell} min-w-0 flex-1 basis-[200px]`} aria-label="Topic" value={r.topic} maxLength={120} onChange={(e) => set(i, { topic: e.target.value })} />
              <select className={`${cell} !w-auto max-w-[240px]`} aria-label="Links to" value={r.pageId} onChange={(e) => set(i, { pageId: e.target.value })}>
                <option value="">No page</option>
                {live.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code ? `${p.code} · ` : ''}
                    {p.name}
                  </option>
                ))}
              </select>
              {locked.has(r.week) && <span className="text-[12px] font-semibold text-vv-body">already approved: kept</span>}
            </div>
            {r.keep && (
              <>
                <input className={cell} aria-label="Takeaway" placeholder="Takeaway" value={r.takeaway} maxLength={300} onChange={(e) => set(i, { takeaway: e.target.value })} />
                <textarea className={`${cell} ${r.body ? 'min-h-[110px]' : 'min-h-[44px]'}`} aria-label="Post text" placeholder="Plan only (text batched later)" value={r.body} onChange={(e) => set(i, { body: e.target.value })} />
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-vv-body">
                  <span>Image: {r.imageNeed || '—'}</span>
                  <span className={r.body.length > POST_BODY_MAX ? 'font-semibold text-vv-red' : ''}>
                    {r.body.length} / {POST_BODY_MAX}
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <Footer
        busy={busy}
        kept={kept.length}
        label={`Use ${kept.length} week${kept.length === 1 ? '' : 's'}`}
        error={use.error ?? skip.error}
        onLater={onClose}
        onSkip={() => skip.mutate({ kind: 'gbp_posts' }, { onSuccess: onClose })}
        onUse={() => use.mutate({ id: draft.id, weeks: kept.map((r) => ({ week: r.week, topic: r.topic, pageId: r.pageId || null, body: r.body || null, takeaway: r.takeaway || null, imageNeed: r.imageNeed || null })) }, { onSuccess: onClose })}
      />
    </Modal>
  )
}
