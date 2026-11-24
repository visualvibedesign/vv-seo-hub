import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { Bone, Spinner } from '../../components/ui/Loading'
import { useKeywords, useUpdateKeywords } from '../../hooks/useKeywords'
import { ApiError } from '../../lib/api'
import { SOURCE_LABEL } from '../../lib/importRules'
import { intentParts, KP_PICKS, num, ROLE_LABEL, ROLE_PILL, ROLES, STATUS_LABEL } from '../../lib/keywordUi'
import { BTN_GHOST, BTN_LIME, BTN_LINK, CARD, CARD_TITLE, FIELD, LABEL } from '../../lib/ui'
import type { ClientDetail, ImportSource, KeywordChanges, KeywordItem, KeywordRole, KeywordStatus } from '../../types/seo'

// Keywords › Database (/clients/{site id}/keywords/database): every keyword of this client.
// Filters, role/intent tags, both volumes (KP range typed here, Semrush as imported), Track toggle,
// row checkboxes + bulk bar. Works the same for every client (services come from the client record).

const PAGE_SIZE = 100
const SMALL_FIELD = 'box-border min-h-9 rounded-xl border-[1.5px] border-solid border-vv-field-line bg-vv-field px-2 py-1 font-body text-[13px] text-vv-ink'
const NO_DATA = <span className="text-vv-muted" title="No data">—</span>

type Missing = '' | 'kp' | 'semrush' | 'kd'
type SortKey = 'keyword' | 'semrush' | 'kd' | 'cpc' | 'kp'
interface Filters {
  q: string
  role: '' | KeywordRole | 'none'
  service: string // '' | service id | 'none'
  intent: string
  source: '' | ImportSource
  missing: Missing
  track: '' | 'yes' | 'no'
  status: 'active' | KeywordStatus | 'all'
}
const NO_FILTERS: Filters = { q: '', role: '', service: '', intent: '', source: '', missing: '', track: '', status: 'active' }

function services(c: ClientDetail) {
  return c.categories.flatMap((cat) => cat.services.map((s) => ({ id: s.id, label: s.name, group: `${cat.code} · ${cat.name}` })))
}

export default function DatabasePage() {
  const c = useClientContext()
  const q = useKeywords(c.siteId)
  const save = useUpdateKeywords(c.siteId)
  const [f, setF] = useState<Filters>(NO_FILTERS)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'keyword', dir: 1 })
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmKp, setConfirmKp] = useState<{ value: string | null; clash: number } | null>(null)

  const svc = useMemo(() => services(c), [c])
  const svcName = useMemo(() => new Map(svc.map((s) => [s.id, s.label])), [svc])
  const all = useMemo(() => q.data ?? [], [q.data])
  const intents = useMemo(() => [...new Set(all.flatMap((k) => intentParts(k.intent).map((p) => p.label)))].sort(), [all])

  const rows = useMemo(() => {
    const text = f.q.trim().toLowerCase()
    const out = all.filter((k) => {
      if (text && !k.keyword.toLowerCase().includes(text)) return false
      if (f.role && (f.role === 'none' ? k.role !== null : k.role !== f.role)) return false
      if (f.service && (f.service === 'none' ? k.serviceId !== null : k.serviceId !== f.service)) return false
      if (f.intent && !intentParts(k.intent).some((p) => p.label === f.intent)) return false
      if (f.source && !k.sources.includes(f.source)) return false
      if (f.missing === 'kp' && k.kpVolume) return false
      if (f.missing === 'semrush' && k.semrushVolume !== null) return false
      if (f.missing === 'kd' && k.kd !== null) return false
      if (f.track && k.track !== (f.track === 'yes')) return false
      if (f.status === 'active' && k.status === 'rejected') return false
      if (f.status !== 'active' && f.status !== 'all' && k.status !== f.status) return false
      return true
    })
    const val = (k: KeywordItem): number | string | null =>
      sort.key === 'keyword' ? k.keyword.toLowerCase() : sort.key === 'semrush' ? k.semrushVolume : sort.key === 'kd' ? k.kd : sort.key === 'cpc' ? k.cpc : k.kpStandIn === null ? null : Number(k.kpStandIn)
    return out.sort((a, b) => {
      const x = val(a)
      const y = val(b)
      if (x === y) return 0
      if (x === null) return 1 // no data always last
      if (y === null) return -1
      return (x < y ? -1 : 1) * sort.dir
    })
  }, [all, f, sort])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const cur = Math.min(page, pages - 1)
  const shown = rows.slice(cur * PAGE_SIZE, (cur + 1) * PAGE_SIZE)
  const filtered = JSON.stringify(f) !== JSON.stringify(NO_FILTERS)
  // Any filter or sort change goes back to page 1.
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setF((o) => ({ ...o, [k]: v }))
    setPage(0)
  }
  const clearFilters = () => {
    setF(NO_FILTERS)
    setPage(0)
  }

  const run = async (ids: string[], changes: KeywordChanges, overwriteKp = false) => {
    setMessage(null)
    try {
      const res = await save.mutateAsync({ ids, changes, overwriteKp })
      if ('needsConfirm' in res) {
        setConfirmKp({ value: changes.kpVolume ?? null, clash: res.needsConfirm })
        return
      }
      if (ids.length > 1) setMessage({ ok: true, text: `Saved ${ids.length} keywords.` })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError && e.detail ? e.detail : 'Couldn’t save. Check your connection and try again.' })
    }
  }
  const bulk = (changes: KeywordChanges) => void run([...selected], changes)
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const pageAllSelected = shown.length > 0 && shown.every((k) => selected.has(k.id))
  const sortBy = (key: SortKey) => { setPage(0); setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'keyword' ? 1 : -1 })) }

  if (q.isPending)
    return (
      <section className={CARD} aria-busy="true">
        <span role="status" className="sr-only">Loading keywords</span>
        <Bone className="h-7 w-56" />
        <Bone className="h-10 w-full rounded-2xl" />
        {Array.from({ length: 8 }, (_, i) => <Bone key={i} className="h-9 w-full" />)}
      </section>
    )

  if (q.isError)
    return (
      <section className={`${CARD} items-start`}>
        <h2 className={CARD_TITLE}>Couldn’t load the keywords</h2>
        <p className="m-0 text-[15px] text-vv-body">Try again in a moment.</p>
        <button type="button" className={BTN_GHOST} onClick={() => void q.refetch()}>Try again</button>
      </section>
    )

  if (all.length === 0)
    return (
      <section className={`${CARD} items-start`}>
        <h2 className={CARD_TITLE}>No keywords <em className="font-medium text-vv-purple">yet</em></h2>
        <p className="m-0 max-w-[640px] text-[15px] text-vv-body">Import Keyword Planner or Semrush exports and every keyword shows up here, with both volumes kept exactly as exported.</p>
        <Link to={`/clients/${c.siteId}/keywords/import`} className={BTN_LIME}>Import keywords</Link>
      </section>
    )

  const counts = {
    noKp: all.filter((k) => !k.kpVolume && k.status !== 'rejected').length,
    tracked: all.filter((k) => k.track).length,
    noRole: all.filter((k) => !k.role && k.status !== 'rejected').length,
  }

  return (
    <section className={CARD} aria-labelledby="db-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="db-h" className={CARD_TITLE}>Keyword <em className="font-medium text-vv-purple">database</em></h2>
          <p className="m-0 text-sm text-vv-muted">
            {all.length.toLocaleString()} keywords · {counts.tracked} tracked · {counts.noKp} without a KP range · {counts.noRole} without a role
          </p>
        </div>
        <Link to={`/clients/${c.siteId}/keywords/import`} className={BTN_GHOST}>Import more</Link>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 phone:grid-cols-2">
        <label className={`${LABEL} col-span-2`}>
          Search
          <input className={FIELD} type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="e.g. brazilian" />
        </label>
        <label className={LABEL}>
          Role
          <select className={FIELD} value={f.role} onChange={(e) => set('role', e.target.value as Filters['role'])}>
            <option value="">All</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            <option value="none">No role</option>
          </select>
        </label>
        <label className={LABEL}>
          Service
          <select className={FIELD} value={f.service} onChange={(e) => set('service', e.target.value)}>
            <option value="">All</option>
            <ServiceOptions svc={svc} />
            <option value="none">No service</option>
          </select>
        </label>
        <label className={LABEL}>
          Intent
          <select className={FIELD} value={f.intent} onChange={(e) => set('intent', e.target.value)}>
            <option value="">All</option>
            {intents.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
        <label className={LABEL}>
          Source
          <select className={FIELD} value={f.source} onChange={(e) => set('source', e.target.value as Filters['source'])}>
            <option value="">All</option>
            {(['kp', 'semrush', 'sheet'] as ImportSource[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className={LABEL}>
          Missing data
          <select className={FIELD} value={f.missing} onChange={(e) => set('missing', e.target.value as Missing)}>
            <option value="">Any</option>
            <option value="kp">No KP range</option>
            <option value="semrush">No Semrush volume</option>
            <option value="kd">No KD</option>
          </select>
        </label>
        <label className={LABEL}>
          Tracked
          <select className={FIELD} value={f.track} onChange={(e) => set('track', e.target.value as Filters['track'])}>
            <option value="">All</option>
            <option value="yes">Tracked</option>
            <option value="no">Not tracked</option>
          </select>
        </label>
        <label className={LABEL}>
          Status
          <select className={FIELD} value={f.status} onChange={(e) => set('status', e.target.value as Filters['status'])}>
            <option value="active">Keep + Later</option>
            <option value="keep">Keep</option>
            <option value="later">Later</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-vv-muted">
        <span aria-live="polite">
          {rows.length === all.length ? `Showing all ${rows.length.toLocaleString()}` : `${rows.length.toLocaleString()} of ${all.length.toLocaleString()} match`}
        </span>
        {filtered && <button type="button" className={BTN_LINK} onClick={clearFilters}>Clear filters</button>}
      </div>

      {message && (
        <p role="status" className={`m-0 rounded-2xl px-4 py-3 text-sm font-semibold ${message.ok ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-red-100 text-vv-red'}`}>
          {message.text}
        </p>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-solid border-vv-line bg-vv-lavender-50 px-3 py-2.5 text-sm">
          <strong>{selected.size} selected</strong>
          {selected.size < rows.length && <button type="button" className={BTN_LINK} onClick={() => setSelected(new Set(rows.map((k) => k.id)))}>Select all {rows.length} filtered</button>}
          <button type="button" className={BTN_LINK} onClick={() => setSelected(new Set())}>Clear</button>
          <span className="flex-1" />
          {save.isPending && <Spinner />}
          <BulkKp onSet={(v) => bulk({ kpVolume: v })} disabled={save.isPending} />
          <select aria-label="Set role" className={SMALL_FIELD} value="" disabled={save.isPending} onChange={(e) => bulk({ role: e.target.value === 'none' ? null : (e.target.value as KeywordRole) })}>
            <option value="" disabled>Role…</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            <option value="none">No role</option>
          </select>
          <select aria-label="Set service" className={SMALL_FIELD} value="" disabled={save.isPending} onChange={(e) => bulk({ serviceId: e.target.value === 'none' ? null : e.target.value })}>
            <option value="" disabled>Service…</option>
            <ServiceOptions svc={svc} />
            <option value="none">No service</option>
          </select>
          <select aria-label="Set tracking" className={SMALL_FIELD} value="" disabled={save.isPending} onChange={(e) => bulk({ track: e.target.value === 'on' })}>
            <option value="" disabled>Track…</option>
            <option value="on">Track</option>
            <option value="off">Don’t track</option>
          </select>
          <select aria-label="Set status" className={SMALL_FIELD} value="" disabled={save.isPending} onChange={(e) => bulk({ status: e.target.value as KeywordStatus })}>
            <option value="" disabled>Status…</option>
            {(Object.keys(STATUS_LABEL) as KeywordStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="m-0 text-[15px] text-vv-muted">
          No keywords match these filters. <button type="button" className={BTN_LINK} onClick={clearFilters}>Clear filters</button>
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="overflow-x-auto phone:hidden">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-vv-st-todo text-vv-st-todo-ink">
                  <th className="w-8 px-2 py-2">
                    <input type="checkbox" aria-label="Select this page" checked={pageAllSelected} onChange={() => setSelected((s) => { const n = new Set(s); shown.forEach((k) => (pageAllSelected ? n.delete(k.id) : n.add(k.id))); return n })} />
                  </th>
                  <SortTh label="Keyword" k="keyword" sort={sort} onSort={sortBy} />
                  <th className="px-2 py-2 font-semibold">Role</th>
                  <th className="px-2 py-2 font-semibold">Service</th>
                  <th className="px-2 py-2 font-semibold">Intent</th>
                  <SortTh label="KP range" k="kp" sort={sort} onSort={sortBy} title="Sorts by the Keyword Planner export number (the greyed hint)" />
                  <SortTh label="Semrush" k="semrush" sort={sort} onSort={sortBy} right />
                  <SortTh label="KD" k="kd" sort={sort} onSort={sortBy} right />
                  <SortTh label="CPC" k="cpc" sort={sort} onSort={sortBy} right />
                  <th className="px-2 py-2 font-semibold">Track</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold">Sources</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((k) => (
                  <tr key={k.id} className={`border-t border-solid border-vv-line align-middle ${selected.has(k.id) ? 'bg-vv-lavender-50' : ''} ${k.status === 'rejected' ? 'opacity-60' : ''}`}>
                    <td className="px-2 py-1.5">
                      <input type="checkbox" aria-label={`Select ${k.keyword}`} checked={selected.has(k.id)} onChange={() => toggle(k.id)} />
                    </td>
                    <td className="max-w-[280px] px-2 py-1.5 font-semibold" title={k.notes ?? undefined}>{k.keyword}</td>
                    <td className="px-2 py-1.5"><RoleSelect k={k} onSave={(role) => void run([k.id], { role })} /></td>
                    <td className="px-2 py-1.5">
                      <select aria-label={`Service for ${k.keyword}`} className={`${SMALL_FIELD} max-w-[160px]`} value={k.serviceId ?? ''} onChange={(e) => void run([k.id], { serviceId: e.target.value || null })}>
                        <option value="">—</option>
                        <ServiceOptions svc={svc} />
                      </select>
                    </td>
                    <td className="px-2 py-1.5"><Intent k={k} /></td>
                    <td className="px-2 py-1.5"><KpCell k={k} onSave={(v) => void run([k.id], { kpVolume: v })} /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{k.semrushVolume === null ? NO_DATA : num(k.semrushVolume)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{k.kd === null ? NO_DATA : k.kd}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{k.cpc === null ? NO_DATA : `$${k.cpc.toFixed(2)}`}</td>
                    <td className="px-2 py-1.5"><TrackToggle k={k} onSave={(track) => void run([k.id], { track })} /></td>
                    <td className="px-2 py-1.5"><StatusSelect k={k} onSave={(status) => void run([k.id], { status })} /></td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs text-vv-muted">{k.sources.map((s) => SOURCE_LABEL[s].replace(' (testing)', '')).join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="m-0 hidden list-none flex-col gap-2.5 p-0 phone:flex">
            {shown.map((k) => (
              <li key={k.id} className={`flex flex-col gap-2 rounded-2xl border border-solid border-vv-line p-3 ${selected.has(k.id) ? 'bg-vv-lavender-50' : ''} ${k.status === 'rejected' ? 'opacity-60' : ''}`}>
                <label className="flex items-start gap-2 font-semibold">
                  <input type="checkbox" className="mt-1" checked={selected.has(k.id)} onChange={() => toggle(k.id)} />
                  <span className="min-w-0 break-words">{k.keyword}</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <RoleSelect k={k} onSave={(role) => void run([k.id], { role })} />
                  <Intent k={k} />
                  <TrackToggle k={k} onSave={(track) => void run([k.id], { track })} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                  <span className="text-vv-muted">KP</span> <KpCell k={k} onSave={(v) => void run([k.id], { kpVolume: v })} />
                  <span><span className="text-vv-muted">Semrush</span> {k.semrushVolume === null ? NO_DATA : num(k.semrushVolume)}</span>
                  <span><span className="text-vv-muted">KD</span> {k.kd ?? NO_DATA}</span>
                  <span><span className="text-vv-muted">CPC</span> {k.cpc === null ? NO_DATA : `$${k.cpc.toFixed(2)}`}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select aria-label={`Service for ${k.keyword}`} className={SMALL_FIELD} value={k.serviceId ?? ''} onChange={(e) => void run([k.id], { serviceId: e.target.value || null })}>
                    <option value="">No service</option>
                    <ServiceOptions svc={svc} />
                  </select>
                  <StatusSelect k={k} onSave={(status) => void run([k.id], { status })} />
                </div>
                <span className="text-xs text-vv-muted">{k.serviceId ? svcName.get(k.serviceId) : ''}{k.sources.length ? ` · ${k.sources.map((s) => SOURCE_LABEL[s].replace(' (testing)', '')).join(' · ')}` : ''}</span>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <button type="button" className={BTN_GHOST} disabled={cur === 0} onClick={() => setPage(cur - 1)}>← Previous</button>
              <span>Page {cur + 1} of {pages}</span>
              <button type="button" className={BTN_GHOST} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next →</button>
            </nav>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmKp}
        title={`Replace ${confirmKp?.clash ?? 0} KP ranges?`}
        body={<p className="m-0">{confirmKp?.clash} of the selected keywords already have a different KP range. Replace them with “{confirmKp?.value ?? 'blank'}”?</p>}
        confirmLabel="Replace"
        busy={save.isPending}
        onCancel={() => setConfirmKp(null)}
        onConfirm={() => {
          const v = confirmKp?.value ?? null
          setConfirmKp(null)
          void run([...selected], { kpVolume: v }, true)
        }}
      />
    </section>
  )
}

function ServiceOptions({ svc }: { svc: ReturnType<typeof services> }) {
  const groups = [...new Set(svc.map((s) => s.group))]
  return (
    <>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {svc.filter((s) => s.group === g).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </optgroup>
      ))}
    </>
  )
}

function SortTh(props: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; right?: boolean; title?: string }) {
  const active = props.sort.key === props.k
  return (
    <th className={`px-2 py-2 font-semibold ${props.right ? 'text-right' : ''}`} aria-sort={active ? (props.sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" title={props.title} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-inherit" onClick={() => props.onSort(props.k)}>
        {props.label} {active ? (props.sort.dir === 1 ? '↑' : '↓') : ''}
      </button>
    </th>
  )
}

function RoleSelect({ k, onSave }: { k: KeywordItem; onSave: (r: KeywordRole | null) => void }) {
  return (
    <select
      aria-label={`Role for ${k.keyword}`}
      className={`${k.role ? ROLE_PILL[k.role] : 'inline-flex rounded-full border border-dashed border-vv-field-line bg-transparent px-3 py-1 text-xs font-bold text-vv-muted'} cursor-pointer appearance-none border-0 text-center`}
      value={k.role ?? ''}
      onChange={(e) => onSave((e.target.value || null) as KeywordRole | null)}
    >
      <option value="">+ Role</option>
      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
    </select>
  )
}

function StatusSelect({ k, onSave }: { k: KeywordItem; onSave: (s: KeywordStatus) => void }) {
  return (
    <select aria-label={`Status for ${k.keyword}`} className={SMALL_FIELD} value={k.status} onChange={(e) => onSave(e.target.value as KeywordStatus)}>
      {(Object.keys(STATUS_LABEL) as KeywordStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
    </select>
  )
}

function Intent({ k }: { k: KeywordItem }) {
  const parts = intentParts(k.intent)
  if (!parts.length) return NO_DATA
  return (
    <span className="inline-flex gap-1">
      {parts.map((p) => <span key={p.label} className={p.className} title={p.label}>{p.short}<span className="sr-only"> {p.label}</span></span>)}
    </span>
  )
}

function TrackToggle({ k, onSave }: { k: KeywordItem; onSave: (t: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={k.track}
      aria-label={`Track ${k.keyword}`}
      onClick={() => onSave(!k.track)}
      className={`relative inline-flex h-6 w-11 flex-none cursor-pointer items-center rounded-full border-0 p-0 transition-colors ${k.track ? 'bg-vv-purple' : 'bg-vv-toggle-line'}`}
    >
      <span className={`absolute h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${k.track ? 'translate-x-[23px]' : 'translate-x-[3px]'}`} />
    </button>
  )
}

/** KP range: click to edit. Quick picks + type your own. Enter / Tab saves (Tab moves to the next row). */
function KpCell({ k, onSave }: { k: KeywordItem; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(k.kpVolume ?? '')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) ref.current?.select()
  }, [editing])
  const commit = () => {
    setEditing(false)
    const v = value.trim()
    if (v !== (k.kpVolume ?? '')) onSave(v || null)
  }
  const hint = k.kpStandIn ? <span className="text-xs text-vv-muted" title="Keyword Planner export number (a stand-in, never used as the range)">KP export: {k.kpStandIn}</span> : null

  if (!editing)
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5" data-kp-cell>
        <button
          type="button"
          onClick={() => { setValue(k.kpVolume ?? ''); setEditing(true) }}
          className={`min-h-8 cursor-pointer rounded-lg border border-solid px-2 text-[13px] ${k.kpVolume ? 'border-transparent bg-transparent font-semibold text-vv-ink hover:border-vv-field-line' : 'border-dashed border-vv-field-line bg-transparent text-vv-muted'}`}
          aria-label={`KP range for ${k.keyword}: ${k.kpVolume ?? 'not set'}. Edit`}
          title={k.kpVolumeBy === 'sheet' ? 'From the Sheet import' : k.kpVolumeBy === 'typed' ? 'Typed here' : undefined}
        >
          {k.kpVolume ?? 'Set'}
        </button>
        {!k.kpVolume && hint}
      </span>
    )

  return (
    <span className="inline-flex items-center gap-1.5" data-kp-cell>
      <input
        ref={ref}
        list="kp-picks"
        aria-label={`KP range for ${k.keyword}`}
        className={`${SMALL_FIELD} w-[120px]`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setValue(k.kpVolume ?? ''); setEditing(false) }
          if (e.key === 'Tab' && !e.shiftKey) {
            // Save, then open the next row's KP range so a long list goes quickly.
            const cells = [...document.querySelectorAll<HTMLElement>('[data-kp-cell]')].filter((el) => el.offsetParent !== null)
            const next = cells[cells.indexOf(e.currentTarget.closest('[data-kp-cell]') as HTMLElement) + 1]
            if (next) { e.preventDefault(); commit(); requestAnimationFrame(() => next.querySelector('button')?.click()) }
          }
        }}
      />
      <datalist id="kp-picks">{KP_PICKS.map((p) => <option key={p} value={p} />)}</datalist>
      {hint}
    </span>
  )
}

/** Bulk bar: set a KP range on all selected (quick picks, or type one). */
function BulkKp({ onSet, disabled }: { onSet: (v: string | null) => void; disabled: boolean }) {
  const [custom, setCustom] = useState(false)
  const [value, setValue] = useState('')
  if (custom)
    return (
      <span className="inline-flex items-center gap-1.5">
        <input aria-label="KP range for the selected keywords" className={`${SMALL_FIELD} w-[110px]`} value={value} autoFocus onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { onSet(value.trim()); setCustom(false); setValue('') } if (e.key === 'Escape') setCustom(false) }} />
        <button type="button" className={BTN_LINK} disabled={disabled || !value.trim()} onClick={() => { onSet(value.trim()); setCustom(false); setValue('') }}>Set</button>
      </span>
    )
  return (
    <select
      aria-label="Set KP range"
      className={SMALL_FIELD}
      value=""
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value === '__type') setCustom(true)
        else onSet(e.target.value === '__clear' ? null : e.target.value)
      }}
    >
      <option value="" disabled>KP range…</option>
      {KP_PICKS.map((p) => <option key={p} value={p}>{p}</option>)}
      <option value="__type">Type a range…</option>
      <option value="__clear">Clear range</option>
    </select>
  )
}
