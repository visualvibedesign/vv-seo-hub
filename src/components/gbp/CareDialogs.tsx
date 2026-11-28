import { useState } from 'react'
import { useGbpCareWrite } from '../../hooks/useGbpCare'
import { ApiError } from '../../lib/api'
import { CHANNEL_LABEL, POST_BODY_MAX, POST_STATUS_LABEL, RESULT_LABEL, refProblem, utmLink } from '../../lib/gbpCare'
import { agencyDay } from '../../lib/agencyTime'
import { BTN_GHOST, BTN_LIME, BTN_LINK, FIELD, LABEL } from '../../lib/ui'
import type { CarePage, GbpPost, GbpProduct, PostStatus, ReviewChannel, ReviewRequest, ReviewResult } from '../../types/seo'
import ConfirmDialog from '../ui/ConfirmDialog'
import { Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// Phase 4b · GBP care popups: a product (one per service page), a review request (ref only), one week's post.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const today = () => agencyDay(new Date().toISOString())

function Buttons({ busy, onCancel, label, disabled = false, extra }: { busy: boolean; onCancel: () => void; label: string; disabled?: boolean; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {extra}
      <button type="button" className={`${BTN_LINK} px-3`} onClick={onCancel} disabled={busy}>
        Cancel
      </button>
      <button type="submit" className={BTN_LIME} disabled={busy || disabled}>
        {busy && <Spinner />}
        {label}
      </button>
    </div>
  )
}

// ---- Product ---------------------------------------------------------------------------------------------------

export function ProductDialog({ siteId, page, product, onClose }: { siteId: string; page: CarePage | null; product: GbpProduct | null; onClose: () => void }) {
  const save = useGbpCareWrite(siteId, 'gbp-product-save')
  const del = useGbpCareWrite(siteId, 'gbp-product-delete')
  const [asking, setAsking] = useState(false)
  const [f, setF] = useState({ name: product?.name ?? page?.name ?? '', description: product?.description ?? '', imageReady: product?.imageReady ?? false, status: product?.status ?? 'not_added' })
  const live = !page || page.status === 'live'
  return (
    <Modal open wide title={product ? 'Edit product' : 'Add product'} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ id: product?.id ?? null, pageId: page?.id ?? product?.pageId ?? null, ...f }, { onSuccess: onClose })
        }}
      >
        <p className="m-0 text-[13px] text-vv-body">
          Links to {page ? <strong>{page.code ? `${page.code} · ` : ''}{page.name}</strong> : 'its service page'}, not Home. 2–3 sentences taken from the real service page. Image: 720×720 real photo (not AI), content centered.
          {!live && ' This page isn’t live yet: add the product once it is.'}
        </p>
        <label className={LABEL}>
          Product name
          <input className={FIELD} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={120} required />
        </label>
        <label className={LABEL}>
          <span className="flex justify-between">
            Description <span>{f.description.length} / 1000</span>
          </span>
          <textarea className={`${FIELD} min-h-[110px]`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
        <div className="flex flex-wrap gap-5 text-[14px] text-vv-ink">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[#7C5CE6]" checked={f.imageReady} onChange={(e) => setF({ ...f, imageReady: e.target.checked })} />
            720×720 image ready
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[#7C5CE6]" checked={f.status === 'added'} onChange={(e) => setF({ ...f, status: e.target.checked ? 'added' : 'not_added' })} />
            Added on GBP
          </label>
        </div>
        {(save.error || del.error) && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error ?? del.error, 'Couldn’t save the product.')}</p>}
        <Buttons
          busy={save.isPending || del.isPending}
          onCancel={onClose}
          label="Save product"
          disabled={!f.name.trim()}
          extra={
            product && (
              <button type="button" className={`${BTN_GHOST} mr-auto !min-h-10 !px-4 text-vv-red`} onClick={() => setAsking(true)}>
                Remove
              </button>
            )
          }
        />
      </form>
      <ConfirmDialog open={asking} title={`Remove ${f.name}?`} body="It comes off this list (not off GBP)." confirmLabel="Remove" busy={del.isPending} onCancel={() => setAsking(false)} onConfirm={() => del.mutate({ id: product!.id }, { onSuccess: () => { setAsking(false); onClose() } })} />
    </Modal>
  )
}

// ---- Review request --------------------------------------------------------------------------------------------

export function RequestDialog({ siteId, request, onClose }: { siteId: string; request: ReviewRequest | null; onClose: () => void }) {
  const save = useGbpCareWrite(siteId, 'review-request-save')
  const del = useGbpCareWrite(siteId, 'review-request-delete')
  const [asking, setAsking] = useState(false)
  const [f, setF] = useState({ customerRef: request?.customerRef ?? '', askedOn: request?.askedOn ?? today(), channel: request?.channel ?? ('email' as ReviewChannel), result: request?.result ?? ('waiting' as ReviewResult), followUpOn: request?.followUpOn ?? '' })
  const problem = f.customerRef ? refProblem(f.customerRef) : null
  return (
    <Modal open title={request ? 'Edit review request' : 'Log a review request'} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ id: request?.id ?? null, ...f, followUpOn: f.followUpOn || null }, { onSuccess: onClose })
        }}
      >
        <p className="m-0 text-[13px] text-vv-body">The tracker keeps only a short ref, date, channel and result (+ one follow-up). Never a name, email or phone.</p>
        <label className={LABEL}>
          Customer ref
          <input className={FIELD} value={f.customerRef} onChange={(e) => setF({ ...f, customerRef: e.target.value })} maxLength={40} placeholder="e.g. Nov job #12" required />
          {problem && <span className="font-semibold text-vv-red">{problem}</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={LABEL}>
            Date asked
            <input className={FIELD} type="date" value={f.askedOn} onChange={(e) => setF({ ...f, askedOn: e.target.value })} required />
          </label>
          <label className={LABEL}>
            Channel
            <select className={FIELD} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as ReviewChannel })}>
              {(Object.keys(CHANNEL_LABEL) as ReviewChannel[]).map((k) => (
                <option key={k} value={k}>
                  {CHANNEL_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Result
            <select className={FIELD} value={f.result} onChange={(e) => setF({ ...f, result: e.target.value as ReviewResult })}>
              {(Object.keys(RESULT_LABEL) as ReviewResult[]).map((k) => (
                <option key={k} value={k}>
                  {RESULT_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            One follow-up (1–3 days)
            <input className={FIELD} type="date" value={f.followUpOn} onChange={(e) => setF({ ...f, followUpOn: e.target.value })} />
          </label>
        </div>
        {(save.error || del.error) && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error ?? del.error, 'Couldn’t save the request.')}</p>}
        <Buttons
          busy={save.isPending || del.isPending}
          onCancel={onClose}
          label={request ? 'Save' : 'Log it'}
          disabled={!!problem || !f.customerRef.trim()}
          extra={
            request && (
              <button type="button" className={`${BTN_GHOST} mr-auto !min-h-10 !px-4 text-vv-red`} onClick={() => setAsking(true)}>
                Remove
              </button>
            )
          }
        />
      </form>
      <ConfirmDialog open={asking} title={`Remove “${f.customerRef}”?`} confirmLabel="Remove" busy={del.isPending} onCancel={() => setAsking(false)} onConfirm={() => del.mutate({ id: request!.id }, { onSuccess: () => { setAsking(false); onClose() } })} />
    </Modal>
  )
}

// ---- One week's post -------------------------------------------------------------------------------------------

export function PostDialog({ siteId, post, quarterStart, pages, onClose }: { siteId: string; post: GbpPost; quarterStart: string; pages: CarePage[]; onClose: () => void }) {
  const save = useGbpCareWrite(siteId, 'gbp-post-save')
  const clear = useGbpCareWrite(siteId, 'gbp-post-clear')
  const [asking, setAsking] = useState(false)
  const [f, setF] = useState({ postOn: post.postOn ?? '', topic: post.topic ?? '', takeaway: post.takeaway ?? '', body: post.body ?? '', cta: post.cta, pageId: post.pageId ?? '', imageNeed: post.imageNeed ?? '', status: post.status })
  const page = pages.find((p) => p.id === f.pageId) ?? null
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal open wide title={`Week ${post.week}`} onClose={onClose}>
      <form
        className="flex max-h-[72vh] flex-col gap-3 overflow-y-auto pr-1 outline-none"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({ week: post.week, ...f, pageId: f.pageId || null, postOn: f.postOn || null }, { onSuccess: onClose })
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 phone-sm:grid-cols-1">
          <label className={LABEL}>
            Date
            <input className={FIELD} type="date" value={f.postOn} onChange={set('postOn')} />
          </label>
          <label className={LABEL}>
            Topic
            <input className={FIELD} value={f.topic} onChange={set('topic')} maxLength={120} />
          </label>
        </div>
        <label className={LABEL}>
          Takeaway (what the reader gets)
          <input className={FIELD} value={f.takeaway} onChange={set('takeaway')} maxLength={300} />
        </label>
        <label className={LABEL}>
          <span className="flex justify-between">
            Post text <span className={f.body.length > POST_BODY_MAX ? 'text-vv-red' : ''}>{f.body.length} / {POST_BODY_MAX}</span>
          </span>
          <textarea className={`${FIELD} min-h-[130px]`} value={f.body} onChange={set('body')} />
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 phone-sm:grid-cols-1">
          <label className={LABEL}>
            Button
            <input className={FIELD} value={f.cta} onChange={set('cta')} maxLength={40} />
          </label>
          <label className={LABEL}>
            Links to (a real page)
            <select className={FIELD} value={f.pageId} onChange={set('pageId')}>
              <option value="">No page yet</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} · ` : ''}
                  {p.name}
                  {p.status === 'live' ? '' : ' (not live yet)'}
                </option>
              ))}
            </select>
          </label>
        </div>
        {page && <p className="m-0 break-all text-[12px] text-vv-body">Link: {utmLink(page.url) ?? 'this page has no URL yet'}</p>}
        <label className={LABEL}>
          Image need (1200×900, real photo)
          <input className={FIELD} value={f.imageNeed} onChange={set('imageNeed')} maxLength={200} placeholder="e.g. team photo at a client site" />
        </label>
        <label className={LABEL}>
          Status
          <select className={FIELD} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as PostStatus })}>
            {(Object.keys(POST_STATUS_LABEL) as PostStatus[]).map((k) => (
              <option key={k} value={k}>
                {POST_STATUS_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {(save.error || clear.error) && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error ?? clear.error, 'Couldn’t save the post.')}</p>}
        <div className="sticky bottom-0 bg-vv-surface pt-2">
          <Buttons
            busy={save.isPending || clear.isPending}
            onCancel={onClose}
            label="Save week"
            disabled={f.body.length > POST_BODY_MAX}
            extra={
              post.id && (
                <button type="button" className={`${BTN_GHOST} mr-auto !min-h-10 !px-4 text-vv-red`} onClick={() => setAsking(true)}>
                  Clear week
                </button>
              )
            }
          />
        </div>
      </form>
      <ConfirmDialog open={asking} title={`Clear week ${post.week}?`} body="The topic, text and link for this week are removed." confirmLabel="Clear" busy={clear.isPending} onCancel={() => setAsking(false)} onConfirm={() => clear.mutate({ quarterStart, week: post.week }, { onSuccess: () => { setAsking(false); onClose() } })} />
    </Modal>
  )
}
