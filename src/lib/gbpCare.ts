// Phase 4b · GBP care (Sam Day 7) helpers shared by the server and the GBP care screen. Plain code only.
import type { PostStatus, ReviewChannel, ReviewResult } from '../types/seo.js'

export const POST_WEEKS = 13
export const DEFAULT_REVIEW_TARGET = 5
/** GBP post text limit */
export const POST_BODY_MAX = 1500

export const UTM = { utm_source: 'google', utm_medium: 'organic', utm_campaign: 'gbp-post' } as const

/** The page URL with the GBP post UTM tags (existing query kept; existing utm_* replaced). null if no URL. */
export function utmLink(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    for (const [k, v] of Object.entries(UTM)) u.searchParams.set(k, v)
    return u.toString()
  } catch {
    return null
  }
}

/** Week N's suggested date: the start date + 7 × (N − 1). */
export function weekDate(start: string, week: number): string {
  const d = new Date(`${start}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 7 * (week - 1))
  return d.toISOString().slice(0, 10)
}

/** Review ref rule (the database checks it too): short, no email, no phone-like run of 7+ digits. */
export function refProblem(ref: string): string | null {
  const t = ref.trim()
  if (!t) return 'Type a short ref (like “Nov job #12”).'
  if (t.length > 40) return 'Ref: 40 characters at most.'
  if (t.includes('@')) return 'Ref: no email addresses. Use a short ref like “Nov job #12”.'
  if (/([0-9][() .-]*){7,}/.test(t)) return 'Ref: no phone numbers. Use a short ref like “Nov job #12”.'
  return null
}

export const CHANNEL_LABEL: Record<ReviewChannel, string> = { email: 'Email', text: 'Text', in_person: 'In person', other: 'Other' }
export const RESULT_LABEL: Record<ReviewResult, string> = { waiting: 'Waiting', reviewed: 'Reviewed', no_reply: 'No reply', declined: 'Declined' }
export const POST_STATUS_LABEL: Record<PostStatus, string> = { not_drafted: 'Not drafted', drafted: 'Drafted', approved: 'Approved', scheduled: 'Scheduled', live: 'Live' }

/** Sam's GBP care routine (Day 7 › 4, playbook wording), ticked per client. */
export const CARE_ROUTINE: { key: string; label: string; when: 'Weekly' | 'When things change' | 'Monthly' }[] = [
  { key: 'reviews_messages', label: 'Reply to reviews + messages', when: 'Weekly' },
  { key: 'inquiries', label: 'Check inquiries', when: 'Weekly' },
  { key: 'posts', label: 'This week’s post is live', when: 'Weekly' },
  { key: 'facts', label: 'Hours, services, page links still right', when: 'When things change' },
  { key: 'photos', label: 'Add real photos (new projects / case studies)', when: 'Monthly' },
]
