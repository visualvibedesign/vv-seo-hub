import { useState } from 'react'
import { useDeleteMapCompetitor, useSaveMapCompetitor } from '../../hooks/useGbpCheck'
import { ApiError } from '../../lib/api'
import { BTN_GHOST, BTN_LIME, BTN_LINK, FIELD, LABEL } from '../../lib/ui'
import type { MapCompetitor, MapServiceCode } from '../../types/seo'
import ConfirmDialog from '../ui/ConfirmDialog'
import { Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// Phase 4a · add / edit one map-pack row (a competitor, or the client's own row). Numbers exactly as seen on Maps;
// an empty box stays empty ("—"), never 0.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)
const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v))

export type CompetitorDraft = Partial<MapCompetitor> & { category: MapServiceCode; isClient: boolean }

export default function CompetitorDialog({ siteId, draft, serviceLabel, clientName, onClose }: { siteId: string; draft: CompetitorDraft; serviceLabel: string; clientName: string; onClose: () => void }) {
  const save = useSaveMapCompetitor(siteId)
  const del = useDeleteMapCompetitor(siteId)
  const [asking, setAsking] = useState(false)
  const [f, setF] = useState({
    rank: str(draft.rank),
    name: draft.name ?? (draft.isClient ? clientName : ''),
    primaryCategory: draft.primaryCategory ?? '',
    additional: (draft.additionalCategories ?? []).join(', '),
    reviews: str(draft.reviews),
    rating: str(draft.rating),
    newestReviewOn: draft.newestReviewOn ?? '',
    note: draft.note ?? '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const editing = !!draft.id
  const who = draft.isClient ? 'your row' : 'a competitor'
  const busy = save.isPending || del.isPending
  return (
    <Modal open wide title={`${editing ? 'Edit' : 'Add'} ${who} · ${serviceLabel}`} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(
            {
              id: draft.id ?? null,
              category: draft.category,
              isClient: draft.isClient,
              rank: f.rank === '' ? null : Number(f.rank),
              name: f.name,
              primaryCategory: f.primaryCategory || null,
              additionalCategories: f.additional.split(',').map((x) => x.trim()).filter(Boolean),
              reviews: f.reviews === '' ? null : Number(f.reviews),
              rating: f.rating === '' ? null : Number(f.rating),
              newestReviewOn: f.newestReviewOn || null,
              note: f.note || null,
            },
            { onSuccess: onClose },
          )
        }}
      >
        <p className="m-0 text-[13px] text-vv-body">
          {draft.isClient
            ? 'Where the client showed up in this search (leave # empty if not in the pack) and their own reviews.'
            : 'Unpaid results only (skip ads). Categories from Pleper. Leave a box empty if you can’t see it.'}
        </p>
        <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-3">
          <label className={LABEL}>
            #
            <input className={FIELD} inputMode="numeric" value={f.rank} onChange={set('rank')} placeholder="—" />
          </label>
          <label className={LABEL}>
            Business name
            <input className={FIELD} value={f.name} onChange={set('name')} maxLength={120} required />
          </label>
        </div>
        <label className={LABEL}>
          Primary category
          <input className={FIELD} value={f.primaryCategory} onChange={set('primaryCategory')} maxLength={120} placeholder="e.g. Website designer" />
        </label>
        <label className={LABEL}>
          Additional categories (comma between)
          <input className={FIELD} value={f.additional} onChange={set('additional')} placeholder="e.g. Graphic designer, Marketing agency" />
        </label>
        <div className="grid grid-cols-3 gap-3 phone-sm:grid-cols-1">
          <label className={LABEL}>
            Reviews
            <input className={FIELD} inputMode="numeric" value={f.reviews} onChange={set('reviews')} placeholder="—" />
          </label>
          <label className={LABEL}>
            Rating
            <input className={FIELD} inputMode="decimal" value={f.rating} onChange={set('rating')} placeholder="e.g. 4.8" />
          </label>
          <label className={LABEL}>
            Newest review
            <input className={FIELD} type="date" value={f.newestReviewOn} onChange={set('newestReviewOn')} />
          </label>
        </div>
        <label className={LABEL}>
          Note
          <input className={FIELD} value={f.note} onChange={set('note')} maxLength={300} placeholder="e.g. keyword-stuffed name, reviews stale" />
        </label>
        {(save.error || del.error) && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error ?? del.error, 'Couldn’t save the row.')}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editing && (
            <button type="button" className={`${BTN_GHOST} mr-auto !min-h-10 !px-4 text-vv-red`} onClick={() => setAsking(true)} disabled={busy}>
              Remove
            </button>
          )}
          <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={BTN_LIME} disabled={busy || !f.name.trim()}>
            {save.isPending && <Spinner />}
            Save
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={asking}
        title={`Remove ${f.name || 'this row'}?`}
        body={`It comes off the ${serviceLabel} list.`}
        confirmLabel="Remove"
        busy={del.isPending}
        onCancel={() => setAsking(false)}
        onConfirm={() => del.mutate(draft.id!, { onSuccess: () => { setAsking(false); onClose() } })}
      />
    </Modal>
  )
}
