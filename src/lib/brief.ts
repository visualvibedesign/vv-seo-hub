// Phase 3 step 6 · The page brief: Sam's Day 5 "first page brief" worksheet + the 11 StoryBrand landing-page sections
// (Day 6). V1 = hotspots + header and footer (can lift a page to pages 3–5); V2 = all 11 sections. Shared by the server
// (Claude prompt) and the Page briefs screen.
import type { SectionKey, WorksheetKey } from '../types/seo.js'

export const SECTIONS: { key: SectionKey; label: string; hint: string; v1: boolean; optional?: boolean }[] = [
  { key: '1', label: 'Header', hint: 'Eyebrow "Service in City, State", headline, subheadline with a semantic triple ("X is a ___ that…"), call to action', v1: true },
  { key: '2', label: 'Stakes', hint: 'What happens if they pick the wrong business', v1: false },
  { key: '3', label: 'Value proposition', hint: 'What they get', v1: false },
  { key: '4', label: 'Guide', hint: 'Empathy + real authority (only real facts)', v1: false },
  { key: '5', label: 'Social proof', hint: 'Reviews, [placeholders] until real ones are in', v1: false },
  { key: '6', label: 'Path', hint: 'Exactly 3 steps', v1: false },
  { key: '7', label: 'Pricing', hint: 'Optional · from the services / pricing page', v1: false, optional: true },
  { key: '8', label: 'Services', hint: 'The services on this page', v1: false },
  { key: '9', label: 'Failure vs success', hint: 'Life without / with', v1: false },
  { key: '10', label: 'Lead magnet', hint: 'Optional · a guide, checklist or free review', v1: false, optional: true },
  { key: '11', label: 'Footer', hint: 'Phone, email, hours, booking link, areas served (never a street address)', v1: true },
]

export const WORKSHEET: { key: WorksheetKey; label: string; hint: string }[] = [
  { key: 'opportunity', label: 'Opportunity', hint: 'The search / service / area this page wins' },
  { key: 'whyFirst', label: 'Why this page first', hint: 'Demand, value, competition, proof, effort' },
  { key: 'customerNeed', label: 'Customer need', hint: 'Who searches this and what they need' },
  { key: 'buyingQuestions', label: 'Buying questions', hint: '2–3 real questions buyers ask' },
  { key: 'proof', label: 'Proof', hint: 'Projects, reviews, photos, credentials (real only)' },
  { key: 'desiredAction', label: 'Desired action', hint: 'What the visitor should do (call, book, quote…)' },
  { key: 'linksFrom', label: 'Linked from', hint: 'Pages that should link here (body copy)' },
  { key: 'linksTo', label: 'Links to', hint: 'Pages this one links to (parent, children, FAQ, contact)' },
  { key: 'missingInputs', label: 'Missing inputs', hint: 'What the owner still has to give (photos, reviews, prices…)' },
]

export const SECTION_KEYS = SECTIONS.map((s) => s.key)
export const WORKSHEET_KEYS = WORKSHEET.map((w) => w.key)
export const sectionsFor = (version: 'v1' | 'v2') => SECTIONS.filter((s) => version === 'v2' || s.v1)
