// Claude API client, server-side only (CLAUDE.md: ANTHROPIC_API_KEY never reaches the browser).
// Env: ANTHROPIC_API_KEY in .env.local (dev) / Vercel env (later). Same Anthropic account as HQ.
import Anthropic from '@anthropic-ai/sdk'

export class AiConfigError extends Error {}

let client: Anthropic | null = null

export function anthropic(): Anthropic {
  if (client) return client
  if (!process.env.ANTHROPIC_API_KEY) throw new AiConfigError('Claude isn’t set up: add ANTHROPIC_API_KEY to the server environment.')
  client = new Anthropic() // reads ANTHROPIC_API_KEY
  return client
}
