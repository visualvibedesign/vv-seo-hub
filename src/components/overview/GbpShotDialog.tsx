import { useState } from 'react'
import { useGbpShotEstimate, useReadGbpShot } from '../../hooks/useLocal'
import { formatUsd } from '../../lib/aiModels'
import { ApiError } from '../../lib/api'
import { ImageError, shrinkImage, type ShrunkImage } from '../../lib/imageShrink'
import { BTN_GHOST, BTN_LIME, BTN_LINK } from '../../lib/ui'
import type { GbpScreenshotRead } from '../../types/seo'
import { Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// 2g · GBP card › "Read a screenshot": pick a GBP › Performance screenshot, the browser shrinks it, the cost shows,
// then Claude reads it once. The result is saved as "Ready to review" (nothing counts yet); the image stays in this
// browser only (for the review screen) and is never stored.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : e instanceof ImageError ? e.message : fallback)

export default function GbpShotDialog({ siteId, open, onClose, onRead }: { siteId: string; open: boolean; onClose: () => void; onRead: (read: GbpScreenshotRead, previewUrl: string) => void }) {
  const [img, setImg] = useState<ShrunkImage | null>(null)
  const [prepError, setPrepError] = useState<unknown>(null)
  const [preparing, setPreparing] = useState(false)
  const estimate = useGbpShotEstimate(siteId)
  const read = useReadGbpShot(siteId)
  const busy = preparing || read.isPending

  // Closing without reading drops the preview from memory (nothing was saved).
  const close = () => {
    if (busy) return
    if (img) URL.revokeObjectURL(img.previewUrl)
    setImg(null)
    setPrepError(null)
    estimate.reset()
    read.reset()
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
    read.mutate(
      { mediaType: img.mediaType, data: img.data },
      {
        onSuccess: (r) => {
          const url = img.previewUrl
          setImg(null) // handed over: the review screen owns the preview now
          estimate.reset()
          onRead(r.read, url)
        },
      },
    )
  }

  return (
    <Modal open={open} title="Read a GBP screenshot" onClose={close} wide>
      <p className="m-0 text-[13px] text-vv-body">GBP › Performance › pick the month, then take a screenshot that shows the period and the numbers. Claude reads only the period, profile views (and the Search / Maps split), calls, website clicks and directions. The image isn’t saved: it’s sent once and stays in this browser for your review.</p>
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
      <p className="m-0 text-[12px] text-vv-muted">Saved as “Ready to review”: nothing counts until you check it and approve. Unclear numbers stay empty (never 0); if the month isn’t clear, you pick it. Logged in Settings › Claude usage.</p>
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
