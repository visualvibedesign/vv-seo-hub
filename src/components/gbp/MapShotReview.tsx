import { useState } from 'react'
import { useApproveMapShot, useDiscardMapShot } from '../../hooks/useGbpCheck'
import { agencyDateTime } from '../../lib/agencyTime'
import { ApiError } from '../../lib/api'
import { MAX_COMPETITORS } from '../../lib/gbpCheck'
import { BTN_GHOST, BTN_LIME, BTN_LINK, FIELD } from '../../lib/ui'
import type { MapCompetitor, MapShotRead } from '../../types/seo'
import { Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// 4a step 4 · checking Claude's Maps screenshot read. Each row can be kept or left out, and rank / name / numbers can
// be fixed. "Add rows" goes through the normal competitor rules (a name already in the list updates that row; empty
// boxes keep what's there). Nothing is saved until then; "Discard" throws the read away.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const str = (v: number | null) => (v === null ? '' : String(v))
const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

type Edit = { keep: boolean; isClient: boolean; rank: string; name: string; primaryCategory: string; additional: string; reviews: string; rating: string; newestReviewOn: string }

export default function MapShotReview({ siteId, read, serviceLabel, existing, previewUrl, onClose }: { siteId: string; read: MapShotRead; serviceLabel: string; existing: MapCompetitor[]; previewUrl: string | null; onClose: () => void }) {
  const approve = useApproveMapShot(siteId)
  const discard = useDiscardMapShot(siteId)
  const names = new Set(existing.map((e) => e.name.toLowerCase()))
  const hasClientRow = existing.some((e) => e.isClient)
  const [rows, setRows] = useState<Edit[]>(() =>
    read.rows.map((r, i) => ({
      keep: r.looksLikeClient ? !hasClientRow : i < MAX_COMPETITORS, // your row: only if none is saved yet
      isClient: r.looksLikeClient,
      rank: str(r.rank),
      name: r.name,
      primaryCategory: r.primaryCategory ?? '',
      additional: r.additionalCategories.join(', '),
      reviews: str(r.reviews),
      rating: str(r.rating),
      newestReviewOn: r.newestReviewOn ?? '',
    })),
  )
  const set = (i: number, patch: Partial<Edit>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const kept = rows.filter((r) => r.keep)
  const busy = approve.isPending || discard.isPending
  const cell = `${FIELD} !rounded-xl !px-2 !py-1.5 !text-[13px]`

  return (
    <Modal open wide="xl" title={`Check the screenshot read · ${serviceLabel}`} onClose={() => !busy && onClose()}>
      <div className="flex max-h-[72vh] flex-col gap-3 overflow-y-auto pr-1 outline-none">
        <p className="m-0 text-[13px] text-vv-body">
          {read.summary} · read {agencyDateTime(read.createdAt)}. Tick the rows to add and fix anything that’s off. Empty = not read (never 0). A name already in the list updates that row.
        </p>
        {read.notes.length > 0 && <p className="m-0 rounded-xl bg-vv-st-waiting px-3 py-2 text-[13px] text-vv-st-waiting-ink">Claude noted: {read.notes.join(' · ')}</p>}
        {previewUrl && <img src={previewUrl} alt="The screenshot that was read" className="max-h-[220px] w-full rounded-xl border border-solid border-vv-line object-contain object-top" />}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((r, i) => (
            <li key={i} className={`flex flex-col gap-2 rounded-2xl border border-solid px-3 py-2.5 ${r.keep ? 'border-vv-lavender bg-vv-surface' : 'border-vv-line bg-vv-lavender-50 opacity-70'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <input type="checkbox" aria-label={`Add ${r.name}`} className="h-4 w-4 accent-[#7C5CE6]" checked={r.keep} onChange={(e) => set(i, { keep: e.target.checked })} />
                <input className={`${cell} !w-14`} aria-label="Rank" inputMode="numeric" value={r.rank} placeholder="#" onChange={(e) => set(i, { rank: e.target.value })} />
                <input className={`${cell} min-w-0 flex-1 basis-[160px]`} aria-label="Business name" value={r.name} maxLength={120} onChange={(e) => set(i, { name: e.target.value })} />
                <label className="flex items-center gap-1.5 text-[12px] font-semibold text-vv-body phone:basis-full phone:pl-6">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-[#7C5CE6]" checked={r.isClient} onChange={(e) => set(i, { isClient: e.target.checked })} />
                  This is the client
                </label>
                {names.has(r.name.trim().toLowerCase()) && <span className="text-[12px] font-semibold text-vv-purple-ink">updates the row in the list</span>}
              </div>
              {r.keep && (
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_70px_70px_minmax(0,1fr)] gap-2 phone:grid-cols-2">
                  <input className={cell} aria-label="Primary category" placeholder="Primary category" value={r.primaryCategory} onChange={(e) => set(i, { primaryCategory: e.target.value })} />
                  <input className={cell} aria-label="Additional categories" placeholder="Additional (comma between)" value={r.additional} onChange={(e) => set(i, { additional: e.target.value })} />
                  <input className={cell} aria-label="Reviews" placeholder="Reviews" inputMode="numeric" value={r.reviews} onChange={(e) => set(i, { reviews: e.target.value })} />
                  <input className={cell} aria-label="Rating" placeholder="★" inputMode="decimal" value={r.rating} onChange={(e) => set(i, { rating: e.target.value })} />
                  <input className={cell} aria-label="Newest review" type="date" value={r.newestReviewOn} onChange={(e) => set(i, { newestReviewOn: e.target.value })} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      {(approve.error || discard.error) && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(approve.error ?? discard.error, 'Couldn’t save.')}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" className={`${BTN_GHOST} mr-auto !min-h-10 !px-4`} disabled={busy} onClick={() => discard.mutate(read.id, { onSuccess: onClose })}>
          {discard.isPending && <Spinner />}
          Discard read
        </button>
        <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={busy}>
          Later
        </button>
        <button
          type="button"
          className={BTN_LIME}
          disabled={busy || !kept.length}
          onClick={() =>
            approve.mutate(
              {
                id: read.id,
                rows: kept.map((r) => ({
                  isClient: r.isClient,
                  rank: numOrNull(r.rank),
                  name: r.name,
                  primaryCategory: r.primaryCategory.trim() || null,
                  additionalCategories: r.additional.split(',').map((x) => x.trim()).filter(Boolean),
                  reviews: numOrNull(r.reviews),
                  rating: numOrNull(r.rating),
                  newestReviewOn: r.newestReviewOn || null,
                })),
              },
              { onSuccess: onClose },
            )
          }
        >
          {approve.isPending && <Spinner />}
          Add {kept.length} row{kept.length === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  )
}
