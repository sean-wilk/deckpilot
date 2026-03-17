import { anthropicText } from '@tanstack/ai-anthropic'
import { openaiText } from '@tanstack/ai-openai'
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

  // TanStack AI adapters read API keys from env vars — set dynamically from DB
  if (config.provider === 'anthropic') {
    process.env.ANTHROPIC_API_KEY = apiKey
    const adapter = anthropicText(modelId as Parameters<typeof anthropicText>[0])
    return { model: adapter, provider: config.provider, modelId }
  }

  if (config.provider === 'openai') {
    process.env.OPENAI_API_KEY = apiKey
    const adapter = openaiText(modelId as Parameters<typeof openaiText>[0])
    return { model: adapter, provider: config.provider, modelId }
  }

  throw new Error(`Unknown provider: ${config.provider}`)
}
