// One structured Claude call + its log row (seo_ai_log: task, client, model, tokens, cost, ok/error, time).
// Never logs the prompt or any client data. Callers decide what goes in the prompt (keywords, volumes,
// services, areas only; never the private address or account details).
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import { AI_MODELS, costUsd, type AiModelKey } from '../../src/lib/aiModels.js'
import { anthropic } from '../clients/anthropic.js'
import { db } from '../clients/supabase.js'

export class AiCallError extends Error {}

export type AiImage = { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }

/** The user message: the image first (if any), then the text. */
function userContent(user: string, image?: AiImage): Anthropic.MessageParam['content'] {
  if (!image) return user
  return [
    { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
    { type: 'text', text: user },
  ]
}

type CallArgs<T extends z.ZodType> = {
  task: string
  clientId: string
  model: AiModelKey
  system: string
  user: string
  /** Optional image (base64), sent before the text. Used once for the call: never logged or stored. */
  image?: AiImage
  schema: T
  maxTokens: number
  effort?: 'low' | 'medium' | 'high'
}

async function log(row: {
  task: string
  clientId: string
  model: string
  ok: boolean
  error?: string
  usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }
  modelKey: AiModelKey
  ms: number
}): Promise<string | null> {
  const u = row.usage
  const { data } = await db()
    .from('seo_ai_log')
    .insert({
      client_id: row.clientId,
      task: row.task,
      model: row.model,
      input_tokens: u?.input_tokens ?? 0,
      output_tokens: u?.output_tokens ?? 0,
      cache_read_tokens: u?.cache_read_input_tokens ?? 0,
      cache_write_tokens: u?.cache_creation_input_tokens ?? 0,
      cost_usd: u ? Number(costUsd(row.modelKey, u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), u.output_tokens).toFixed(4)) : 0,
      ok: row.ok,
      error: row.error?.slice(0, 1000) ?? null,
      duration_ms: Math.round(row.ms),
    })
    .select('id')
    .single()
  return (data as { id: string } | null)?.id ?? null
}

/** Input tokens for a prompt (free count_tokens call), for the estimate shown before a run. */
export async function countInputTokens(model: AiModelKey, system: string, user: string, image?: AiImage): Promise<number> {
  const r = await anthropic().messages.countTokens({ model: AI_MODELS[model].id, system, messages: [{ role: 'user', content: userContent(user, image) }] })
  return r.input_tokens
}

/**
 * Runs one structured call and logs it (also when it fails). Returns the parsed output and the log row id.
 * Always streamed: a non-streaming request with a large max_tokens is refused by the SDK ("Streaming is required
 * for operations that may take longer than 10 minutes"). finalMessage() gathers the whole answer, parsed the same way.
 */
export async function callStructured<T extends z.ZodType>(a: CallArgs<T>): Promise<{ data: z.infer<T>; logId: string | null }> {
  const model = AI_MODELS[a.model].id
  const started = performance.now()
  try {
    const res = await anthropic()
      .messages.stream({
        model,
        max_tokens: a.maxTokens,
        system: a.system,
        messages: [{ role: 'user', content: userContent(a.user, a.image) }],
        output_config: { effort: a.effort ?? 'low', format: zodOutputFormat(a.schema) },
      })
      .finalMessage()
    const ms = performance.now() - started
    if (res.stop_reason === 'refusal') {
      const logId = await log({ task: a.task, clientId: a.clientId, model, ok: false, error: 'Declined by Claude (refusal)', usage: res.usage, modelKey: a.model, ms })
      void logId
      throw new AiCallError('Claude declined this request. Nothing was saved.')
    }
    if (res.stop_reason === 'max_tokens' || !res.parsed_output) {
      await log({ task: a.task, clientId: a.clientId, model, ok: false, error: `No usable answer (${res.stop_reason})`, usage: res.usage, modelKey: a.model, ms })
      throw new AiCallError('Claude’s answer was cut off or unreadable. Nothing was saved; try again.')
    }
    const logId = await log({ task: a.task, clientId: a.clientId, model, ok: true, usage: res.usage, modelKey: a.model, ms })
    return { data: res.parsed_output as z.infer<T>, logId }
  } catch (err) {
    if (err instanceof AiCallError) throw err
    const ms = performance.now() - started
    const msg =
      err instanceof Anthropic.RateLimitError
        ? 'Rate limited by the Claude API'
        : err instanceof Anthropic.AuthenticationError
          ? 'Claude API key rejected'
          : err instanceof Anthropic.APIError
            ? `Claude API error ${err.status ?? ''}`.trim()
            : err instanceof Error
              ? err.message
              : 'Unknown error'
    await log({ task: a.task, clientId: a.clientId, model, ok: false, error: msg, modelKey: a.model, ms })
    throw new AiCallError(`${msg}. Nothing was saved; try again.`)
  }
}
