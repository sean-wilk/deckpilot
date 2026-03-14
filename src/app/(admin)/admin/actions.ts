'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { adminAiConfig, profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { encrypt } from '@/lib/encryption'
import { revalidatePath } from 'next/cache'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const profile = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)
  if (!profile[0]?.isSuperAdmin) throw new Error('Not authorized')

  return user
}

export async function addAiProvider(formData: FormData) {
  await requireSuperAdmin()

  const provider = formData.get('provider') as string
  const apiKey = formData.get('apiKey') as string
  const modelAnalysis = (formData.get('modelAnalysis') as string) || 'claude-sonnet-4-6'
  const modelRecommendations = (formData.get('modelRecommendations') as string) || 'claude-sonnet-4-6'
  const modelChat = (formData.get('modelChat') as string) || 'claude-sonnet-4-6'
  const modelGeneration = (formData.get('modelGeneration') as string) || 'claude-sonnet-4-6'
  const usageLimitDailyCents = formData.get('usageLimitDailyCents')
    ? Number(formData.get('usageLimitDailyCents'))
    : null

  await db.insert(adminAiConfig).values({
    provider,
    modelAnalysis,
    modelRecommendations,
    modelChat,
    modelGeneration,
    apiKeyEncrypted: encrypt(apiKey),
    usageLimitDailyCents,
  })

  revalidatePath('/admin')
}

export async function toggleAiProvider(id: string, isActive: boolean) {
  await requireSuperAdmin()

  await db
    .update(adminAiConfig)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(adminAiConfig.id, id))

  revalidatePath('/admin')
}

export async function deleteAiProvider(id: string) {
  await requireSuperAdmin()

  await db.delete(adminAiConfig).where(eq(adminAiConfig.id, id))

  revalidatePath('/admin')
}
