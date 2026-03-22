import Anthropic from '@anthropic-ai/sdk'
import type OpenAI from 'openai'
import { createAnthropicChat } from '@tanstack/ai-anthropic'
import { createOpenaiChat } from '@tanstack/ai-openai'
import { db } from '@/lib/db'
import { adminAiConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { decrypt } from '@/lib/encryption'

export type TaskType = 'analysis' | 'recommendations' | 'chat' | 'generation'

export async function getAiModel(taskType: TaskType) {
  const configs = await db.select().from(adminAiConfig)
    .where(eq(adminAiConfig.isActive, true))
    .limit(1)

  if (configs.length === 0) {
    throw new Error('No active AI provider configured. Visit /admin to set up.')
  }

  const config = configs[0]
  const apiKey = decrypt(config.apiKeyEncrypted)

  const modelId = {
    analysis: config.modelAnalysis,
    recommendations: config.modelRecommendations,
    chat: config.modelChat,
    generation: config.modelGeneration,
  }[taskType]

  const maxTokens = {
    analysis: config.maxTokensAnalysis,
    recommendations: config.maxTokensRecommendations,
    chat: config.maxTokensChat,
    generation: config.maxTokensGeneration,
  }[taskType]

  // Pass API key directly to avoid process.env mutation race condition
  // Structured output (non-streaming) calls can take several minutes for large schemas
  if (config.provider === 'anthropic') {
    const adapter = createAnthropicChat(
      modelId as Parameters<typeof createAnthropicChat>[0],
      apiKey,
      { timeout: 15 * 60 * 1000 }
    )
    return { model: adapter, provider: config.provider, modelId, maxTokens }
  }

  if (config.provider === 'openai') {
    const adapter = createOpenaiChat(modelId as Parameters<typeof createOpenaiChat>[0], apiKey)
    return { model: adapter, provider: config.provider, modelId, maxTokens }
  }

  throw new Error(`Unknown provider: ${config.provider}`)
}

/**
 * Streaming structured output via Anthropic tool_choice.
 * Uses streaming to avoid connection timeouts on large responses.
 */
export async function streamStructuredOutput<T>(
  taskType: TaskType,
  prompt: string,
  schema: { properties?: Record<string, unknown>; required?: string[] },
  maxTokensCap = 4096,
): Promise<T> {
  const configs = await db.select().from(adminAiConfig)
    .where(eq(adminAiConfig.isActive, true))
    .limit(1)

  if (configs.length === 0) {
    throw new Error('No active AI provider configured. Visit /admin to set up.')
  }

  const config = configs[0]

  if (config.provider !== 'anthropic') {
    throw new Error('Streaming structured output requires Anthropic provider.')
  }

  const apiKey = decrypt(config.apiKeyEncrypted)
  const client = new Anthropic({ apiKey, timeout: 15 * 60 * 1000 })

  const modelId = {
    analysis: config.modelAnalysis,
    recommendations: config.modelRecommendations,
    chat: config.modelChat,
    generation: config.modelGeneration,
  }[taskType]

  const maxTokens = Math.min({
    analysis: config.maxTokensAnalysis,
    recommendations: config.maxTokensRecommendations,
    chat: config.maxTokensChat,
    generation: config.maxTokensGeneration,
  }[taskType], maxTokensCap)

  const stream = client.messages.stream({
    model: modelId,
    max_tokens: maxTokens,
    tools: [{
      name: 'structured_output',
      description: 'Provide your response in the required structured format.',
      input_schema: {
        type: 'object' as const,
        properties: schema.properties ?? {},
        required: schema.required ?? [],
      },
    }],
    tool_choice: { type: 'tool' as const, name: 'structured_output' },
    messages: [{ role: 'user', content: prompt }],
  })

  const message = await stream.finalMessage()

  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'structured_output') {
      return block.input as T
    }
  }

  throw new Error('No structured output found in AI response')
}

/**
 * Close all open brackets/braces in a partial JSON string to make it parseable.
 * Tracks nesting depth while respecting string literals and escape sequences.
 */
function closePartialJson(buffer: string): string {
  let inString = false
  let escape = false
  const stack: string[] = []

  for (const ch of buffer) {
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"' && !escape) { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') stack.push('}')
    else if (ch === '[') stack.push(']')
    else if (ch === '}' || ch === ']') stack.pop()
  }

  return buffer + stack.reverse().join('')
}

/**
 * Streaming structured output with progressive field detection.
 * Iterates Anthropic input_json_delta events, accumulates JSON buffer,
 * and periodically flushes completed top-level fields via onProgress callback.
 * Uses field stability detection: a field is only reported when its value
 * is unchanged between two consecutive flush cycles.
 */
export async function streamStructuredOutputWithProgress<T>(
  taskType: TaskType,
  prompt: string,
  schema: { properties?: Record<string, unknown>; required?: string[] },
  maxTokensCap = 4096,
  onProgress: (partialFields: Record<string, unknown>, newKeys: string[]) => Promise<void>,
  flushIntervalMs = 3000,
): Promise<T> {
  const configs = await db.select().from(adminAiConfig)
    .where(eq(adminAiConfig.isActive, true))
    .limit(1)

  if (configs.length === 0) {
    throw new Error('No active AI provider configured. Visit /admin to set up.')
  }

  const config = configs[0]

  if (config.provider !== 'anthropic') {
    throw new Error('Streaming structured output requires Anthropic provider.')
  }

  const apiKey = decrypt(config.apiKeyEncrypted)
  const client = new Anthropic({ apiKey, timeout: 15 * 60 * 1000 })

  const modelId = {
    analysis: config.modelAnalysis,
    recommendations: config.modelRecommendations,
    chat: config.modelChat,
    generation: config.modelGeneration,
  }[taskType]

  const maxTokens = Math.min({
    analysis: config.maxTokensAnalysis,
    recommendations: config.maxTokensRecommendations,
    chat: config.maxTokensChat,
    generation: config.maxTokensGeneration,
  }[taskType], maxTokensCap)

  const stream = client.messages.stream({
    model: modelId,
    max_tokens: maxTokens,
    tools: [{
      name: 'structured_output',
      description: 'Provide your response in the required structured format.',
      input_schema: {
        type: 'object' as const,
        properties: schema.properties ?? {},
        required: schema.required ?? [],
      },
    }],
    tool_choice: { type: 'tool' as const, name: 'structured_output' },
    messages: [{ role: 'user', content: prompt }],
  })

  let jsonBuffer = ''
  let previousFields: Record<string, unknown> = {}
  const reportedKeys = new Set<string>()
  let lastFlushTime = Date.now()

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'input_json_delta'
    ) {
      jsonBuffer += event.delta.partial_json

      // Check if flush interval has elapsed
      if (Date.now() - lastFlushTime >= flushIntervalMs) {
        lastFlushTime = Date.now()

        const closed = closePartialJson(jsonBuffer)
        try {
          const parsed = JSON.parse(closed) as Record<string, unknown>

          // Find stable fields: unchanged since last flush AND not yet reported
          const stableFields: Record<string, unknown> = {}
          const newKeys: string[] = []

          for (const [key, value] of Object.entries(parsed)) {
            if (reportedKeys.has(key)) {
              // Already reported — include in partial but don't count as new
              stableFields[key] = value
              continue
            }
            if (
              key in previousFields &&
              JSON.stringify(previousFields[key]) === JSON.stringify(value)
            ) {
              // Stable: same value as last flush — safe to report
              stableFields[key] = value
              newKeys.push(key)
              reportedKeys.add(key)
            }
          }

          previousFields = parsed

          if (newKeys.length > 0) {
            try {
              await onProgress(stableFields, newKeys)
            } catch (err) {
              console.warn('[streaming] onProgress callback error:', err)
            }
          }
        } catch {
          // Can't parse even with closing — skip this flush cycle
        }
      }
    }
  }

  // Final parse from the completed message
  const message = await stream.finalMessage()

  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'structured_output') {
      return block.input as T
    }
  }

  throw new Error('No structured output found in AI response')
}

export async function getVisionClient(): Promise<{ client: Anthropic; model: string }> {
  const configs = await db.select().from(adminAiConfig)
    .where(eq(adminAiConfig.isActive, true))
    .limit(1)

  if (configs.length === 0) {
    throw new Error('No active AI provider configured. Visit /admin to set up.')
  }

  const config = configs[0]

  if (config.provider !== 'anthropic') {
    throw new Error('Vision identification requires an Anthropic provider. Configure Anthropic in admin settings.')
  }

  const apiKey = decrypt(config.apiKeyEncrypted)

  const client = new Anthropic({ apiKey })
  const model = config.modelGeneration

  return { client, model }
}

export async function getStreamingClient(): Promise<{
  provider: 'anthropic' | 'openai'
  client: Anthropic | OpenAI
  model: string
  maxTokens: number
}> {
  const configs = await db.select().from(adminAiConfig)
    .where(eq(adminAiConfig.isActive, true))
    .limit(1)

  if (configs.length === 0) {
    throw new Error('No active AI provider configured. Visit /admin to set up.')
  }

  const config = configs[0]
  const apiKey = decrypt(config.apiKeyEncrypted)

  if (config.provider === 'anthropic') {
    const client = new Anthropic({ apiKey })
    return {
      provider: 'anthropic',
      client,
      model: config.modelGeneration,
      maxTokens: config.maxTokensGeneration,
    }
  }

  if (config.provider === 'openai') {
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })
    return {
      provider: 'openai',
      client,
      model: config.modelGeneration,
      maxTokens: config.maxTokensGeneration,
    }
  }

  throw new Error(`Unknown provider: ${config.provider}`)
}
