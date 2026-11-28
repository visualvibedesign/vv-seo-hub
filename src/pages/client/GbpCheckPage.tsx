import { useState } from 'react'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import CompetitorDialog, { type CompetitorDraft } from '../../components/gbp/CompetitorDialog'
import MapShotDialog from '../../components/gbp/MapShotDialog'
import MapShotReview from '../../components/gbp/MapShotReview'
import ProfileDialog from '../../components/gbp/ProfileDialog'
import { Bone, Spinner } from '../../components/ui/Loading'
import { useGbpCheck, useSaveGbpFactor, useSaveGbpProfile, useSaveMapSearch } from '../../hooks/useGbpCheck'
import { agencyDate, agencyDay } from '../../lib/agencyTime'
import { ApiError } from '../../lib/api'
import { GBP_FACTORS, MAP_SERVICES, MAX_COMPETITORS, mapPackStats, PROFILE_CHECKS } from '../../lib/gbpCheck'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, CARD_TITLE, FIELD, LABEL, PILL, siteLabel } from '../../lib/ui'
import type { GbpCheckState, GbpFactor, GbpFactorStatus, MapCompetitor, MapServiceCode, ProfileCheckKey } from '../../types/seo'

// Strategy Builder › Day 4 · GBP check (/clients/{site id}/strategy/gbp). Design: docs/design/GBP.png.
// Who's in the map pack per service (S1–S3), typed from a Maps search in a Chrome guest profile (ads skipped,
// categories with Pleper), the Whitespark top map factors for the client, and the public business details.
// Numbers exactly as typed; empty = "—", never 0. The private address is never stored (no field for it).

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const dash = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? '—' : String(v))
const day = (d: string | null) => (d ? agencyDate(d) : '—')
const todayHere = () => agencyDay(new Date().toISOString())

const STATUS: Record<GbpFactorStatus, { label: string; cls: string }> = {
  to_check: { label: 'To check', cls: 'bg-vv-st-todo text-vv-st-todo-ink' },
  ok: { label: 'OK', cls: 'bg-vv-st-done text-vv-st-done-ink' },
  needs_work: { label: 'Needs work', cls: 'bg-vv-st-waiting text-vv-st-waiting-ink' },
  na: { label: 'N/A', cls: 'bg-vv-lavender-100 text-vv-purple-ink' },
}

export default function GbpCheckPage() {
  const c = useClientContext()
  const q = useGbpCheck(c.siteId)
  const [tab, setTab] = useState<MapServiceCode>('S1')
  const [draft, setDraft] = useState<CompetitorDraft | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)
  const [shotOpen, setShotOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const closeReview = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setReviewing(false)
  }
  const s = q.data
  const serviceLabel = (k: MapServiceCode) => `${k} ${s?.services[k] ?? ''}`.trim()
  const compCount = s ? s.competitors.filter((x) => x.category === tab && !x.isClient).length : 0
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Who’s in the <em className="font-medium text-vv-purple">map pack?</em>
          </h1>
          <p className="m-0 text-[17px] leading-normal text-vv-body">Day 4 · Google Maps search per service · categories with Pleper · reviews counted by hand</p>
        </div>
        <HeaderTools>
          <button type="button" className={BTN_GHOST} disabled={!s} onClick={() => setShotOpen(true)} title="Claude reads a Google Maps / PlePer screenshot into rows you check first">
            Read a screenshot
          </button>
          <button type="button" className={BTN_LIME} disabled={!s || compCount >= MAX_COMPETITORS} onClick={() => setDraft({ category: tab, isClient: false, rank: nextRank(s!, tab) })} title={compCount >= MAX_COMPETITORS ? `${MAX_COMPETITORS} competitors already` : undefined}>
            + Add competitor
          </button>
        </HeaderTools>
      </header>

      {q.isPending && <Bone className="h-[420px] w-full rounded-[22px]" />}
      {q.isError && <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load the GBP check. Try again in a moment.')}</p>}

      {s?.mapRead && !reviewing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-solid border-vv-lavender bg-vv-lavender-50 px-5 py-3.5">
          <p className="m-0 text-[15px] text-vv-ink">
            <span className={`${PILL} mr-2 bg-vv-st-review text-vv-st-review-ink`}>Ready to review</span>
            {s.mapRead.summary}
          </p>
          <button
            type="button"
            className={`${BTN_LIME} !min-h-10`}
            onClick={() => {
              setTab(s.mapRead!.category)
              setReviewing(true)
            }}
          >
            Check the rows
          </button>
        </div>
      )}

      {s && (
        <>
          <Competitors s={s} siteId={c.siteId} tab={tab} setTab={setTab} label={serviceLabel} onEdit={setDraft} />
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start gap-5 [@media(max-width:1100px)]:grid-cols-1">
            <Factors s={s} siteId={c.siteId} />
            <Details s={s} onEdit={() => setEditingProfile(true)} />
          </div>
          <ProfileCheck s={s} siteId={c.siteId} />
        </>
      )}

      {draft && s && <CompetitorDialog siteId={c.siteId} draft={draft} serviceLabel={serviceLabel(draft.category)} clientName={s.clientName} onClose={() => setDraft(null)} />}
      {shotOpen && s && (
        <MapShotDialog
          siteId={c.siteId}
          category={tab}
          serviceLabel={serviceLabel(tab)}
          onClose={() => setShotOpen(false)}
          onRead={(url) => {
            setShotOpen(false)
            setPreview(url)
            setReviewing(true)
          }}
        />
      )}
      {reviewing && s?.mapRead && (
        <MapShotReview key={s.mapRead.id} siteId={c.siteId} read={s.mapRead} serviceLabel={serviceLabel(s.mapRead.category)} existing={s.competitors.filter((x) => x.category === s.mapRead!.category)} previewUrl={preview} onClose={closeReview} />
      )}
      {editingProfile && s && <ProfileDialog siteId={c.siteId} profile={s.profile} onClose={() => setEditingProfile(false)} />}
    </>
  )
}

function nextRank(s: GbpCheckState, tab: MapServiceCode): number | null {
  const used = new Set(s.competitors.filter((x) => x.category === tab && !x.isClient).map((x) => x.rank))
  for (let r = 1; r <= 20; r++) if (!used.has(r)) return r
  return null
}

// ---- Competitors ---------------------------------------------------------------------------------------------------

function Competitors({ s, siteId, tab, setTab, label, onEdit }: { s: GbpCheckState; siteId: string; tab: MapServiceCode; setTab: (k: MapServiceCode) => void; label: (k: MapServiceCode) => string; onEdit: (d: CompetitorDraft) => void }) {
  const rows = s.competitors.filter((x) => x.category === tab)
  const comps = rows.filter((x) => !x.isClient).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
  const mine = rows.find((x) => x.isClient) ?? null
  const search = s.searches.find((x) => x.category === tab)!
  const st = mapPackStats(rows, search.checkedOn, todayHere())
  const g = s.fromGbp
  // The client's pinned row: typed here, or else their own numbers from the newest GBP period (not saved here yet).
  const pinned: (MapCompetitor & { fromGbp?: boolean }) | null = mine ?? (g ? { id: '', category: tab, isClient: true, rank: null, name: s.clientName, primaryCategory: s.profile.primaryCategory, additionalCategories: s.profile.additionalCategories, reviews: g.reviews, rating: g.rating, newestReviewOn: g.newestReviewOn, note: null, fromGbp: true } : null)
  const editRow = (r: MapCompetitor & { fromGbp?: boolean }) => onEdit(r.fromGbp ? { ...r, id: undefined } : r)

  return (
    <section className={CARD} aria-label="Competitors">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={CARD_TITLE}>Competitors</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Service">
          {MAP_SERVICES.map((k) => (
            <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`rounded-full border border-solid px-4 py-2 font-body text-[14px] font-semibold ${tab === k ? 'border-vv-lavender bg-vv-lavender text-vv-ink' : 'border-vv-line bg-vv-surface text-vv-body hover:bg-vv-lavender-50'}`}>
              {label(k)}
            </button>
          ))}
        </div>
      </div>

      <SearchLine key={tab} siteId={siteId} search={search} />

      {comps.length === 0 && !pinned ? (
        <p className="m-0 rounded-2xl border border-dashed border-vv-line px-4 py-6 text-center text-[14px] text-vv-body">
          No competitors for {label(tab)} yet. Search Google Maps in a Chrome guest profile, skip the ads, and add up to {MAX_COMPETITORS} (+ Add competitor).
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="phone:hidden">
            <table className="w-full border-collapse text-left text-[14px]">
              <thead>
                <tr className="bg-vv-lavender-50 text-[11px] uppercase tracking-[0.1em] text-vv-body">
                  <th className="w-10 rounded-l-xl px-3 py-3 font-bold">#</th>
                  <th className="px-2 py-3 font-bold">Business</th>
                  <th className="px-2 py-3 font-bold">Primary category</th>
                  <th className="px-2 py-3 font-bold">Additional</th>
                  <th className="px-2 py-3 font-bold">Reviews</th>
                  <th className="px-2 py-3 font-bold">Rating</th>
                  <th className="px-2 py-3 font-bold">Newest review</th>
                  <th className="rounded-r-xl px-2 py-3"><span className="sr-only">Edit</span></th>
                </tr>
              </thead>
              <tbody>
                {comps.map((r) => (
                  <Row key={r.id} r={r} onEdit={() => editRow(r)} />
                ))}
                {pinned ? (
                  <Row r={pinned} mine fromGbp={pinned.fromGbp ? g!.periodTo : null} onEdit={() => editRow(pinned)} />
                ) : (
                  <tr className="bg-vv-lavender-50">
                    <td className="px-3 py-3 text-vv-body">—</td>
                    <td colSpan={7} className="px-2 py-3">
                      <strong>{s.clientName}</strong>{' '}
                      <button type="button" className={`${BTN_LINK} ml-2`} onClick={() => onEdit({ category: tab, isClient: true })}>
                        + Add your row
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Phone: stacked cards */}
          <ul className="m-0 hidden list-none flex-col gap-2 p-0 phone:flex">
            {comps.map((r) => (
              <MobileRow key={r.id} r={r} onEdit={() => editRow(r)} />
            ))}
            {pinned ? (
              <MobileRow r={pinned} mine fromGbp={pinned.fromGbp ? g!.periodTo : null} onEdit={() => editRow(pinned)} />
            ) : (
              <li className="rounded-2xl bg-vv-lavender-50 px-4 py-3 text-[14px]">
                <strong>{s.clientName}</strong>{' '}
                <button type="button" className={`${BTN_LINK} ml-2`} onClick={() => onEdit({ category: tab, isClient: true })}>
                  + Add your row
                </button>
              </li>
            )}
          </ul>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <span className={`${PILL} bg-vv-lavender-100 text-vv-purple-ink`} title="Total reviews ÷ competitors with a review count (top 10, your row left out)">
          Top 10 average reviews: {dash(st.avgReviews)}
          {st.counted ? ` (${st.counted} counted)` : ''}
        </span>
        <span className={`${PILL} bg-vv-lavender-100 text-vv-purple-ink`} title="A ballpark from each competitor's newest review date: one review in the days since ≈ per month; the middle value">
          Competitor pace: {st.pace === null ? '—' : `~${st.pace}`} reviews / month
        </span>
        <span className={`${PILL} bg-vv-green-100 text-vv-green-ink`} title="Pace rounded up + 1 (at least 2, at most 10)">
          {st.goal === null ? 'Goal: add newest review dates to see the monthly review ask' : `Goal: beat the pace with a monthly review ask of ${st.goal}`}
        </span>
      </div>
    </section>
  )
}

function Row({ r, mine = false, fromGbp = null, onEdit }: { r: MapCompetitor; mine?: boolean; fromGbp?: string | null; onEdit: () => void }) {
  return (
    <tr className={`border-0 border-b border-solid border-vv-line ${mine ? 'bg-vv-lavender-50' : ''}`}>
      <td className="px-3 py-3 text-vv-body">{dash(r.rank)}</td>
      <td className="px-2 py-3">
        <strong className="text-vv-ink">{r.name}</strong>
        {fromGbp && <span className="block text-[12px] text-vv-body">From GBP numbers ({day(fromGbp)}) · not saved here yet</span>}
        {r.note && <span className="block text-[12px] text-vv-body">{r.note}</span>}
      </td>
      <td className="px-2 py-3">{dash(r.primaryCategory)}</td>
      <td className="px-2 py-3 text-vv-body">{r.additionalCategories.length ? r.additionalCategories.join(', ') : '—'}</td>
      <td className="px-2 py-3">{dash(r.reviews)}</td>
      <td className="px-2 py-3">{r.rating === null ? '—' : `★ ${r.rating.toFixed(1)}`}</td>
      <td className="px-2 py-3">{day(r.newestReviewOn)}</td>
      <td className="px-2 py-3 text-right">
        <button type="button" className={BTN_LINK} onClick={onEdit} aria-label={`${fromGbp ? 'Add' : 'Edit'} ${r.name}`}>
          {fromGbp ? 'Add' : 'Edit'}
        </button>
      </td>
    </tr>
  )
}

function MobileRow({ r, mine = false, fromGbp = null, onEdit }: { r: MapCompetitor; mine?: boolean; fromGbp?: string | null; onEdit: () => void }) {
  return (
    <li className={`flex flex-col gap-1 rounded-2xl border border-solid border-vv-line px-4 py-3 text-[14px] ${mine ? 'bg-vv-lavender-50' : 'bg-vv-surface'}`}>
      <div className="flex items-start justify-between gap-2">
        <strong className="text-vv-ink">
          {r.rank ? `${r.rank}. ` : '— '}
          {r.name}
        </strong>
        <button type="button" className={BTN_LINK} onClick={onEdit}>
          {fromGbp ? 'Add' : 'Edit'}
        </button>
      </div>
      <span className="text-vv-body">
        {dash(r.primaryCategory)}
        {r.additionalCategories.length ? ` + ${r.additionalCategories.join(', ')}` : ''}
      </span>
      <span>
        {dash(r.reviews)} reviews · {r.rating === null ? '—' : `★ ${r.rating.toFixed(1)}`} · newest {day(r.newestReviewOn)}
      </span>
      {fromGbp && <span className="text-[12px] text-vv-body">From GBP numbers ({day(fromGbp)}) · not saved here yet</span>}
    </li>
  )
}

function SearchLine({ siteId, search }: { siteId: string; search: GbpCheckState['searches'][number] }) {
  const save = useSaveMapSearch(siteId)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ search: search.search ?? '', checkedOn: search.checkedOn ?? todayHere(), resultsCounted: search.resultsCounted === null ? '' : String(search.resultsCounted) })
  if (!open)
    return (
      <p className="m-0 text-[15px] text-vv-body">
        Maps search: {search.search ? <strong className="text-vv-ink">{search.search}</strong> : <em>not set</em>} · Chrome guest profile · ads skipped
        {search.checkedOn && ` · checked ${day(search.checkedOn)}`}
        {search.resultsCounted !== null && ` · ${search.resultsCounted} results counted`}{' '}
        <button type="button" className={`${BTN_LINK} ml-1`} onClick={() => setOpen(true)}>
          {search.search ? 'Edit' : 'Set the search'}
        </button>
      </p>
    )
  return (
    <form
      className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 rounded-2xl bg-vv-lavender-50 p-3 phone:grid-cols-1"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate({ category: search.category, search: f.search || null, checkedOn: f.checkedOn || null, resultsCounted: f.resultsCounted === '' ? null : Number(f.resultsCounted) }, { onSuccess: () => setOpen(false) })
      }}
    >
      <label className={LABEL}>
        Maps search used
        <input className={FIELD} value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} maxLength={200} placeholder="e.g. service + city" autoFocus />
      </label>
      <label className={LABEL}>
        Date checked
        <input className={FIELD} type="date" value={f.checkedOn} onChange={(e) => setF({ ...f, checkedOn: e.target.value })} />
      </label>
      <label className={LABEL}>
        Results counted
        <input className={FIELD} inputMode="numeric" value={f.resultsCounted} onChange={(e) => setF({ ...f, resultsCounted: e.target.value })} placeholder="up to 10" />
      </label>
      <div className="flex gap-2">
        <button type="button" className={`${BTN_LINK} px-2`} onClick={() => setOpen(false)} disabled={save.isPending}>
          Cancel
        </button>
        <button type="submit" className={`${BTN_LIME} !min-h-[42px]`} disabled={save.isPending}>
          {save.isPending && <Spinner />}
          Save
        </button>
      </div>
      {save.error && <p className="col-span-full m-0 text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save the search.')}</p>}
    </form>
  )
}

// ---- Whitespark factors --------------------------------------------------------------------------------------------

function Factors({ s, siteId }: { s: GbpCheckState; siteId: string }) {
  const save = useSaveGbpFactor(siteId)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const done = s.factors.filter((f) => f.status !== 'to_check').length
  const put = (f: GbpFactor, status: GbpFactorStatus, n: string | null) => save.mutate({ factor: f.key, status, note: n }, { onSuccess: () => setNoteFor(null) })
  return (
    <section className={CARD} aria-label="Whitespark top map factors">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={CARD_TITLE}>Whitespark top map factors</h2>
        <span className="text-[14px] text-vv-body">
          {s.clientName} · {done} of {s.factors.length} checked
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {GBP_FACTORS.map((meta) => {
          const f = s.factors.find((x) => x.key === meta.key)!
          return (
            <li key={meta.key} className="flex flex-col gap-1.5 border-0 border-t border-solid border-vv-line py-3">
              <div className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-[14px] font-bold text-vv-purple">{meta.no}</span>
                <span className="min-w-0 flex-1 text-[15px] text-vv-ink">{meta.label}</span>
                <select
                  aria-label={`${meta.label} status`}
                  className={`${PILL} cursor-pointer appearance-none border-0 text-center font-body ${STATUS[f.status].cls}`}
                  value={f.status}
                  disabled={save.isPending}
                  onChange={(e) => put(f, e.target.value as GbpFactorStatus, f.note)}
                >
                  {(Object.keys(STATUS) as GbpFactorStatus[]).map((k) => (
                    <option key={k} value={k}>
                      {STATUS[k].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pl-9 text-[13px] text-vv-body">
                {noteFor === meta.key ? (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      put(f, f.status, note.trim() || null)
                    }}
                  >
                    <input className={`${FIELD} !py-1.5 !text-[14px]`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} autoFocus placeholder={meta.key === 'address_shown' ? 'e.g. Hidden · home studio' : 'Short note'} />
                    <button type="submit" className={BTN_LINK} disabled={save.isPending}>
                      Save
                    </button>
                    <button type="button" className={BTN_LINK} onClick={() => setNoteFor(null)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    {f.note && <span className="mr-2">{f.note}</span>}
                    <button
                      type="button"
                      className={`${BTN_LINK} !min-h-0 !text-[13px]`}
                      onClick={() => {
                        setNote(f.note ?? '')
                        setNoteFor(meta.key)
                      }}
                    >
                      {f.note ? 'Edit note' : '+ Note'}
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {save.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save the factor.')}</p>}
    </section>
  )
}

// ---- Business details ----------------------------------------------------------------------------------------------

function Details({ s, onEdit }: { s: GbpCheckState; onEdit: () => void }) {
  const p = s.profile
  const rows: [string, string][] = [
    ['Name', dash(p.businessName)],
    ['Website', p.website ? siteLabel(p.website) : '—'],
    ['Service area', dash(p.serviceAreas)],
    ['Phone', dash(p.phone)],
    ['Email', dash(p.email)],
    ['Hours', dash(p.hours)],
    ['Holiday hours', dash(p.holidayHours)],
    ['Primary category', dash(p.primaryCategory)],
    ['Additional', p.additionalCategories.length ? p.additionalCategories.join(', ') : '—'],
    ['Socials', p.socials.length ? `${p.socials.length} linked` : '—'],
    ['Booking link', p.bookingUrl ? 'Added' : '—'],
    ['Review link', p.reviewUrl ? 'Added' : '—'],
    ['Description', p.description ? `${p.description.length} / 750 characters` : '—'],
    ['Address shown on GBP', p.addressShown === null ? '—' : p.addressShown ? 'Yes' : 'No (hidden)'],
  ]
  return (
    <section className={CARD} aria-label="Business details">
      <div className="flex items-center justify-between gap-2">
        <h2 className={CARD_TITLE}>Business details</h2>
        <button type="button" className={`${BTN_GHOST} !min-h-10 !px-4`} onClick={onEdit}>
          Edit
        </button>
      </div>
      <p className="m-0 text-[12px] font-bold uppercase tracking-[0.1em] text-vv-body">Public (must match the website)</p>
      <dl className="m-0 flex flex-col">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-0 border-t border-solid border-vv-line py-2.5 text-[15px]">
            <dt className="shrink-0 text-vv-body">{k}</dt>
            <dd className="m-0 min-w-0 whitespace-pre-line break-words text-right font-semibold text-vv-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {(p.checkedOn || p.waitingOnGoogle || p.checkAgainOn) && (
        <p className="m-0 text-[13px] text-vv-body">
          {p.checkedOn && `Checked ${day(p.checkedOn)}`}
          {p.waitingOnGoogle && ` · Waiting on Google: ${p.waitingOnGoogle}`}
          {p.checkAgainOn && ` · check again ${day(p.checkAgainOn)}`}
        </p>
      )}
      <p className="m-0 rounded-2xl border border-dashed border-vv-lavender px-4 py-3 text-[14px] text-vv-body">
        <strong className="text-vv-ink">Private address:</strong> never stored in SEO Hub{p.addressShown === false ? ' (hidden on GBP)' : ''}. Verification contacts stay with the client.
      </p>
    </section>
  )
}

// ---- Profile check (Day 4 worksheet 4) -----------------------------------------------------------------------------

function ProfileCheck({ s, siteId }: { s: GbpCheckState; siteId: string }) {
  const save = useSaveGbpProfile(siteId)
  const checks = s.profile.profileChecks
  const done = PROFILE_CHECKS.filter((x) => checks[x.key]?.done).length
  const toggle = (k: ProfileCheckKey) => save.mutate({ ...s.profile, profileChecks: { ...checks, [k]: { done: !checks[k]?.done, note: checks[k]?.note ?? null } } })
  return (
    <section className={CARD} aria-label="Profile check">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={CARD_TITLE}>Profile check</h2>
        <span className="flex items-center gap-2 text-[14px] text-vv-body">
          {save.isPending && <Spinner />}
          {done} of {PROFILE_CHECKS.length} done · fill it out top to bottom; on a client profile, get approval first
        </span>
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-6 p-0 phone:grid-cols-1">
        {PROFILE_CHECKS.map((x) => (
          <li key={x.key} className="border-0 border-t border-solid border-vv-line py-2.5">
            <label className="flex cursor-pointer items-start gap-3 text-[15px] text-vv-ink">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#7C5CE6]" checked={!!checks[x.key]?.done} disabled={save.isPending} onChange={() => toggle(x.key)} />
              {x.label}
            </label>
          </li>
        ))}
      </ul>
      {save.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save the tick.')}</p>}
    </section>
  )
}
