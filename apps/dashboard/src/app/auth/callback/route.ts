import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { upsertProfile, getProfileById, createUserSubscription } from '@agency-os/db'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const response = NextResponse.redirect(new URL('/', origin))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  const allowSignups = process.env.ALLOW_SIGNUPS === 'true'
  const { data: existingProfile } = await getProfileById(user.id)

  if (!existingProfile) {
    if (!allowSignups) {
      await supabase.auth.signOut()
      const { createClient } = await import('@supabase/supabase-js')
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await adminClient.auth.admin.deleteUser(user.id)
      return NextResponse.redirect(new URL('/login?error=signups_disabled', origin))
    }

    await upsertProfile({
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    })

    // Create free subscription for new user
    await createUserSubscription(user.id, 'free')
  } else {
    const fullName = user.user_metadata?.full_name ?? user.user_metadata?.name
    const avatarUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture

    if (fullName || avatarUrl) {
      await upsertProfile({
        id: user.id,
        email: user.email ?? existingProfile.email,
        full_name: fullName ?? existingProfile.full_name,
        avatar_url: avatarUrl ?? existingProfile.avatar_url,
      })
    }
  }

  return response
}
