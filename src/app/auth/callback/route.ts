import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/decks'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Super admin bootstrap check
      const { data: { user } } = await supabase.auth.getUser()
      const adminEmail = process.env.INITIAL_ADMIN_EMAIL

      if (user && adminEmail && user.email === adminEmail) {
        // Use service role to check/set admin status
        const { createClient: createServiceClient } = await import('@supabase/supabase-js')
        const serviceClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Upsert profile with super admin
        await serviceClient.from('profiles').upsert({
          id: user.id,
          display_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Admin',
          is_super_admin: true,
        }, { onConflict: 'id' })
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
