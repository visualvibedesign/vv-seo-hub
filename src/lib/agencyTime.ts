// The agency's time zone for every saved-at / drafted-at date: in the UI and in what's sent to Claude (Angel, Nov 28:
// a baseline saved on Nov 28 in Manila must never read "Nov 27", the UTC day). Date-only values (YYYY-MM-DD: report
// months, data windows, sent dates) are calendar days already and are shown as they are. No imports: shared by the
// server and the browser.

export const AGENCY_TZ = 'Asia/Manila'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** YYYY-MM-DD: the agency's calendar day for a timestamp (a date-only value is returned as is). */
export function agencyDay(value: string): string {
  if (DATE_ONLY.test(value)) return value
  return new Intl.DateTimeFormat('en-CA', { timeZone: AGENCY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

/** "Nov 28, 2026" in the agency's time zone (a date-only value is that calendar day). */
export function agencyDate(value: string): string {
  if (DATE_ONLY.test(value)) return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: AGENCY_TZ })
}

/** "Nov 28, 11:10 AM" in the agency's time zone. */
export function agencyDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: AGENCY_TZ })
}
