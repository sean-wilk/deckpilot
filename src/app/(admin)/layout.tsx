import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const profile = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1)

  if (!profile[0]?.isSuperAdmin) {
    redirect('/decks')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-destructive/5">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-bold">DeckPilot Admin</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/decks" className="text-muted-foreground hover:text-foreground">Back to App</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
