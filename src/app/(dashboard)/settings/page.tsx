import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  let profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  })

  if (!profile) {
    const fallbackName = user.email?.split('@')[0] ?? 'Pilot'
    const [created] = await db.insert(profiles).values({
      id: user.id,
      displayName: fallbackName,
      defaultBracket: 2,
    }).returning()
    profile = created
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account preferences.</p>
      </div>
      <SettingsForm
        displayName={profile.displayName}
        defaultBracket={profile.defaultBracket}
      />
    </div>
  )
}
