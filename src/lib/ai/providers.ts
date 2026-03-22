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
