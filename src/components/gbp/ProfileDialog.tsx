import { useState } from 'react'
import { useSaveGbpProfile } from '../../hooks/useGbpCheck'
import { ApiError } from '../../lib/api'
import { DESCRIPTION_MAX } from '../../lib/gbpCheck'
import { BTN_LIME, BTN_LINK, FIELD, LABEL } from '../../lib/ui'
import type { GbpProfile } from '../../types/seo'
import { Spinner } from '../ui/Loading'
import Modal from '../ui/Modal'

// Phase 4a · GBP business details: PUBLIC fields only (they must match the website). There is no address field, on
// purpose: only "address shown on GBP?" yes / no. The server refuses anything that looks like a street address.

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.detail ? e.detail : fallback)

export default function ProfileDialog({ siteId, profile, onClose }: { siteId: string; profile: GbpProfile; onClose: () => void }) {
  const save = useSaveGbpProfile(siteId)
  const [f, setF] = useState({
    businessName: profile.businessName ?? '',
    website: profile.website ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    primaryCategory: profile.primaryCategory ?? '',
    additional: profile.additionalCategories.join(', '),
    serviceAreas: profile.serviceAreas ?? '',
    hours: profile.hours ?? '',
    holidayHours: profile.holidayHours ?? '',
    socials: profile.socials.join('\n'),
    bookingUrl: profile.bookingUrl ?? '',
    reviewUrl: profile.reviewUrl ?? '',
    description: profile.description ?? '',
    addressShown: profile.addressShown === null ? '' : profile.addressShown ? 'yes' : 'no',
    checkedOn: profile.checkedOn ?? '',
    waitingOnGoogle: profile.waitingOnGoogle ?? '',
    checkAgainOn: profile.checkAgainOn ?? '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const dashes = /[—–]/.test(f.description)
  const field = (k: keyof typeof f, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={LABEL}>
      {label}
      <input className={FIELD} value={f[k]} onChange={set(k)} {...extra} />
    </label>
  )
  return (
    <Modal open wide title="Business details" onClose={onClose}>
      <form
        className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(
            {
              businessName: f.businessName || null,
              website: f.website || null,
              phone: f.phone || null,
              email: f.email || null,
              primaryCategory: f.primaryCategory || null,
              additionalCategories: f.additional.split(',').map((x) => x.trim()).filter(Boolean),
              serviceAreas: f.serviceAreas || null,
              hours: f.hours || null,
              holidayHours: f.holidayHours || null,
              socials: f.socials.split(/[\n,]/).map((x) => x.trim()).filter(Boolean),
              bookingUrl: f.bookingUrl || null,
              reviewUrl: f.reviewUrl || null,
              description: f.description || null,
              addressShown: f.addressShown === '' ? null : f.addressShown === 'yes',
              profileChecks: profile.profileChecks,
              checkedOn: f.checkedOn || null,
              waitingOnGoogle: f.waitingOnGoogle || null,
              checkAgainOn: f.checkAgainOn || null,
            },
            { onSuccess: onClose },
          )
        }}
      >
        <p className="m-0 text-[13px] text-vv-body">Public only, as shown on GBP. Name, phone and website must match the website. The private address is never stored here.</p>
        {field('businessName', 'Business name (legal / DBA, no keyword stuffing)', { maxLength: 160 })}
        <div className="grid grid-cols-2 gap-3 phone-sm:grid-cols-1">
          {field('website', 'Website', { placeholder: 'example.com' })}
          {field('phone', 'Phone', { maxLength: 40 })}
          {field('email', 'Public email', { maxLength: 160 })}
          <label className={LABEL}>
            Address shown on GBP?
            <select className={FIELD} value={f.addressShown} onChange={set('addressShown')}>
              <option value="">Not checked</option>
              <option value="yes">Yes, shown</option>
              <option value="no">No, hidden (service area / home)</option>
            </select>
          </label>
        </div>
        {field('primaryCategory', 'Primary category', { maxLength: 120 })}
        {field('additional', 'Additional categories (comma between)')}
        {field('serviceAreas', 'Service areas (towns / areas, never a street)', { maxLength: 500 })}
        <label className={LABEL}>
          Hours
          <textarea className={`${FIELD} min-h-[70px]`} value={f.hours} onChange={set('hours')} maxLength={500} />
        </label>
        {field('holidayHours', 'Holiday / special hours', { maxLength: 300 })}
        <label className={LABEL}>
          Social profiles (one per line)
          <textarea className={`${FIELD} min-h-[70px]`} value={f.socials} onChange={set('socials')} />
        </label>
        <div className="grid grid-cols-2 gap-3 phone-sm:grid-cols-1">
          {field('bookingUrl', 'Booking link')}
          {field('reviewUrl', 'Review link')}
        </div>
        <label className={LABEL}>
          <span className="flex justify-between gap-2">
            Description (for people; ends with a call to action)
            <span className={f.description.length > DESCRIPTION_MAX ? 'text-vv-red' : ''}>
              {f.description.length} / {DESCRIPTION_MAX}
            </span>
          </span>
          <textarea className={`${FIELD} min-h-[120px]`} value={f.description} onChange={set('description')} />
          {dashes && <span className="font-semibold text-vv-red">No em or en dashes (Sam’s rule). Use a comma, a period or “and”.</span>}
        </label>
        <div className="grid grid-cols-2 gap-3 phone-sm:grid-cols-1">
          {field('checkedOn', 'Date checked', { type: 'date' })}
          {field('checkAgainOn', 'Check again on', { type: 'date' })}
        </div>
        {field('waitingOnGoogle', 'Waiting on Google (an edit pending approval)', { maxLength: 300, placeholder: 'e.g. description edit, ~10 min+' })}
        {save.error && <p className="m-0 text-[13px] font-semibold text-vv-red">{errText(save.error, 'Couldn’t save the details.')}</p>}
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 bg-vv-surface pt-2">
          <button type="button" className={`${BTN_LINK} px-3`} onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button type="submit" className={BTN_LIME} disabled={save.isPending || dashes || f.description.length > DESCRIPTION_MAX}>
            {save.isPending && <Spinner />}
            Save details
          </button>
        </div>
      </form>
    </Modal>
  )
}
