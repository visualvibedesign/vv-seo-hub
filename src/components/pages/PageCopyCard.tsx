import { useState } from 'react'
import { Link } from 'react-router'
import { useDraftPageCopy, usePageBrief, usePageCopyEstimate, useSavePageBrief, useSkipBriefDraft } from '../../hooks/usePageBrief'
import { formatUsd } from '../../lib/aiModels'
import { ApiError } from '../../lib/api'
import { SECTIONS, WORKSHEET } from '../../lib/brief'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, FIELD, PILL } from '../../lib/ui'
import type { BriefVersion, PageBrief, SectionKey, SectionStatus, SitePage, WorksheetKey } from '../../types/seo'
import { Bone, Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// Phase 3 step 6 · Page briefs › page copy for one page: V1 (hotspots + header and footer) or V2 (all 11 StoryBrand
// sections), the Day 5 brief fields, Claude's draft (cost first, "Ready to review"; saving approves it) and "Copy for
// Elementor" (clean text of the current version, in order, to paste into the page builder).

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const STATUS_LABEL: Record<SectionStatus, string> = { to_write: 'To write', drafted: 'Drafted', done: 'Done' }
const STATUS_TONE: Record<SectionStatus, string> = { to_write: 'bg-vv-orange-100 text-vv-orange-ink', drafted: 'bg-vv-lavender-100 text-vv-purple-ink', done: 'bg-vv-green-100 text-vv-green-ink' }
type SecState = Partial<Record<SectionKey, { text: string; status: SectionStatus }>>
type WsState = Partial<Record<WorksheetKey, string>>

export default function PageCopyCard({ siteId, pages, pageId, onPick }: { siteId: string; pages: SitePage[]; pageId: string | null; onPick: (id: string) => void }) {
  const q = usePageBrief(siteId, pageId)
  return (
    <section className={`${CARD} !gap-4`} aria-labelledby="copy-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="copy-title" className="m-0 font-display text-[24px] font-semibold">
          Page copy
        </h2>
        <select aria-label="Page" className="max-w-[260px] rounded-full border border-solid border-vv-field-line bg-vv-surface px-3 py-1.5 font-body text-[14px] font-semibold text-vv-ink" value={pageId ?? ''} onChange={(e) => onPick(e.target.value)}>
          {!pageId && <option value="">Pick a page</option>}
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code ?? ''} {p.name}
            </option>
          ))}
        </select>
      </div>
      {!pageId ? (
        <p className="m-0 text-[14px] text-vv-body">Pick a page to write its brief and copy.</p>
      ) : q.isPending ? (
        <Bone className="h-[420px] w-full rounded-2xl" />
      ) : q.isError || !q.data ? (
        <p className="m-0 text-[14px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load the brief.')}</p>
      ) : (
        <Editor key={`${q.data.page.id}-${q.data.updatedAt ?? ''}-${q.data.draft?.createdAt ?? ''}`} siteId={siteId} b={q.data} />
      )}
    </section>
  )
}

function Editor({ siteId, b }: { siteId: string; b: PageBrief }) {
  const save = useSavePageBrief(siteId)
  const skip = useSkipBriefDraft(siteId)
  const [version, setVersion] = useState<BriefVersion>(b.draft?.version ?? b.version)
  const [sec, setSec] = useState<SecState>(b.sections)
  const [ws, setWs] = useState<WsState>(b.worksheet)
  const [drafting, setDrafting] = useState(false)
  const [copied, setCopied] = useState(false)
  const draft = b.draft
  const shown = SECTIONS.filter((s) => version === 'v2' || s.v1)
  const dirty = version !== b.version || JSON.stringify(sec) !== JSON.stringify(b.sections) || JSON.stringify(ws) !== JSON.stringify(b.worksheet)
  const setText = (k: SectionKey, text: string) => setSec({ ...sec, [k]: { text, status: sec[k]?.status === 'done' ? 'done' : text.trim() ? 'drafted' : 'to_write' } })
  const setStatus = (k: SectionKey, status: SectionStatus) => setSec({ ...sec, [k]: { text: sec[k]?.text ?? '', status } })
  const useAll = () => {
    if (!draft) return
    const next = { ...sec }
    for (const [k, t] of Object.entries(draft.sections)) if (t) next[k as SectionKey] = { text: t, status: 'drafted' }
    setSec(next)
    setWs({ ...ws, ...Object.fromEntries(Object.entries(draft.worksheet).filter(([, x]) => !!x)) })
    setVersion(draft.version)
  }
  const copy = async () => {
    const text = shown
      .filter((s) => sec[s.key]?.text?.trim())
      .map((s) => `${s.key}. ${s.label}\n${sec[s.key]!.text.trim()}`)
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy the page copy:', text)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-vv-lavender-50 p-1" role="group" aria-label="Version">
          {(['v1', 'v2'] as BriefVersion[]).map((x) => (
            <button key={x} type="button" aria-pressed={version === x} onClick={() => setVersion(x)} className={`rounded-full border-0 px-4 py-1.5 font-body text-[14px] font-semibold ${version === x ? 'bg-vv-lavender text-vv-ink' : 'bg-transparent text-vv-body'}`}>
              {x === 'v1' ? 'V1 · hotspots' : 'V2 · full copy'}
            </button>
          ))}
        </div>
        <span className="text-[13px] text-vv-body">{version === 'v1' ? 'Hotspots + header and footer: can lift a page to pages 3–5' : 'All 11 StoryBrand sections'}</span>
      </div>

      <div className="flex flex-col gap-1 rounded-[16px] bg-vv-lavender-50 px-4 py-3 text-[13px]">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <strong className="text-[12px] uppercase tracking-[0.05em] text-vv-body">Hotspots</strong>
          <Link to={`/clients/${siteId}/strategy/pages?page=${b.page.id}`} className="text-[12px] font-semibold text-vv-purple-deep">
            Edit on Sitemap + hotspots ›
          </Link>
        </span>
        <span>
          <strong>Title:</strong> {b.page.seoTitle ?? <em className="text-vv-muted">not set yet</em>}
        </span>
        <span>
          <strong>Meta:</strong> {b.page.metaDescription ?? <em className="text-vv-muted">not set yet</em>}
        </span>
        <span>
          <strong>H1:</strong> {b.page.h1 ?? <em className="text-vv-muted">not set yet</em>} · <strong>URL:</strong> {b.page.url ?? '—'}
        </span>
      </div>
      {(b.brandFilled < 16 || !b.brandConfirmed) && (
        <p className="m-0 rounded-[12px] bg-vv-orange-100 px-3 py-2 text-[13px] text-vv-orange-ink">
          Claude writes from the BrandScript: {b.brandFilled} of 16 filled{b.brandConfirmed ? '' : ', not confirmed yet'}. Gaps become [placeholders].
        </p>
      )}

      {draft && (
        <div className="flex flex-col gap-2 rounded-[16px] border border-solid border-vv-lavender bg-vv-lavender-50 px-4 py-3 text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`${PILL} bg-vv-lavender-100 text-vv-purple-ink`}>Claude’s {draft.version.toUpperCase()} draft · Ready to review</span>
            <span className="flex flex-wrap gap-2">
              <button type="button" className={`${BTN_LIME} min-h-9 px-4 text-[13px]`} onClick={useAll}>
                Use all
              </button>
              <button type="button" className={`${BTN_LINK} px-2`} onClick={() => skip.mutate(b.page.id)} disabled={skip.isPending}>
                {skip.isPending && <Spinner />}
                Skip draft
              </button>
            </span>
          </div>
          <span className="text-vv-body">Claude’s version shows under each section and brief field: “Use” copies it in. Nothing is saved until Save brief (saving approves the draft).</span>
          {draft.notes && <span className="whitespace-pre-wrap text-vv-orange-ink">Claude’s notes: {draft.notes}</span>}
          {skip.error && <span className="font-semibold text-vv-red">{errText(skip.error, 'Couldn’t skip it.')}</span>}
        </div>
      )}

      <details className="rounded-[16px] border border-solid border-vv-line px-4 py-3" open={Object.keys(b.worksheet).length === 0 && !!draft}>
        <summary className="cursor-pointer text-[14px] font-semibold text-vv-ink">Page brief (Day 5) · {Object.values(ws).filter((x) => x?.trim()).length} of {WORKSHEET.length} filled</summary>
        <div className="mt-3 flex flex-col gap-3">
          {WORKSHEET.map((w) => {
            const d = draft?.worksheet[w.key]
            const val = ws[w.key] ?? ''
            return (
              <label key={w.key} className="flex flex-col gap-1 text-[13px] font-semibold text-vv-body">
                {w.label}
                <textarea className={`${FIELD} min-h-[52px] resize-y !py-2 !text-[14px]`} rows={2} maxLength={800} value={val} placeholder={w.hint} onChange={(e) => setWs({ ...ws, [w.key]: e.target.value })} />
                {d && d !== val && (
                  <span className="flex items-start gap-2 rounded-[10px] bg-vv-lavender-50 px-3 py-1.5 font-normal text-vv-body">
                    <span className="min-w-0 flex-1">
                      <strong className="text-vv-purple-deep">Claude:</strong> {d}
                    </span>
                    <button type="button" className={`${BTN_LINK} min-h-6 text-[12px]`} onClick={() => setWs({ ...ws, [w.key]: d })}>
                      Use
                    </button>
                  </span>
                )}
              </label>
            )
          })}
        </div>
      </details>

      <ol className="m-0 flex list-none flex-col p-0">
        {SECTIONS.map((s) => {
          const on = version === 'v2' || s.v1
          const val = sec[s.key]?.text ?? ''
          const st = sec[s.key]?.status ?? 'to_write'
          const d = draft?.sections[s.key]
          return (
            <li key={s.key} className={`flex gap-3 border-0 border-t border-solid border-vv-line py-3 first:border-t-0 ${on ? '' : 'opacity-60'}`}>
              <span className="w-7 flex-none font-display text-[22px] font-semibold leading-none text-vv-purple">{s.key}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold text-vv-ink">{s.label}</span>
                  {on ? (
                    <select aria-label={`${s.label} status`} className={`${PILL} cursor-pointer border-0 font-body ${STATUS_TONE[st]}`} value={st} onChange={(e) => setStatus(s.key, e.target.value as SectionStatus)}>
                      {(Object.keys(STATUS_LABEL) as SectionStatus[]).map((k) => (
                        <option key={k} value={k}>
                          {STATUS_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`${PILL} bg-vv-st-todo text-vv-st-todo-ink`}>V2 only</span>
                  )}
                </div>
                <span className="text-[13px] text-vv-body">{s.hint}</span>
                {on && <textarea aria-label={s.label} className={`${FIELD} min-h-[72px] resize-y !py-2 !text-[14px]`} rows={3} maxLength={3000} value={val} onChange={(e) => setText(s.key, e.target.value)} />}
                {on && d && d !== val && (
                  <div className="flex items-start gap-2 rounded-[12px] bg-vv-lavender-50 px-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 whitespace-pre-wrap text-vv-body">
                      <strong className="text-vv-purple-deep">Claude:</strong> {d}
                    </span>
                    <button type="button" className={`${BTN_LINK} min-h-7 text-[12px]`} onClick={() => setText(s.key, d)}>
                      Use
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {save.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save the brief.')}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_LIME} onClick={() => save.mutate({ pageId: b.page.id, version, worksheet: ws, sections: sec })} disabled={save.isPending || !dirty}>
          {save.isPending && <Spinner />}
          {dirty ? 'Save brief' : 'Saved'}
        </button>
        <button type="button" className={BTN_GHOST} onClick={() => setDrafting(true)} disabled={save.isPending}>
          {draft ? 'Draft again with Claude' : 'Draft with Claude'}
        </button>
        <button type="button" className={BTN_GHOST} onClick={() => void copy()} disabled={!shown.some((s) => sec[s.key]?.text?.trim())}>
          {copied ? 'Copied' : 'Copy for Elementor'}
        </button>
      </div>
      {drafting && <DraftDialog siteId={siteId} pageId={b.page.id} pageName={`${b.page.code ?? ''} ${b.page.name}`} version={version} onClose={() => setDrafting(false)} />}
    </div>
  )
}

function DraftDialog({ siteId, pageId, pageName, version, onClose }: { siteId: string; pageId: string; pageName: string; version: BriefVersion; onClose: () => void }) {
  const est = usePageCopyEstimate(siteId, pageId, version, true)
  const run = useDraftPageCopy(siteId)
  return (
    <Modal open title={`Draft ${version.toUpperCase()} copy with Claude`} onClose={() => !run.isPending && onClose()}>
      <p className="m-0 text-[13px] text-vv-body">
        For <strong>{pageName}</strong>: {version === 'v1' ? 'the header and footer' : 'all 11 StoryBrand sections'} plus the page brief, from the BrandScript, the page’s keywords and hotspots and the other pages (for internal links). Only real facts: reviews, prices, years and the like stay [placeholders]. Never the address or account details.
      </p>
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
      <p className="m-0 text-[12px] text-vv-muted">Saved as “Ready to review” under each section. Logged in Settings › Claude usage.</p>
      {run.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(run.error, 'Claude couldn’t draft it.')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={run.isPending}>
          Cancel
        </button>
        <button type="button" className={BTN_LIME} onClick={() => run.mutate({ pageId, version }, { onSuccess: onClose })} disabled={run.isPending || !est.data}>
          {run.isPending && <Spinner />}
          {run.isPending ? 'Drafting…' : 'Draft now'}
        </button>
      </div>
    </Modal>
  )
}
