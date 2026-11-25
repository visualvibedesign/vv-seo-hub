// Uploads + auto-fill (redesign step 6, design docs/design/Autofill.png): the day tabs and, per day, the exact
// exports SEO Hub needs with "how to get this file" steps. Ticks come from the client's real imports.
// Works for every client: the city and services in the steps come from the client's own record.
import type { ClientDetail, ImportRecord, ImportReport } from '../types/seo'

export type UploadDay = { key: string; label: string; step: number; live: boolean; phase?: string }

export const UPLOAD_DAYS: UploadDay[] = [
  { key: 'day1', label: 'Day 1 · Setup', step: 0, live: true },
  { key: 'day2', label: 'Day 2 · Keywords', step: 1, live: true },
  { key: 'day3', label: 'Day 3 · Baseline', step: 2, live: false, phase: '2' },
  { key: 'day4', label: 'Day 4 · GBP check', step: 3, live: false, phase: '4' },
  { key: 'day56', label: 'Day 5–6 · Pages', step: 4, live: false, phase: '3' },
  { key: 'day79', label: 'Day 7–9 · GBP + links', step: 6, live: false, phase: '4' },
  { key: 'day10', label: 'Day 10 · Results', step: 8, live: false, phase: '2' },
]

export type Need = {
  key: string
  title: string
  /** One line: where to click. */
  how: string
  /** Numbered "How to get this file" steps. */
  steps: string[]
  reports: ImportReport[]
  optional?: boolean
}

/** Day 2 exports (Sam's Day 2 + our Semrush setup). {city} = the client's A1. */
export function day2Needs(c: ClientDetail): Need[] {
  const a1 = c.areas.find((a) => a.code === 'A1' && a.status === 'active')
  const city = a1?.name || c.city || 'the main city'
  return [
    {
      key: 'kp_ideas',
      title: 'Keyword Planner ideas',
      how: `Discover new keywords → location = ${city} → Download CSV`,
      steps: [
        'Google Ads → Tools → Keyword Planner',
        'Discover new keywords → Start with keywords',
        'Type the services (S1–S3) as seeds',
        `Location: ${city} only (remove the country)`,
        'Download keyword ideas → CSV',
      ],
      reports: ['kp_ideas'],
    },
    {
      key: 'kp_volumes',
      title: 'Keyword Planner volumes',
      how: 'Get search volume and forecasts → paste the seeds → Download CSV',
      steps: [
        'Keyword Planner → Get search volume and forecasts',
        'Paste the seeds (Templates › Keyword research › Copy all seeds)',
        `Location: ${city} only`,
        'Download → CSV (keep the ranges as shown, e.g. 10–100)',
      ],
      reports: ['kp_volumes'],
    },
    {
      key: 'keyword_magic',
      title: 'Semrush Keyword Magic',
      how: `One per service, database US, Include keywords = ${city.toLowerCase()} → Export`,
      steps: [
        'Log in to Semrush',
        'Keyword Research → Keyword Magic Tool',
        'Type one service, database = US',
        `Advanced filters → Include keywords = ${city.toLowerCase()}`,
        'If a row has no data, click Update metrics',
        'Export → CSV. Repeat for each service',
      ],
      reports: ['keyword_magic'],
    },
    {
      key: 'keyword_overview',
      title: 'Semrush bulk Keyword Overview',
      how: 'For keywords still missing a Semrush volume → Export',
      steps: [
        'Keywords › Database → Missing data: “No Semrush volume” → copy the keywords',
        'Semrush → Keyword Overview → paste up to 100, database = US',
        'Click Update metrics if any show “n/a”',
        'Export → CSV',
      ],
      reports: ['keyword_overview'],
    },
    {
      key: 'keyword_gap',
      title: 'Semrush Keyword Gap',
      how: 'You + up to 4 competitors’ local pages → Export',
      steps: ['Semrush → Competitive Research → Keyword Gap', 'Add the client’s domain + up to 4 local competitors', 'Database = US → Compare', 'Export → CSV'],
      reports: ['keyword_gap'],
      optional: true,
    },
  ]
}

/** The imports that satisfy a need (latest first). */
export const importsFor = (n: Need, imports: ImportRecord[]) => imports.filter((i) => n.reports.includes(i.report)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/** "Done" for a need: imported at least once. Keyword Magic wants one file per service category (S1–S3). */
export function needDone(n: Need, imports: ImportRecord[], c: ClientDetail): boolean {
  const got = importsFor(n, imports).length
  if (n.key === 'keyword_magic') return got >= serviceCategories(c)
  return got > 0
}

export const serviceCategories = (c: ClientDetail) => c.categories.filter((k) => ['S1', 'S2', 'S3'].includes(k.code) && k.services.length > 0).length || 3
