import { useState } from 'react'
import { Link } from 'react-router'
import { useClientContext } from '../../components/layout/ClientLayout'
import HeaderTools from '../../components/layout/HeaderTools'
import { Bone, Spinner } from '../../components/ui/Loading'
import { useKeywords } from '../../hooks/useKeywords'
import { useMatrix, useSetMatrixCell } from '../../hooks/useMatrix'
import { ApiError } from '../../lib/api'
import { downloadTracked, trackedKeywords } from '../../lib/exportTracked'
import { num, ROLE_LABEL, ROLE_PILL, ROLES } from '../../lib/keywordUi'
import { BTN_GHOST, BTN_LIME, CARD, CARD_TITLE, FIELD, PILL } from '../../lib/ui'
import type { ClientDetail, KeywordItem, MatrixCell, MatrixKeyword, MatrixState } from '../../types/seo'

// Keywords › Matrix (/clients/{site id}/keywords), design docs/design/Keywords.png: Home + S1–S3 rows × A1–A3
// columns, one primary keyword per cell (+ backups). N/A areas show "N/A · one area only". Click a cell to pick.
// Only the matrix links change here; keywords themselves are edited on the Database page.

export default function MatrixPage() {
  const c = useClientContext()
  const m = useMatrix(c.siteId)
  const kws = useKeywords(c.siteId)
  const [open, setOpen] = useState<{ category: MatrixCell['category']; area: MatrixCell['area'] } | null>(null)
  const tracked = trackedKeywords(kws.data ?? [])
  const a1 = c.areas.find((a) => a.code === 'A1')

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-2.5">
          <h1 className="m-0 font-display text-[50px] font-semibold leading-none tracking-[-0.02em] phone:text-[36px] phone-sm:text-[32px]">
            Keywords + <em className="font-medium text-vv-purple">matrix.</em>
          </h1>
          <p className="m-0 text-[17px] leading-normal text-vv-body">Day 2 · one primary keyword per cell · volumes kept exactly as exported</p>
        </div>
        <HeaderTools>
          <button type="button" className={BTN_GHOST} disabled={!tracked.length} onClick={() => downloadTracked(c, tracked)} title={tracked.length ? undefined : 'No keyword has Track on yet'}>
            Export tracked list
          </button>
          <Link to={`/clients/${c.siteId}/keywords/import`} className={BTN_LIME}>
            Upload CSVs
          </Link>
        </HeaderTools>
      </header>

      <section className={CARD} aria-labelledby="mx-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="mx-h" className={CARD_TITLE}>
            3×3 matrix
          </h2>
          <span className="text-[14px] text-vv-body">Primary keyword per cell · Semrush vol · KP range</span>
        </div>
        {m.isPending && <Bone className="h-[420px] w-full rounded-2xl" />}
        {m.isError && (
          <p role="alert" className="m-0 text-[15px] font-semibold text-vv-red">
            Couldn’t load the matrix. Try again in a moment.
          </p>
        )}
        {m.data && <Grid matrix={m.data} open={open} onOpen={setOpen} />}
        {m.data && open && (
          <CellEditor
            key={`${open.category}-${open.area}`}
            client={c}
            matrix={m.data}
            cell={m.data.rows.find((r) => r.code === open.category)!.cells.find((x) => x.area === open.area)!}
            keywords={kws.data ?? []}
            loadingKeywords={kws.isPending}
            onClose={() => setOpen(null)}
          />
        )}
        {a1?.status === 'active' && m.data && !open && <p className="m-0 text-[13px] text-vv-muted">Click a cell to pick its primary keyword and backups.</p>}
      </section>

      <DatabaseSummary client={c} keywords={kws.data} pending={kws.isPending} />
    </>
  )
}

function Grid({ matrix, open, onOpen }: { matrix: MatrixState; open: { category: string; area: string } | null; onOpen: (o: { category: MatrixCell['category']; area: MatrixCell['area'] }) => void }) {
  const areaLabel = (code: string) => {
    const a = matrix.areas.find((x) => x.code === code)!
    return `${a.code} · ${[a.name, a.state].filter(Boolean).join(', ')}`
  }
  return (
    <>
      {/* Phones: one block per row; N/A areas on one short line */}
      <ul className="m-0 hidden list-none flex-col gap-4 p-0 phone:flex">
        {matrix.rows.map((r) => {
          const na = r.cells.filter((x) => x.state === 'n_a').map((x) => x.area)
          return (
            <li key={r.code} className="flex flex-col gap-2">
              <span>
                <span className="mr-1.5 text-[13px] font-bold text-vv-purple-deep">{r.code}</span>
                <span className="text-[15px] font-semibold">{r.name}</span>
              </span>
              {r.cells
                .filter((x) => x.state !== 'n_a')
                .map((cell) => (
                  <div key={cell.area} className="flex flex-col gap-1">
                    <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-vv-purple-deep">{areaLabel(cell.area)}</span>
                    <Cell cell={cell} on={open?.category === cell.category && open.area === cell.area} onOpen={() => onOpen({ category: cell.category, area: cell.area })} />
                  </div>
                ))}
              {na.length > 0 && <span className="text-[13px] text-vv-body">{na.join(', ')}: N/A · one area only</span>}
            </li>
          )
        })}
      </ul>
    <div className="overflow-x-auto phone:hidden">
      <table className="w-full min-w-[760px] border-separate border-spacing-2 text-left">
        <thead>
          <tr>
            <td className="w-[170px]" />
            {matrix.areas.map((a) => (
              <th key={a.code} scope="col" className={`px-1 pb-1 text-[13px] font-bold uppercase tracking-[0.06em] ${a.status === 'active' ? 'text-vv-purple-deep' : 'text-vv-body'}`}>
                {a.code} · {a.status === 'active' ? [a.name, a.state].filter(Boolean).join(', ') : 'N/A'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.code}>
              <th scope="row" className="pr-2 align-middle font-normal">
                <span className="block text-[13px] font-bold text-vv-purple-deep">{r.code}</span>
                <span className="block text-[15px] font-semibold text-vv-ink">{r.name}</span>
              </th>
              {r.cells.map((cell) => (
                <td key={cell.area} className="align-top">
                  <Cell cell={cell} on={open?.category === cell.category && open.area === cell.area} onOpen={() => onOpen({ category: cell.category, area: cell.area })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  )
}

function volumes(k: MatrixKeyword | KeywordItem): string {
  const sem = k.semrushVolume === null ? '—' : num(k.semrushVolume)
  const kp = !k.kpVolume ? '—' : /^no data$/i.test(k.kpVolume) ? 'no data' : k.kpVolume
  return `Semrush ${sem} · KP ${kp}`
}

function Cell({ cell, on, onOpen }: { cell: MatrixCell; on: boolean; onOpen: () => void }) {
  if (cell.state === 'n_a')
    return <div className="flex min-h-[112px] items-start rounded-[18px] border-[1.5px] border-dashed border-vv-field-line bg-vv-lavender-50 px-4 py-3.5 text-[15px] text-vv-body">N/A · one area only</div>
  const p = cell.primary
  const notLive = !!p?.page && p.page.status !== 'live'
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={on}
      aria-label={p ? `${cell.category} × ${cell.area}: ${p.keyword}. Change` : `${cell.category} × ${cell.area}: no primary yet. Pick one`}
      className={`flex min-h-[112px] w-full flex-col items-start gap-1.5 rounded-[18px] border-[1.5px] border-solid px-4 py-3.5 text-left font-body ${
        on ? 'border-vv-purple' : notLive ? 'border-[#f0d894] bg-[#fffaeb] dark:border-vv-field-line dark:bg-vv-lavender-50' : 'border-vv-field-line bg-vv-lavender-50 hover:border-vv-lavender'
      } ${!p ? 'border-dashed' : ''}`}
    >
      {p ? (
        <>
          <span className="text-[16px] font-bold text-vv-ink">{p.keyword}</span>
          <span className="text-[14px] text-vv-body">{volumes(p)}</span>
          {p.page ? (
            <span className={`${PILL} ${p.page.status === 'live' ? 'bg-vv-green-100 text-vv-green-ink' : 'bg-vv-st-waiting text-vv-st-waiting-ink'}`}>
              {p.page.status === 'live' ? 'Page live' : 'Page not live yet'}
            </span>
          ) : (
            <span className={`${PILL} bg-vv-st-todo text-vv-st-todo-ink`}>No page yet</span>
          )}
          {cell.backups.length > 0 && (
            <span className="text-[12px] text-vv-body" title={cell.backups.map((b) => b.keyword).join(', ')}>
              + {cell.backups.length} backup{cell.backups.length === 1 ? '' : 's'}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="text-[15px] font-semibold text-vv-purple-deep">Pick a primary ›</span>
          <span className="text-[13px] text-vv-body">Pending: no keyword chosen yet</span>
        </>
      )}
    </button>
  )
}

/** Candidates for a row: keywords on that row's services (Home row: Home services), plus what's already in the cell. */
function candidatesFor(c: ClientDetail, category: string, all: KeywordItem[], keep: string[]): KeywordItem[] {
  const svc = new Set(c.categories.find((k) => k.code === category)?.services.map((s) => s.id) ?? [])
  const rank = (k: KeywordItem) => (k.role === 'primary' ? 0 : k.role === 'secondary' ? 1 : k.role === 'near_me' ? 2 : 3)
  return all
    .filter((k) => k.status !== 'rejected' && ((k.serviceId && svc.has(k.serviceId)) || keep.includes(k.id)))
    .sort((a, b) => rank(a) - rank(b) || (b.semrushVolume ?? -1) - (a.semrushVolume ?? -1) || a.keyword.localeCompare(b.keyword))
}

function CellEditor({
  client: c,
  matrix,
  cell,
  keywords,
  loadingKeywords,
  onClose,
}: {
  client: ClientDetail
  matrix: MatrixState
  cell: MatrixCell
  keywords: KeywordItem[]
  loadingKeywords: boolean
  onClose: () => void
}) {
  const save = useSetMatrixCell(c.siteId)
  const [primary, setPrimary] = useState<string>(cell.primary?.id ?? '')
  const [backups, setBackups] = useState<Set<string>>(() => new Set(cell.backups.map((b) => b.id)))
  const [q, setQ] = useState('')
  const row = matrix.rows.find((r) => r.code === cell.category)!
  const area = matrix.areas.find((a) => a.code === cell.area)!
  const keep = [cell.primary?.id, ...cell.backups.map((b) => b.id)].filter((x): x is string => !!x)
  const cands = candidatesFor(c, cell.category, keywords, keep)
  // Primaries already used in other cells (a keyword can be the primary of one cell only).
  const usedElsewhere = new Map(
    matrix.rows.flatMap((r) => r.cells.filter((x) => x.primary && !(x.category === cell.category && x.area === cell.area)).map((x) => [x.primary!.id, `${x.category} × ${x.area}`] as const)),
  )
  const term = q.trim().toLowerCase()
  const backupList = cands.filter((k) => k.id !== primary && (!term || k.keyword.toLowerCase().includes(term)))
  const error = save.error ? (save.error instanceof ApiError && save.error.detail ? save.error.detail : 'Couldn’t save. Try again.') : ''

  const submit = () =>
    save.mutate({ category: cell.category, area: cell.area, primaryId: primary || null, backupIds: [...backups].filter((id) => id !== primary) }, { onSuccess: onClose })

  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-solid border-vv-line bg-vv-lavender-50 p-5 phone:p-4" role="group" aria-label="Edit cell">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 font-display text-[20px] font-semibold">
          {cell.category} {row.name} × {cell.area} {[area.name, area.state].filter(Boolean).join(', ')}
        </h3>
        <span className="text-[13px] text-vv-body">Keywords on this row’s services · Primary role first</span>
      </div>
      {loadingKeywords ? (
        <Bone className="h-24 w-full rounded-xl" />
      ) : (
        <>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-vv-body">
            Primary keyword
            <select className={FIELD} value={primary} onChange={(e) => setPrimary(e.target.value)}>
              <option value="">— No primary (Pending)</option>
              {ROLES.map((role) => {
                const list = cands.filter((k) => k.role === role)
                return list.length ? (
                  <optgroup key={role} label={ROLE_LABEL[role]}>
                    {list.map((k) => (
                      <option key={k.id} value={k.id} disabled={usedElsewhere.has(k.id)}>
                        {k.keyword} · {volumes(k)}
                        {usedElsewhere.has(k.id) ? ` (primary of ${usedElsewhere.get(k.id)})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              })}
              {cands.some((k) => !k.role) && (
                <optgroup label="Needs role">
                  {cands
                    .filter((k) => !k.role)
                    .map((k) => (
                      <option key={k.id} value={k.id} disabled={usedElsewhere.has(k.id)}>
                        {k.keyword} · {volumes(k)}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-vv-body">Backups ({[...backups].filter((id) => id !== primary).length})</span>
              <input type="search" className={`${FIELD} max-w-[260px] py-1.5 text-[14px]`} placeholder="Filter keywords" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter backup keywords" />
            </div>
            <ul className="m-0 flex max-h-[260px] list-none flex-col overflow-y-auto rounded-xl border border-solid border-vv-line bg-vv-surface p-1">
              {backupList.length === 0 && <li className="px-3 py-2 text-[14px] text-vv-muted">No keywords on this row’s services{term ? ' match' : ''}.</li>}
              {backupList.map((k) => (
                <li key={k.id}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-vv-lavender-50">
                    <input
                      type="checkbox"
                      className="h-[18px] w-[18px] accent-vv-purple"
                      checked={backups.has(k.id)}
                      onChange={() =>
                        setBackups((s) => {
                          const n = new Set(s)
                          if (n.has(k.id)) n.delete(k.id)
                          else n.add(k.id)
                          return n
                        })
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{k.keyword}</span>
                    {k.role && <span className={ROLE_PILL[k.role]}>{ROLE_LABEL[k.role]}</span>}
                    <span className="w-[150px] flex-none text-right text-[12px] text-vv-body phone:hidden">{volumes(k)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-vv-red-100 px-3 py-2 text-[14px] font-semibold text-vv-red">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={BTN_LIME} onClick={submit} disabled={save.isPending || loadingKeywords}>
          {save.isPending && <Spinner />}
          Save cell
        </button>
        <button type="button" className={BTN_GHOST} onClick={onClose} disabled={save.isPending}>
          Cancel
        </button>
      </div>
    </div>
  )
}

/** Under the matrix (design): the database at a glance, with a link to the full table. */
function DatabaseSummary({ client: c, keywords, pending }: { client: ClientDetail; keywords?: KeywordItem[]; pending: boolean }) {
  const active = (keywords ?? []).filter((k) => k.status !== 'rejected')
  const n = (role: KeywordItem['role']) => active.filter((k) => k.role === role).length
  return (
    <section className={CARD} aria-labelledby="mx-db">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="mx-db" className={CARD_TITLE}>
          Database
        </h2>
        <Link to={`/clients/${c.siteId}/keywords/database`} className="text-[15px] font-semibold text-vv-purple-deep underline">
          Open the database ›
        </Link>
      </div>
      {pending ? (
        <Bone className="h-10 w-full rounded-xl" />
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          <li className={`${PILL} bg-vv-lavender text-vv-ink`}>All {active.length.toLocaleString('en-US')}</li>
          {ROLES.map((r) => (
            <li key={r} className={ROLE_PILL[r]}>
              {ROLE_LABEL[r]} {n(r)}
            </li>
          ))}
          <li className={`${PILL} bg-vv-st-todo text-vv-st-todo-ink`}>Needs role {n(null)}</li>
          <li className={`${PILL} bg-vv-green-100 text-vv-green-ink`}>Tracked {trackedKeywords(keywords ?? []).length}</li>
        </ul>
      )}
    </section>
  )
}
