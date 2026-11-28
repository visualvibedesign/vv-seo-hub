import { useState } from 'react'
import { useAddPage } from '../../hooks/usePages'
import { ApiError } from '../../lib/api'
import { TYPE_LABEL } from '../../lib/pages'
import { BTN_LIME, BTN_LINK, FIELD, LABEL } from '../../lib/ui'
import type { CategoryCode, PagesState, PageType } from '../../types/seo'
import { Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// Phase 3 · "+ Add page" (Sitemap + hotspots, Site plan): a planned page (New) with the next free code. Its keywords
// are set in Clusters (a keyword sits on one page only).

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)

export default function AddPageDialog({ siteId, state, onClose, onAdded }: { siteId: string; state: PagesState; onClose: () => void; onAdded: (id: string | null) => void }) {
  const add = useAddPage(siteId)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<CategoryCode>('S1')
  const [type, setType] = useState<PageType>('service')
  return (
    <Modal open title="Add a page" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const before = new Set(state.pages.map((p) => p.id))
          add.mutate({ name, category, type }, { onSuccess: (st) => onAdded(st.pages.find((p) => !before.has(p.id))?.id ?? null) })
        }}
      >
        <p className="m-0 text-[13px] text-vv-body">A planned page (New) with the next free code. Give it its keywords in Clusters (a keyword sits on one page only).</p>
        <label className={LABEL}>
          Page name
          <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Web Design · Springdale" required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={LABEL}>
            Category
            <select className={FIELD} value={category} onChange={(e) => setCategory(e.target.value as CategoryCode)}>
              {(['Home', 'S1', 'S2', 'S3', 'FAQ'] as CategoryCode[]).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            Type
            <select className={FIELD} value={type} onChange={(e) => setType(e.target.value as PageType)}>
              {(Object.keys(TYPE_LABEL) as PageType[]).map((k) => (
                <option key={k} value={k}>
                  {TYPE_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {add.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(add.error, 'Couldn’t add the page.')}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={add.isPending}>
            Cancel
          </button>
          <button type="submit" className={BTN_LIME} disabled={add.isPending || !name.trim()}>
            {add.isPending && <Spinner />}
            Add page
          </button>
        </div>
      </form>
    </Modal>
  )
}
