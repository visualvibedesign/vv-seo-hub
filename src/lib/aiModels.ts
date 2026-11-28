// Claude models and prices for auto-fill: the ONE place to change them (Angel, Nov 25).
// Haiku = cheap, fast classification (intent, leftover services, triage). Sonnet = judgment / writing
// (matrix suggestions, Day 1 from notes). Prices are Anthropic first-party API rates, USD per million tokens
// (Haiku 5.5: prompts up to 100K tokens; ours are far smaller). Used for the estimate shown before a run and
// for the cost saved in seo_ai_log. Estimates, not invoices.

export const AI_MODELS = {
  haiku: { id: 'claude-haiku-5-5', label: 'Haiku 5.5', inputPerMTok: 0.1, outputPerMTok: 0.5 },
  sonnet: { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', inputPerMTok: 2, outputPerMTok: 10 },
} as const
export type AiModelKey = keyof typeof AI_MODELS

/** Each auto-fill task, its model and a rough output size per keyword (for the estimate). */
export const AI_TASKS = {
  intent: { model: 'haiku', label: 'Intent', outPerItem: 25, outBase: 600 },
  services: { model: 'haiku', label: 'Leftover services', outPerItem: 30, outBase: 600 },
  triage: { model: 'haiku', label: 'No-rule keywords', outPerItem: 35, outBase: 600 },
  // Per open cell (a cell with no primary): one pick + up to 3 backups and a short reason. Effort medium (a judgment call).
  matrix: { model: 'sonnet', label: '3×3 matrix', outPerItem: 150, outBase: 1500 },
  // Per new page (name + secondaries + FAQs) or leftover keyword (which page). Effort medium.
  clusters: { model: 'sonnet', label: 'Page suggestions', outPerItem: 120, outBase: 1500 },
  day1: { model: 'sonnet', label: 'Day 1 from notes', outPerItem: 0, outBase: 6000 },
  // Results › a monthly report's notes (what moved, likely why, next 30 days), drafted from the frozen numbers. Effort medium.
  report_notes: { model: 'sonnet', label: 'Report notes', outPerItem: 0, outBase: 2500 },
  // 2g · numbers read from a GBP Performance screenshot (saved as Ready to review). Effort low.
  gbp_screenshot: { model: 'sonnet', label: 'GBP screenshot', outPerItem: 0, outBase: 1200 },
  // Phase 3 · SEO hotspots per page (title, meta, H1, URL, opening / closing line). Effort medium.
  hotspots: { model: 'sonnet', label: 'Hotspots', outPerItem: 450, outBase: 2500 },
  // Phase 3 · BrandScript A–P from Day 1 setup (unknown = [bracketed question]). Effort medium.
  brandscript: { model: 'sonnet', label: 'BrandScript', outPerItem: 0, outBase: 3000 },
} as const satisfies Record<string, { model: AiModelKey; label: string; outPerItem: number; outBase: number }>
export type AiTask = keyof typeof AI_TASKS

/** Cost in USD for a number of input and output tokens on a model. */
export function costUsd(model: AiModelKey, inputTokens: number, outputTokens: number): number {
  const m = AI_MODELS[model]
  return (inputTokens * m.inputPerMTok + outputTokens * m.outputPerMTok) / 1_000_000
}

/** "$0.0012" for tiny amounts, "$0.42" otherwise. */
export function formatUsd(n: number): string {
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`
}
