import { useState } from 'react'
import { useSearchParams } from 'react-router'
import PageCopyCard from '../../components/pages/PageCopyCard'
import { usePages } from '../../hooks/usePages'
import { useClientContext } from '../../components/layout/ClientLayout'
import { Bone, Spinner } from '../../components/ui/Loading'
import Modal from '../../components/ui/Modal'
import { useBrandEstimate, useBrandScript, useConfirmBrandScript, useDraftBrandScript, useSaveBrandScript, useSkipBrandDraft } from '../../hooks/useBrandScript'
import { formatUsd } from '../../lib/aiModels'
import { agencyDate } from '../../lib/agencyTime'
import { ApiError } from '../../lib/api'
import { BRAND_FIELDS } from '../../lib/brandscript'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, FIELD, PILL } from '../../lib/ui'
import type { BrandKey, BrandScript } from '../../types/seo'

// Strategy Builder › Day 6 · Page briefs (/clients/{site id}/strategy/briefs). Design: docs/design/Brief.png.
// Left: the BrandScript (StoryBrand A–P), written once per client and reused on every page, GBP post and social
// caption. Claude can draft it from Day 1 setup (estimate first, "Ready to review", unknown facts = [bracketed
// questions]); saving approves the draft; "Read aloud and confirmed" once the owner agrees (a changed answer clears it).
// Right: page copy per page (PageCopyCard): V1 / V2 StoryBrand sections + the Day 5 brief, Claude draft, Copy for Elementor.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
type Answers = Partial<Record<BrandKey, string>>

export default function BriefsPage() {
  const c = useClientContext()
  const q = useBrandScript(c.siteId)
  const pq = usePages(c.siteId)
  const [params, setParams] = useSearchParams()
  const pages = pq.data?.pages ?? []
  const pageId = params.get('page') ?? pages[0]?.id ?? null
  const pick = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('page', id)
    setParams(next, { replace: true })
  }
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Page <em className="font-medium text-vv-purple">brief.</em>
          </h1>
          <p className="m-0 text-[17px] leading-normal text-vv-body">Day 6 · BrandScript once per client, then StoryBrand copy per page · only real facts, [brackets] for the rest</p>
        </div>
      </header>

      {q.isPending && <Bone className="h-[520px] w-full rounded-[22px]" />}
      {q.isError && <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load the BrandScript. Try again in a moment.')}</p>}
      {q.data && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start gap-5 [@media(max-width:1100px)]:grid-cols-1">
          <BrandScriptCard key={`${q.data.updatedAt ?? ''}-${q.data.draft?.createdAt ?? ''}`} siteId={c.siteId} b={q.data} clientName={c.name} />
          <PageCopyCard siteId={c.siteId} pages={pages} pageId={pageId} onPick={pick} />
        </div>
      )}
    </>
  )
}

function BrandScriptCard({ siteId, b, clientName }: { siteId: string; b: BrandScript; clientName: string }) {
  const save = useSaveBrandScript(siteId)
  const confirm = useConfirmBrandScript(siteId)
  const skip = useSkipBrandDraft(siteId)
  const [v, setV] = useState<Answers>(b.answers)
  const [drafting, setDrafting] = useState(false)
  const filled = BRAND_FIELDS.filter((f) => (v[f.key] ?? '').trim()).length
  const dirty = BRAND_FIELDS.some((f) => (v[f.key] ?? '').trim() !== (b.answers[f.key] ?? ''))
  const draft = b.draft
  const useAll = () => setV({ ...v, ...Object.fromEntries(Object.entries(draft?.answers ?? {}).filter(([, x]) => !!x)) })

  return (
    <section className={`${CARD} !gap-4`} aria-labelledby="bs-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="bs-title" className="m-0 font-display text-[24px] font-semibold">
          BrandScript
        </h2>
        <span className="flex items-center gap-2 text-[14px] text-vv-body">
          {filled} of 16 filled
          {b.confirmedAt && !dirty && <span className={`${PILL} bg-vv-green-100 text-vv-green-ink`}>Confirmed {agencyDate(b.confirmedAt)}</span>}
        </span>
      </div>
      <p className="m-0 text-[14px] text-vv-body">Written once for {clientName}, reused on every page, GBP post and social caption.</p>

      {draft && (
        <div className="flex flex-col gap-2 rounded-[16px] border border-solid border-vv-lavender bg-vv-lavender-50 px-4 py-3 text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`${PILL} bg-vv-lavender-100 text-vv-purple-ink`}>Claude’s draft · Ready to review</span>
            <span className="flex flex-wrap gap-2">
              <button type="button" className={`${BTN_LIME} min-h-9 px-4 text-[13px]`} onClick={useAll}>
                Use all
              </button>
              <button type="button" className={`${BTN_LINK} px-2`} onClick={() => skip.mutate()} disabled={skip.isPending}>
                {skip.isPending && <Spinner />}
                Skip draft
              </button>
            </span>
          </div>
          <span className="text-vv-body">Each answer shows Claude’s version below it: “Use” copies it into the field. Nothing is saved until you click Save BrandScript (saving approves the draft). [Brackets] are questions for the owner.</span>
          {draft.notes && <span className="text-vv-orange-ink">Claude’s notes: {draft.notes}</span>}
          {skip.error && <span className="font-semibold text-vv-red">{errText(skip.error, 'Couldn’t skip it.')}</span>}
        </div>
      )}

      <ol className="m-0 flex list-none flex-col p-0">
        {BRAND_FIELDS.map((f) => {
          const val = v[f.key] ?? ''
          const d = draft?.answers[f.key]
          return (
            <li key={f.key} className="flex gap-3 border-0 border-t border-solid border-vv-line py-3 first:border-t-0">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-vv-lavender-100 text-[13px] font-bold text-vv-purple-deep">{f.key}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="flex items-baseline justify-between gap-2 text-[15px] font-semibold text-vv-ink" htmlFor={`bs-${f.key}`}>
                  {f.label}
                  <span className={`${PILL} !py-0.5 ${val.trim() ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-st-todo text-vv-st-todo-ink'}`}>{val.trim() ? 'Filled' : 'Empty'}</span>
                </label>
                <textarea id={`bs-${f.key}`} className={`${FIELD} min-h-[60px] resize-y !py-2 !text-[14px]`} rows={2} maxLength={600} value={val} placeholder={f.hint} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
                {d && d !== val && (
                  <div className="flex flex-wrap items-start gap-2 rounded-[12px] bg-vv-lavender-50 px-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 text-vv-body">
                      <strong className="text-vv-purple-deep">Claude:</strong> {d}
                    </span>
                    <button type="button" className={`${BTN_LINK} min-h-7 text-[12px]`} onClick={() => setV({ ...v, [f.key]: d })}>
                      Use
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {(save.error || confirm.error) && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error ?? confirm.error, 'Couldn’t save.')}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_LIME} onClick={() => save.mutate(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, (x ?? '').trim()])) as Answers)} disabled={save.isPending || !dirty}>
          {save.isPending && <Spinner />}
          {dirty ? 'Save BrandScript' : 'Saved'}
        </button>
        <button type="button" className={BTN_GHOST} onClick={() => setDrafting(true)} disabled={save.isPending}>
          {draft ? 'Draft again with Claude' : 'Draft with Claude'}
        </button>
        <label className={`flex items-center gap-2 text-[14px] ${dirty || !b.updatedAt ? 'text-vv-muted' : 'text-vv-ink'}`} title={dirty ? 'Save first' : 'Read it aloud with the owner; tick when they agree'}>
          <input type="checkbox" className="h-4 w-4 accent-vv-purple" checked={!!b.confirmedAt && !dirty} disabled={dirty || !b.updatedAt || confirm.isPending} onChange={(e) => confirm.mutate(e.target.checked)} />
          Read aloud and confirmed
        </label>
      </div>
      {drafting && <DraftDialog siteId={siteId} hasAnswers={filled > 0} onClose={() => setDrafting(false)} />}
    </section>
  )
}

function DraftDialog({ siteId, hasAnswers, onClose }: { siteId: string; hasAnswers: boolean; onClose: () => void }) {
  const est = useBrandEstimate(siteId, true)
  const run = useDraftBrandScript(siteId)
  return (
    <Modal open title="Draft the BrandScript with Claude" onClose={() => !run.isPending && onClose()}>
      <p className="m-0 text-[13px] text-vv-body">Claude drafts A–P from Day 1 setup: business name, site, city, services, areas, ideal client, what makes them different and 12-month success{hasAnswers ? ', keeping the facts in the answers already written' : ''}. It never invents services, prices, guarantees, reviews or results: anything unknown becomes a [bracketed question] for the owner. Never the address or account details.</p>
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
      <p className="m-0 text-[12px] text-vv-muted">Saved as “Ready to review” next to each answer. Logged in Settings › Claude usage.</p>
      {run.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(run.error, 'Claude couldn’t draft it.')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={run.isPending}>
          Cancel
        </button>
        <button type="button" className={BTN_LIME} onClick={() => run.mutate(undefined, { onSuccess: onClose })} disabled={run.isPending || !est.data}>
          {run.isPending && <Spinner />}
          {run.isPending ? 'Drafting…' : 'Draft now'}
        </button>
      </div>
    </Modal>
  )
}
