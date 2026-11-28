import { useState } from 'react'
import { useMapShotEstimate, useReadMapShot } from '../../hooks/useGbpCheck'
import { formatUsd } from '../../lib/aiModels'
import { ApiError } from '../../lib/api'
import { ImageError, shrinkImage, type ShrunkImage } from '../../lib/imageShrink'
import { BTN_GHOST, BTN_LIME, BTN_LINK } from '../../lib/ui'
import type { MapServiceCode } from '../../types/seo'
import { Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// 4a step 4 · Competitors › "Read a screenshot": a Google Maps results list (PlePer / GMB Everywhere categories
// welcome) for one service. The browser shrinks it, the cost shows, then Claude reads it once. The rows are saved as
// "Ready to review" (nothing is in the list yet); the image stays in this browser only and is never stored.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : e instanceof ImageError ? e.message : fallback)

export default function MapShotDialog({ siteId, category, serviceLabel, onClose, onRead }: { siteId: string; category: MapServiceCode; serviceLabel: string; onClose: () => void; onRead: (previewUrl: string) => void }) {
  const [img, setImg] = useState<ShrunkImage | null>(null)
  const [prepError, setPrepError] = useState<unknown>(null)
  const [preparing, setPreparing] = useState(false)
  const estimate = useMapShotEstimate(siteId)
  const read = useReadMapShot(siteId)
  const busy = preparing || read.isPending

  const close = () => {
    if (busy) return
    if (img) URL.revokeObjectURL(img.previewUrl)
    onClose()
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    if (img) URL.revokeObjectURL(img.previewUrl)
    setImg(null)
    setPrepError(null)
    estimate.reset()
    read.reset()
    setPreparing(true)
    try {
      const s = await shrinkImage(file)
      setImg(s)
      estimate.mutate({ mediaType: s.mediaType, data: s.data })
    } catch (e) {
      setPrepError(e)
    } finally {
      setPreparing(false)
    }
  }

  const run = () => {
    if (!img) return
    read.mutate({ category, image: { mediaType: img.mediaType, data: img.data } }, { onSuccess: () => onRead(img.previewUrl) })
  }

  return (
    <Modal open title={`Read a Maps screenshot · ${serviceLabel}`} onClose={close} wide>
      <p className="m-0 text-[13px] text-vv-body">Search the service in Google Maps (Chrome guest profile), turn on PlePer for categories, then screenshot the results list. Claude reads only the unpaid businesses: name, categories, reviews, rating (and the newest review date if shown with a year). Ads are skipped; addresses and phones are never read. The image isn’t saved.</p>
      <label className={`${BTN_GHOST} min-h-10 w-fit cursor-pointer px-4 text-[13px] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
        {img ? 'Pick another screenshot' : 'Pick a screenshot'}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} disabled={busy} />
      </label>
      {preparing && (
        <span className="flex items-center gap-2 text-[13px] text-vv-body">
          <Spinner /> Preparing the image…
        </span>
      )}
      {img && <img src={img.previewUrl} alt="The screenshot to read" className="max-h-[260px] w-full rounded-xl border border-solid border-vv-line object-contain object-top" />}
      {img && (
        <div className="rounded-xl bg-vv-lavender-50 px-3 py-2.5 text-[13px]">
          {estimate.isPending ? (
            <span className="flex items-center gap-2 text-vv-body">
              <Spinner /> Working out the cost…
            </span>
          ) : estimate.isError || !estimate.data ? (
            <span className="font-semibold text-vv-red">{errText(estimate.error, 'Couldn’t work out the cost.')}</span>
          ) : (
            <span>
              <strong>{estimate.data.model}</strong> · about {estimate.data.inputTokens.toLocaleString('en-US')} tokens in (image included), up to {estimate.data.outputTokens.toLocaleString('en-US')} out · about <strong>{formatUsd(estimate.data.costUsd)}</strong>
            </span>
          )}
        </div>
      )}
      <p className="m-0 text-[12px] text-vv-muted">Saved as “Ready to review”: nothing goes in the list until you check the rows and add them. Unclear values stay empty (never 0). Logged in Settings › Claude usage.</p>
      {(prepError !== null || read.error) && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(prepError ?? read.error, 'Claude couldn’t read the screenshot.')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${BTN_LINK} px-3`} onClick={close} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={BTN_LIME} onClick={run} disabled={busy || !img || estimate.isPending || estimate.isError}>
          {read.isPending && <Spinner />}
          {read.isPending ? 'Reading…' : 'Read it'}
        </button>
      </div>
    </Modal>
  )
}
