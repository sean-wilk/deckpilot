import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

const protectedRoutes = ['/decks', '/settings', '/admin']
const authRoutes = ['/login', '/register', '/forgot-password']

export async function middleware(request: NextRequest) {
  // First, refresh session
  const response = await updateSession(request)

  const { pathname } = request.nextUrl

  // Check if route needs protection
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  if (isProtected || isAuthRoute) {
    // Create a Supabase client to check auth status
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {
            // We only need to read cookies here
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (isProtected && !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    if (isAuthRoute && user) {
      const url = request.nextUrl.clone()
      url.pathname = '/decks'
      return NextResponse.redirect(url)
    }

    // Admin route protection
    if (pathname.startsWith('/admin') && user) {
      // Check super admin status - this requires a DB query
      // For middleware (Edge Runtime), we'll check a custom claim or
      // defer to the page-level check since we can't use Drizzle in Edge
      // The admin pages themselves do the is_super_admin check
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
