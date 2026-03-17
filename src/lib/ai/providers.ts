import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { db } from '@/lib/db'
import { adminAiConfig } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { decrypt } from '@/lib/encryption'

export type TaskType = 'analysis' | 'recommendations' | 'chat' | 'generation'

export async function getAiModel(taskType: TaskType): Promise<{ model: ReturnType<ReturnType<typeof createAnthropic>> | ReturnType<ReturnType<typeof createOpenAI>>; provider: string; modelId: string }> {
  const configs = await db
    .select()
    .from(adminAiConfig)
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

  if (config.provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey })
    return { model: anthropic(modelId), provider: config.provider, modelId }
  }

  if (config.provider === 'openai') {
    const openai = createOpenAI({ apiKey })
    return { model: openai(modelId), provider: config.provider, modelId }
  }

  throw new Error(`Unknown provider: ${config.provider}`)
}
