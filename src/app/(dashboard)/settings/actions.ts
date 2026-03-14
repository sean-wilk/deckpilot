'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const displayName = formData.get('displayName') as string
  const defaultBracket = Number(formData.get('defaultBracket'))

  await db.update(profiles)
    .set({
      displayName,
      defaultBracket,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, user.id))

  revalidatePath('/settings')
}
