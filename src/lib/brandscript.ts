// Phase 3 step 5 · The StoryBrand BrandScript fields (Sam Day 6), written once per client and reused for pages,
// GBP posts and social captions. Shared by the server (Claude prompt) and the Page briefs screen.
import type { BrandKey } from '../types/seo.js'

export const BRAND_FIELDS: { key: BrandKey; label: string; hint: string }[] = [
  { key: 'A', label: 'Company', hint: 'Who the business is, in one plain line' },
  { key: 'B', label: 'Customer want', hint: 'What the customer wants (the outcome, not the service)' },
  { key: 'C', label: 'What they need', hint: 'What they need to get it' },
  { key: 'D', label: 'Problem', hint: 'What stands in their way (outside problem)' },
  { key: 'E', label: 'Feeling', hint: 'How that problem makes them feel' },
  { key: 'F', label: 'Belief', hint: 'What the business believes about it' },
  { key: 'G', label: 'Belief (why)', hint: 'Why it matters / why it’s wrong that they go through it' },
  { key: 'H', label: 'Solution', hint: 'How the business solves it' },
  { key: 'I', label: 'Plan · step 1', hint: 'First step of the 3-step plan' },
  { key: 'J', label: 'Plan · step 2', hint: 'Second step' },
  { key: 'K', label: 'Plan · step 3', hint: 'Third step' },
  { key: 'L', label: 'Don’t', hint: 'What the customer should stop doing / avoid' },
  { key: 'M', label: 'Instead', hint: 'What to do instead' },
  { key: 'N', label: 'Next action', hint: 'The main call to action (book, call, request a quote…)' },
  { key: 'O', label: 'Easy first step', hint: 'A smaller first step (a guide, a checklist, a free review…)' },
  { key: 'P', label: 'Success', hint: 'What life looks like after (the result)' },
]

export const BRAND_KEYS: BrandKey[] = BRAND_FIELDS.map((f) => f.key)
