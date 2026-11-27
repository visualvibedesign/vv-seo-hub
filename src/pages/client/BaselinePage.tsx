import { useState } from 'react'
import { Link } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import { Dash, GuideChecklist, PageHead, Soon } from '../../components/overview/OverviewParts'
import RankImport from '../../components/overview/RankImport'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Bone, Spinner } from '../../components/ui/Loading'
import Modal from '../../components/ui/Modal'
import { useBaseline, useBaselineById, useSaveBaseline } from '../../hooks/useBaseline'
import { agencyDate } from '../../lib/agencyTime'
import { ApiError } from '../../lib/api'
import { fmtMetric, snapshotDates, snapshotExtra, SOURCE_METRICS, SOURCE_NAME } from '../../lib/baseline'
import { clientPath } from '../../lib/clientSetup'
import { TONE, type Tone } from '../../lib/tones'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, FIELD, LABEL, PILL } from '../../lib/ui'
import type { BaselineSnapshot, BaselineSource, BaselineState, BaselineSummary } from '../../types/seo'

// Client Overview › Baseline (/clients/{site id}/baseline): Sam's Day 3, the starting numbers, each saved with its
// exact dates. Design: docs/design/overview/Baseline.dc.html. "Save baseline" freezes a copy (server works the numbers
// out; re-pulling later never changes it). "Fill missing" adds a source the current baseline doesn't have yet, never
// overwriting one. "Start a new baseline" keeps the old one under Past baselines. Never sample numbers: missing = "—".

const CARDS: { i: string; source: BaselineSource | 'site'; how: string; tone: Tone }[] = [
  { i: 'SR', source: 'semrush', how: 'CSV import · numbers exactly as exported', tone: 'pink' },
  { i: 'SC', source: 'gsc', how: 'Pulled from Google · last 28 days', tone: 'purple' },
  { i: 'GA', source: 'ga4', how: 'Pulled from Google · last 28 days', tone: 'green' },
  { i: 'GB', source: 'gbp', how: 'Typed in once a month · GBP › Performance', tone: 'orange' },
  { i: 'WS', source: 'whitespark', how: 'Typed scan · main service + city', tone: 'purple' },
  { i: 'PG', source: 'site', how: 'From the Site check tab · all live pages', tone: 'pink' },
]

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
/** Saved-at dates in the agency's time zone (Asia/Manila). */
const savedOn = agencyDate
const nameOf = (b: BaselineSummary) => b.label ?? 'Baseline'

export default function BaselinePage() {
  const c = useClientContext()
  const q = useBaseline(c.siteId)
  const save = useSaveBaseline(c.siteId)
  const [dialog, setDialog] = useState<'save' | 'new' | null>(null)
  const s = q.data
  const cur = s?.current ?? null
  const all = s ? s.savedRequired === s.required.length : false

  return (
    <>
      <PageHead lead="Baseline," accent="where we started." sub="Day 3 · the starting numbers, each saved with its exact dates. Results compares everything against this.">
        {s && (
          <span className={`${PILL} !px-3.5 !py-2 !text-[13px] ${!cur ? 'bg-vv-st-todo text-vv-st-todo-ink' : all ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-orange-100 text-vv-orange-ink'}`}>
            {s.savedRequired} of {s.required.length} saved
          </span>
        )}
        {s &&
          (cur ? (
            <button type="button" className={BTN_GHOST} onClick={() => setDialog('new')}>
              Start a new baseline
            </button>
          ) : (
            <button type="button" className={BTN_LIME} onClick={() => setDialog('save')} disabled={s.live.length === 0}>
              Save baseline
            </button>
          ))}
      </PageHead>

      {cur && (
        <p className="m-0 -mt-2 text-[13px] text-vv-body">
          Current: <strong className="text-vv-ink">{nameOf(cur)}</strong> · saved {savedOn(cur.savedAt)}
          {cur.note ? ` · ${cur.note}` : ''}
        </p>
      )}

      <GuideChecklist siteId={c.siteId} step={2} />

      {q.isPending ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,380px),1fr))] gap-4">
          {CARDS.map((x) => (
            <Bone key={x.i} className="h-[250px] w-full rounded-[20px]" />
          ))}
        </div>
      ) : q.isError || !s ? (
        <p className="m-0 text-[14px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load the baseline. Try again in a moment.')}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,380px),1fr))] gap-4">
          {CARDS.map((x) => (
            <SourceCard key={x.i} card={x} state={s} siteId={c.siteId} />
          ))}
        </div>
      )}

      {s && s.history.length > (cur ? 1 : 0) && <PastBaselines siteId={c.siteId} list={s.history.filter((b) => b.id !== cur?.id)} />}

      <p className="m-0 text-[12px] text-vv-body">Semrush stays in Semrush: we only import its CSV, numbers exactly as exported. A client’s private address is never stored or shown.</p>

      <Modal open={dialog !== null} title={dialog === 'new' ? 'Start a new baseline' : 'Save baseline'} onClose={() => !save.isPending && setDialog(null)}>
        {dialog && s && <SaveForm mode={dialog} state={s} busy={save.isPending} error={save.error} onCancel={() => setDialog(null)} onSave={(label, note) => save.mutate({ mode: 'new', label, note }, { onSuccess: () => setDialog(null) })} />}
      </Modal>
    </>
  )
}

function SaveForm({ mode, state: s, busy, error, onCancel, onSave }: { mode: 'save' | 'new'; state: BaselineState; busy: boolean; error: unknown; onCancel: () => void; onSave: (label: string, note: string) => void }) {
  const [label, setLabel] = useState(mode === 'save' ? 'Day 3' : '')
  const [note, setNote] = useState('')
  const has = (src: BaselineSource) => s.live.some((l) => l.source === src)
  const missing = s.required.filter((r) => !has(r))
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(label, note)
      }}
    >
      {mode === 'new' && s.current && (
        <p className="m-0 rounded-xl bg-vv-lavender-50 px-3 py-2 text-[13px] text-vv-body">
          “{nameOf(s.current)}” (saved {savedOn(s.current.savedAt)}) moves to Past baselines. Nothing is deleted.
        </p>
      )}
      <p className="m-0 text-[13px] text-vv-body">Freezes today’s numbers, each with its own dates. Pulling Google again or importing a newer CSV later never changes it.</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
        {s.live.map((l) => (
          <li key={l.source} className="flex flex-wrap justify-between gap-x-3">
            <strong>{SOURCE_NAME[l.source]}</strong>
            <span className="text-vv-body">{snapshotDates(l)}</span>
          </li>
        ))}
        {missing.map((m) => (
          <li key={m} className="flex flex-wrap justify-between gap-x-3">
            <strong>{SOURCE_NAME[m]}</strong>
            <span className="font-semibold text-vv-orange-ink">Missing · fill it later</span>
          </li>
        ))}
      </ul>
      <label className={LABEL}>
        Name (optional)
        <input className={FIELD} value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Day 3, or After the site rebuild" />
      </label>
      <label className={LABEL}>
        Note (optional)
        <input className={FIELD} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="anything to remember about these numbers" />
      </label>
      {error !== null && error !== undefined && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(error, 'Couldn’t save the baseline.')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={BTN_LIME} disabled={busy || s.live.length === 0}>
          {busy && <Spinner />}
          {mode === 'new' ? 'Start new baseline' : 'Save baseline'}
        </button>
      </div>
    </form>
  )
}

type Status = 'saved' | 'ready' | 'fill' | 'missing' | 'optional' | 'later'

function SourceCard({ card, state: s, siteId }: { card: (typeof CARDS)[number]; state: BaselineState; siteId: string }) {
  const fill = useSaveBaseline(siteId)
  const [confirm, setConfirm] = useState(false)
  const t = TONE[card.tone]
  const src = card.source === 'site' ? null : card.source
  const saved = src ? s.current?.snapshots.find((x) => x.source === src) : undefined
  const live = src ? s.live.find((x) => x.source === src) : undefined
  const required = src ? s.required.includes(src) : false
  const status: Status = !src ? 'later' : saved ? 'saved' : !s.current ? (live ? 'ready' : required ? 'missing' : 'optional') : live ? 'fill' : required ? 'missing' : 'optional'
  const shown: BaselineSnapshot | undefined = saved ?? (status === 'ready' || status === 'fill' ? live : undefined)
  const metrics = src ? SOURCE_METRICS[src] : [{ key: 'health', label: 'Site health' }, { key: 'pages', label: 'Pages' }, { key: 'problems', label: 'Problems' }, { key: 'speed', label: 'Mobile speed' }]
  const PILLS: Record<Status, { text: string; cls: string }> = {
    saved: { text: 'Saved', cls: 'bg-vv-green-100 text-vv-green-ink' },
    ready: { text: 'Ready to save', cls: 'bg-vv-lavender-100 text-vv-purple-ink' },
    fill: { text: 'Not in baseline', cls: 'bg-vv-orange-100 text-vv-orange-ink' },
    missing: { text: 'Missing', cls: 'bg-vv-orange-100 text-vv-orange-ink' },
    optional: { text: 'Optional', cls: 'bg-vv-st-todo text-vv-st-todo-ink' },
    later: { text: 'Later', cls: 'bg-vv-st-todo text-vv-st-todo-ink' },
  }
  const name = src ? SOURCE_NAME[src] : 'Site check snapshot'
  const extra = shown ? snapshotExtra(shown) : null
  return (
    <section className={`${CARD} !gap-3.5 !rounded-[20px] !p-5`} aria-label={name}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[14px] text-[13px] font-bold ${t.bg} ${t.ink}`}>{card.i}</span>
          <div className="min-w-0">
            <h2 className="m-0 font-display text-[19px] font-semibold leading-tight">{name}</h2>
            <div className="text-[12px] text-vv-body">{card.how}</div>
          </div>
        </div>
        <span className={`${PILL} !py-1 ${PILLS[status].cls}`}>{PILLS[status].text}</span>
      </div>
      <div className={`grid grid-cols-2 gap-2.5 ${status === 'ready' || status === 'fill' ? 'opacity-80' : ''}`}>
        {metrics.map((m) => (
          <div key={m.key} className="min-w-0 rounded-[14px] bg-vv-lavender-50 px-3 py-2.5">
            <div className="font-display text-[22px] font-semibold">{shown && 'kind' in m ? fmtMetric(m.kind, shown.values[m.key]) : <Dash />}</div>
            <div className="text-[12px] text-vv-body">{m.label}</div>
          </div>
        ))}
      </div>
      {extra && <div className="-mt-1 text-[12px] text-vv-body">{extra}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-0 border-t border-solid border-vv-line pt-3">
        <span className="text-[12px] text-vv-body">
          {status === 'saved' && shown ? `Saved · ${snapshotDates(shown)}` : status === 'ready' && shown ? `Now · ${snapshotDates(shown)} (not saved yet)` : status === 'fill' && shown ? `Now · ${snapshotDates(shown)}` : status === 'optional' ? 'Optional until the client has a map grid scan' : status === 'later' ? 'No date yet' : 'No numbers yet'}
        </span>
        <CardAction status={status} src={src} siteId={siteId} busy={fill.isPending} onFill={() => setConfirm(true)} />
      </div>
      {fill.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(fill.error, 'Couldn’t add it to the baseline.')}</p>}
      <ConfirmDialog
        open={confirm}
        title={`Add ${name} to the baseline?`}
        body={live ? `Saves ${snapshotDates(live)} into “${s.current ? nameOf(s.current) : 'Baseline'}”. Sources already saved stay as they are.` : ''}
        confirmLabel="Add to baseline"
        busy={fill.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => src && fill.mutate({ mode: 'fill', sources: [src] }, { onSuccess: () => setConfirm(false) })}
      />
    </section>
  )
}

function CardAction({ status, src, siteId, busy, onFill }: { status: Status; src: BaselineSource | null; siteId: string; busy: boolean; onFill: () => void }) {
  if (status === 'later') return <Soon>Comes with Site check</Soon>
  if (status === 'fill')
    return (
      <button type="button" className={`${BTN_LIME} min-h-9 px-4 text-[13px]`} onClick={onFill} disabled={busy}>
        {busy && <Spinner />}
        Fill missing
      </button>
    )
  if (status === 'saved' || status === 'ready') return null
  if (src === 'semrush') return <RankImport siteId={siteId} primary />
  const to = { gsc: 'Connect Google on Overview ›', ga4: 'Connect Google on Overview ›', gbp: 'Type in on Overview ›', whitespark: 'Type a scan on Overview ›' } as const
  return (
    <Link to={clientPath(siteId)} className="text-[13px] font-semibold text-vv-purple-deep">
      {src ? to[src] : ''}
    </Link>
  )
}

function PastBaselines({ siteId, list }: { siteId: string; list: BaselineSummary[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <section className={`${CARD} !gap-3 !rounded-[20px] !p-5`} aria-labelledby="past-baselines">
      <h2 id="past-baselines" className="m-0 font-display text-[20px] font-semibold leading-tight">
        Past baselines
      </h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {list.map((b) => (
          <li key={b.id} className="border-0 border-t border-solid border-vv-line py-2 first:border-t-0 first:pt-0">
            <button type="button" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)} className="flex w-full flex-wrap items-center justify-between gap-2 border-0 bg-transparent p-0 text-left font-body text-[13px] text-vv-ink">
              <span>
                <strong>{nameOf(b)}</strong> <span className="text-vv-body">· saved {savedOn(b.savedAt)} · {b.sources.length} source{b.sources.length === 1 ? '' : 's'}</span>
              </span>
              <span className="font-semibold text-vv-purple-deep">{open === b.id ? 'Hide' : 'Show numbers'}</span>
            </button>
            {open === b.id && <PastNumbers siteId={siteId} id={b.id} />}
          </li>
        ))}
      </ul>
    </section>
  )
}

function PastNumbers({ siteId, id }: { siteId: string; id: string }) {
  const q = useBaselineById(siteId, id)
  if (q.isPending) return <Bone className="mt-2 h-[80px] w-full rounded-xl" />
  if (q.isError || !q.data) return <p className="m-0 mt-2 text-[13px] font-semibold text-vv-red">{errText(q.error, 'Couldn’t load it.')}</p>
  return (
    <div className="mt-2 flex flex-col gap-2">
      {q.data.note && <p className="m-0 text-[12px] text-vv-body">{q.data.note}</p>}
      {q.data.snapshots.map((sn) => (
        <div key={sn.source} className="rounded-xl bg-vv-lavender-50 px-3 py-2 text-[13px]">
          <div className="flex flex-wrap justify-between gap-x-3">
            <strong>{SOURCE_NAME[sn.source]}</strong>
            <span className="text-[12px] text-vv-body">{snapshotDates(sn)}</span>
          </div>
          <div className="text-vv-body">{SOURCE_METRICS[sn.source].map((m) => `${m.label} ${fmtMetric(m.kind, sn.values[m.key])}`).join(' · ')}</div>
        </div>
      ))}
    </div>
  )
}
