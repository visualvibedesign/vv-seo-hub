import { useState } from 'react'
import { useCreateReport, useReportPreview } from '../../hooks/useReports'
import { ApiError } from '../../lib/api'
import { creatableMonths, snapshotDates, SOURCE_NAME } from '../../lib/baseline'
import { BTN_LIME, BTN_LINK, FIELD, LABEL } from '../../lib/ui'
import type { ReportsState } from '../../types/seo'
import { Bone, Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// Results › Create report: pick a month (from the baseline's month onward, without a report yet), see what it will
// freeze (each source's dates) and what's missing for that month, then create. Missing stays "—" in the report.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)

export default function CreateReport({ siteId, state, open, onClose, onCreated }: { siteId: string; state: ReportsState; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const months = creatableMonths(state)
  const [month, setMonth] = useState(months[0]?.month ?? '')
  const create = useCreateReport(siteId)
  const preview = useReportPreview(siteId, open && month ? month.slice(0, 7) : null)
  const title = months.find((m) => m.month === month)?.title ?? 'Report'
  return (
    <Modal open={open} title="Create a report" onClose={() => !create.isPending && onClose()}>
      {months.length === 0 ? (
        <p className="m-0 text-[13px] text-vv-body">Every month from the baseline onward already has a report.</p>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate(month.slice(0, 7), { onSuccess: (r) => onCreated(r.id) })
          }}
        >
          <label className={LABEL}>
            Month
            <select className={FIELD} value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.title}
                  {m.current ? ' (month not over)' : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="m-0 text-[13px] text-vv-body">Freezes the month’s numbers next to the baseline. Search Console + GA4 use the 28 days ending on the month’s last pulled day. You can refresh them while it’s a draft.</p>
          {preview.isPending ? (
            <Bone className="h-[96px] w-full rounded-xl" />
          ) : preview.isError || !preview.data ? (
            <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(preview.error, 'Couldn’t read the month’s numbers.')}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 rounded-xl bg-vv-lavender-50 p-3 text-[13px]">
              {preview.data.snapshots.map((s) => (
                <li key={s.source} className="flex flex-wrap justify-between gap-x-3">
                  <strong>{SOURCE_NAME[s.source]}</strong>
                  <span className="text-vv-body">{snapshotDates(s)}</span>
                </li>
              ))}
              {preview.data.missing.map((m) => (
                <li key={m.source} className="flex flex-wrap justify-between gap-x-3">
                  <strong>{SOURCE_NAME[m.source]}</strong>
                  <span className="font-semibold text-vv-orange-ink">{m.reason}</span>
                </li>
              ))}
            </ul>
          )}
          {create.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(create.error, 'Couldn’t create the report.')}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={create.isPending}>
              Cancel
            </button>
            <button type="submit" className={BTN_LIME} disabled={create.isPending || !month || preview.isError}>
              {create.isPending && <Spinner />}
              Create {title}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
