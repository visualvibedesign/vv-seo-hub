import { useState } from 'react'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import { PostDialog, ProductDialog, RequestDialog } from '../../components/gbp/CareDialogs'
import { DraftRunDialog, PostsDraftReview, ProductDraftReview } from '../../components/gbp/CareDrafts'
import { Bone, Spinner } from '../../components/ui/Loading'
import { useGbpCare, useGbpCareWrite } from '../../hooks/useGbpCare'
import { agencyDate, agencyDay } from '../../lib/agencyTime'
import { ApiError } from '../../lib/api'
import { CARE_ROUTINE, CHANNEL_LABEL, POST_STATUS_LABEL, RESULT_LABEL } from '../../lib/gbpCare'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, CARD_TITLE, FIELD, LABEL, PILL } from '../../lib/ui'
import type { CarePage, GbpCareState, GbpPost, GbpProduct, PostStatus, ReviewRequest, ReviewResult } from '../../types/seo'

// Strategy Builder › Day 7 · GBP care (/clients/{site id}/strategy/gbp-care). Design: docs/design/GBPCare.png.
// Products (one per service page, linking to it, not Home), reviews (target per round, the review email from the
// client's template, a tracker that keeps only ref / date / channel / result), a 13-week post calendar and the care
// routine. Claude drafts product descriptions and the 13 weeks (CareDrafts.tsx): cost first, then "Ready to review".

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const day = (d: string | null) => (d ? agencyDate(d) : '—')
const today = () => agencyDay(new Date().toISOString())

const RESULT_TONE: Record<ReviewResult, string> = {
  waiting: 'bg-vv-st-todo text-vv-st-todo-ink',
  reviewed: 'bg-vv-st-done text-vv-st-done-ink',
  no_reply: 'bg-vv-st-waiting text-vv-st-waiting-ink',
  declined: 'bg-vv-lavender-100 text-vv-purple-ink',
}
const POST_TONE: Record<PostStatus, string> = {
  not_drafted: 'text-vv-body',
  drafted: 'text-vv-purple-ink',
  approved: 'font-semibold text-vv-ink',
  scheduled: 'font-semibold text-vv-ink',
  live: 'font-bold text-vv-ink',
}

export default function GbpCarePage() {
  const c = useClientContext()
  const q = useGbpCare(c.siteId)
  const s = q.data
  const [running, setRunning] = useState<'products' | 'posts' | null>(null)
  const [reviewing, setReviewing] = useState<'products' | 'posts' | null>(null)
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Keep the profile <em className="font-medium text-vv-purple">alive.</em>
          </h1>
          <p className="m-0 text-[17px] leading-normal text-vv-body">Day 7 · products, reviews, a quarter of posts · from the GBP templates</p>
        </div>
        <HeaderTools>
          <button type="button" className={BTN_LIME} disabled={!s?.care.postsStartOn || !!s?.postsDraft} onClick={() => setRunning('posts')} title={s?.care.postsStartOn ? 'Claude plans the quarter (Ready to review)' : 'Pick week 1’s date in the Post calendar first'}>
            Draft 13 weeks
          </button>
        </HeaderTools>
      </header>

      {q.isPending && <Bone className="h-[420px] w-full rounded-[22px]" />}
      {q.isError && <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load GBP care. Try again in a moment.')}</p>}

      {s?.productDraft && <DraftBanner text={`Claude drafted ${s.productDraft.items.length} product descriptions`} onOpen={() => setReviewing('products')} />}
      {s?.postsDraft && <DraftBanner text={`Claude planned ${s.postsDraft.weeks.length} weeks (${s.postsDraft.weeks.filter((w) => w.body).length} written)`} onOpen={() => setReviewing('posts')} />}

      {s && (
        <>
          <Products s={s} siteId={c.siteId} onDraft={() => setRunning('products')} />
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-5 [@media(max-width:1100px)]:grid-cols-1">
            <div className="flex min-w-0 flex-col gap-5">
              <Reviews s={s} siteId={c.siteId} />
              <Routine s={s} siteId={c.siteId} />
            </div>
            <Posts s={s} siteId={c.siteId} />
          </div>
        </>
      )}

      {running && (
        <DraftRunDialog
          siteId={c.siteId}
          kind={running}
          onClose={() => setRunning(null)}
          onDone={() => {
            setReviewing(running)
            setRunning(null)
          }}
        />
      )}
      {reviewing === 'products' && s?.productDraft && <ProductDraftReview key={s.productDraft.id} siteId={c.siteId} draft={s.productDraft} s={s} onClose={() => setReviewing(null)} />}
      {reviewing === 'posts' && s?.postsDraft && <PostsDraftReview key={s.postsDraft.id} siteId={c.siteId} draft={s.postsDraft} s={s} onClose={() => setReviewing(null)} />}
    </>
  )
}

function DraftBanner({ text, onOpen }: { text: string; onOpen: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-solid border-vv-lavender bg-vv-lavender-50 px-5 py-3.5">
      <p className="m-0 text-[15px] text-vv-ink">
        <span className={`${PILL} mr-2 bg-vv-st-review text-vv-st-review-ink`}>Ready to review</span>
        {text}
      </p>
      <button type="button" className={`${BTN_LIME} !min-h-10`} onClick={onOpen}>
        Check it
      </button>
    </div>
  )
}

/** Saves the care settings with one change (the server takes the whole row). */
function useCareSave(siteId: string, s: GbpCareState) {
  const save = useGbpCareWrite(siteId, 'gbp-care-save')
  return { ...save, put: (patch: Partial<GbpCareState['care']>, opts?: { onSuccess?: () => void }) => save.mutate({ ...s.care, ...patch }, opts) }
}

// ---- Products --------------------------------------------------------------------------------------------------

function Products({ s, siteId, onDraft }: { s: GbpCareState; siteId: string; onDraft: () => void }) {
  const [open, setOpen] = useState<{ page: CarePage | null; product: GbpProduct | null } | null>(null)
  const loose = s.products.filter((p) => !p.pageId || !s.servicePages.some((x) => x.id === p.pageId))
  const cards = [...s.servicePages.map((page) => ({ page, product: s.products.find((p) => p.pageId === page.id) ?? null })), ...loose.map((product) => ({ page: s.pages.find((x) => x.id === product.pageId) ?? null, product }))]
  return (
    <section className={CARD} aria-label="Products">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={CARD_TITLE}>Products</h2>
        <span className="flex flex-wrap items-center gap-3 text-[14px] text-vv-body">
          One per service page · image 720×720 · links to the page, not Home
          {s.servicePages.length > 0 && (
            <button type="button" className={`${BTN_GHOST} !min-h-9 !px-4 !text-[13px]`} onClick={onDraft} disabled={!!s.productDraft}>
              Draft descriptions
            </button>
          )}
        </span>
      </div>
      {cards.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-vv-line px-4 py-6 text-center text-[14px] text-vv-body">No service pages yet. Add them in Sitemap + hotspots (Day 5), then each gets a product card here.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 p-0 phone:grid-cols-2 phone:gap-2">
          {cards.map(({ page, product }) => {
            const notLive = page && page.status !== 'live'
            const status = product?.status === 'added' ? { t: 'Added', c: 'bg-vv-st-done text-vv-st-done-ink' } : notLive ? { t: 'Page not live yet', c: 'bg-vv-st-waiting text-vv-st-waiting-ink' } : { t: 'Not added', c: 'bg-vv-st-todo text-vv-st-todo-ink' }
            return (
              <li key={product?.id ?? page!.id}>
                <button type="button" onClick={() => setOpen({ page, product })} className="flex h-full w-full flex-col gap-2 rounded-[18px] border border-solid border-vv-line bg-vv-surface p-3 text-left font-body hover:border-vv-lavender">
                  <span className={`flex aspect-square w-full items-center justify-center rounded-xl border border-dashed text-center text-[13px] ${product?.imageReady ? 'border-vv-green bg-vv-green-100 text-vv-green-ink' : 'border-vv-lavender bg-vv-lavender-50 text-vv-body'}`}>
                    {product?.imageReady ? '720 × 720 ready ✓' : (
                      <>
                        720 × 720
                        <br />
                        real photo
                      </>
                    )}
                  </span>
                  <strong className="text-[16px] text-vv-ink phone:text-[14px]">{product?.name ?? page?.name}</strong>
                  <span className="text-[14px] text-vv-body">→ {page ? page.code ?? page.name : 'no page'}</span>
                  {product?.description ? <span className="line-clamp-2 text-[13px] text-vv-body">{product.description}</span> : <span className="text-[13px] italic text-vv-muted">No description yet</span>}
                  <span className={`${PILL} mt-auto w-fit ${status.c}`}>{status.t}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {open && <ProductDialog siteId={siteId} page={open.page} product={open.product} onClose={() => setOpen(null)} />}
    </section>
  )
}

// ---- Reviews ---------------------------------------------------------------------------------------------------

function Reviews({ s, siteId }: { s: GbpCareState; siteId: string }) {
  const care = useCareSave(siteId, s)
  const [open, setOpen] = useState<{ request: ReviewRequest | null } | null>(null)
  const [editing, setEditing] = useState(false)
  const [round, setRound] = useState({ target: String(s.care.reviewTarget), start: s.care.roundStartedOn ?? today() })
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  const pct = Math.min(100, Math.round((s.reviewed / s.care.reviewTarget) * 100))
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${s.reviewEmail.subject}\n\n${s.reviewEmail.body}`)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
    setTimeout(() => setCopied(null), 2500)
  }
  return (
    <section className={CARD} aria-label="Reviews">
      <div className="flex items-start justify-between gap-2">
        <h2 className={CARD_TITLE}>Reviews</h2>
        <button type="button" className={BTN_LINK} onClick={() => setEditing(!editing)}>
          {editing ? 'Close' : 'Round settings'}
        </button>
      </div>
      {editing && (
        <form
          className="grid grid-cols-[100px_minmax(0,1fr)_auto] items-end gap-3 rounded-2xl bg-vv-lavender-50 p-3 phone-sm:grid-cols-1"
          onSubmit={(e) => {
            e.preventDefault()
            care.put({ reviewTarget: Number(round.target), roundStartedOn: round.start || null }, { onSuccess: () => setEditing(false) })
          }}
        >
          <label className={LABEL}>
            Target
            <input className={FIELD} inputMode="numeric" value={round.target} onChange={(e) => setRound({ ...round, target: e.target.value })} />
          </label>
          <label className={LABEL}>
            Round started
            <input className={FIELD} type="date" value={round.start} onChange={(e) => setRound({ ...round, start: e.target.value })} />
          </label>
          <button type="submit" className={`${BTN_LIME} !min-h-[42px]`} disabled={care.isPending}>
            {care.isPending && <Spinner />}
            Save
          </button>
          {care.error && <p className="col-span-full m-0 text-[13px] font-semibold text-vv-red">{errText(care.error, 'Couldn’t save.')}</p>}
        </form>
      )}
      <div className="flex items-baseline gap-3">
        <span className="whitespace-nowrap font-display text-[56px] font-semibold leading-none text-vv-purple-ink phone:text-[44px]">
          {s.reviewed} / {s.care.reviewTarget}
        </span>
        <span className="text-[15px] text-vv-body">new reviews this round{s.care.roundStartedOn ? ` (since ${day(s.care.roundStartedOn)})` : ''}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-vv-lavender-100" role="progressbar" aria-valuenow={s.reviewed} aria-valuemax={s.care.reviewTarget}>
        <div className="h-full rounded-full bg-vv-green" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <p className="m-0 text-[14px] text-vv-body">Email: thank you → ask → link + QR → tips (mention the service and {s.city ?? 'the city'}) → one follow-up after 1–3 days.</p>
      {s.reviewEmail.missing.length > 0 && <p className="m-0 rounded-xl bg-vv-st-waiting px-3 py-2 text-[13px] text-vv-st-waiting-ink">Missing in the email: {s.reviewEmail.missing.join(', ')}. It shows as [brackets] until then.</p>}
      {s.requests.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-vv-line px-4 py-3 text-[14px] text-vv-body">No requests logged yet. The tracker keeps only a customer ref, date, channel and result.</p>
      ) : (
        <ul className="m-0 flex max-h-[320px] list-none flex-col overflow-y-auto p-0">
          {s.requests.map((r) => (
            <li key={r.id} className="border-0 border-t border-solid border-vv-line">
              <button type="button" onClick={() => setOpen({ request: r })} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-0 bg-transparent px-0 py-2.5 text-left font-body text-[14px] text-vv-ink hover:bg-vv-lavender-50">
                <strong className="min-w-0 flex-1 phone:basis-full">{r.customerRef}</strong>
                <span className="text-vv-body">
                  {day(r.askedOn)} · {CHANNEL_LABEL[r.channel]}
                  {r.followUpOn ? ` · follow-up ${day(r.followUpOn)}` : ''}
                </span>
                <span className={`${PILL} ${RESULT_TONE[r.result]}`}>{RESULT_LABEL[r.result]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_GHOST} onClick={() => void copy()} title={`From “${s.reviewEmail.templateName}”`}>
          {copied === 'ok' ? 'Copied ✓' : copied === 'fail' ? 'Couldn’t copy' : 'Copy review email'}
        </button>
        <button type="button" className={BTN_GHOST} onClick={() => setOpen({ request: null })}>
          + Log a request
        </button>
      </div>
      {open && <RequestDialog siteId={siteId} request={open.request} onClose={() => setOpen(null)} />}
    </section>
  )
}

// ---- Care routine ----------------------------------------------------------------------------------------------

function Routine({ s, siteId }: { s: GbpCareState; siteId: string }) {
  const care = useCareSave(siteId, s)
  const [batch, setBatch] = useState(s.care.nextPostBatchOn ?? '')
  const groups = [...new Set(CARE_ROUTINE.map((x) => x.when))]
  return (
    <section className={CARD} aria-label="Care routine">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className={CARD_TITLE}>Care routine</h2>
        {care.isPending && <Spinner />}
      </div>
      {groups.map((g) => (
        <div key={g} className="flex flex-col gap-1">
          <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-vv-body">{g}</span>
          {CARE_ROUTINE.filter((x) => x.when === g).map((x) => (
            <label key={x.key} className="flex cursor-pointer items-center gap-3 py-1 text-[15px] text-vv-ink">
              <input type="checkbox" className="h-4 w-4 accent-[#7C5CE6]" checked={!!s.care.careChecks[x.key]} disabled={care.isPending} onChange={(e) => care.put({ careChecks: { ...s.care.careChecks, [x.key]: e.target.checked } })} />
              {x.label}
            </label>
          ))}
        </div>
      ))}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          care.put({ nextPostBatchOn: batch || null })
        }}
      >
        <label className={`${LABEL} flex-1`}>
          Next post batch
          <input className={FIELD} type="date" value={batch} onChange={(e) => setBatch(e.target.value)} />
        </label>
        <button type="submit" className={`${BTN_GHOST} !min-h-[44px]`} disabled={care.isPending || batch === (s.care.nextPostBatchOn ?? '')}>
          Save
        </button>
      </form>
      {care.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(care.error, 'Couldn’t save.')}</p>}
    </section>
  )
}

// ---- Post calendar ---------------------------------------------------------------------------------------------

function Posts({ s, siteId }: { s: GbpCareState; siteId: string }) {
  const care = useCareSave(siteId, s)
  const [open, setOpen] = useState<GbpPost | null>(null)
  const [start, setStart] = useState(s.care.postsStartOn ?? '')
  const [changing, setChanging] = useState(false)
  const done = s.posts.filter((p) => p.status !== 'not_drafted').length
  const startForm = (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        care.put({ postsStartOn: start || null }, { onSuccess: () => setChanging(false) })
      }}
    >
      <label className={`${LABEL} flex-1`}>
        Week 1 starts on (e.g. a Monday; same weekday every week)
        <input className={FIELD} type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
      </label>
      <button type="submit" className={`${BTN_LIME} !min-h-[44px]`} disabled={care.isPending || !start}>
        {care.isPending && <Spinner />}
        Set start
      </button>
      {care.error && <p className="m-0 w-full text-[13px] font-semibold text-vv-red">{errText(care.error, 'Couldn’t save.')}</p>}
    </form>
  )
  return (
    <section className={CARD} aria-label="Post calendar">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={CARD_TITLE}>Post calendar</h2>
        <span className="text-[14px] text-vv-body">
          13 weeks · 1200×900 · Learn more + UTM{s.care.postsStartOn ? ` · ${done} of 13 drafted` : ''}
        </span>
      </div>
      {!s.care.postsStartOn ? (
        <>
          <p className="m-0 text-[14px] text-vv-body">Pick the date of week 1. Sam’s cycle: meet the business → each service (area 1) → a real project → the team → a call to action; repeat for area 2, 3.</p>
          {startForm}
        </>
      ) : (
        <>
          <p className="m-0 text-[13px] text-vv-body">
            Quarter from {day(s.care.postsStartOn)}.{' '}
            <button type="button" className={BTN_LINK} onClick={() => setChanging(!changing)}>
              {changing ? 'Cancel' : 'Change start (new quarter)'}
            </button>
          </p>
          {changing && startForm}
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 p-0">
            {s.posts.map((p) => (
              <li key={p.week}>
                <button type="button" onClick={() => setOpen(p)} className={`flex h-full w-full flex-col gap-1 rounded-[16px] border border-solid px-3.5 py-3 text-left font-body hover:border-vv-lavender ${p.week === 1 ? 'border-vv-lavender bg-vv-lavender-50' : 'border-vv-line bg-vv-surface'}`}>
                  <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-vv-purple">
                    Week {p.week} · {p.postOn ? day(p.postOn).replace(/, \d{4}$/, '') : ''}
                  </span>
                  <strong className="text-[15px] leading-snug text-vv-ink">{p.topic ?? '—'}</strong>
                  <span className={`text-[13px] ${POST_TONE[p.status]}`}>
                    {POST_STATUS_LABEL[p.status]}
                    {p.pageId ? ` · → ${s.pages.find((x) => x.id === p.pageId)?.code ?? 'page'}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {open && s.care.postsStartOn && <PostDialog siteId={siteId} post={open} quarterStart={s.care.postsStartOn} pages={s.pages} onClose={() => setOpen(null)} />}
    </section>
  )
}
