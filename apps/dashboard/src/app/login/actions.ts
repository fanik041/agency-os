'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function loginWithEmail(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect('/')
}

function resolveSiteUrl(): string {
  const productionUrl = process.env.NEXT_PUBLIC_SITE_URL
  const nodeEnv = process.env.NODE_ENV

  // In production (Vercel), always use NEXT_PUBLIC_SITE_URL
  if (nodeEnv === 'production') {
    if (!productionUrl) {
      console.error('[OAuth] NEXT_PUBLIC_SITE_URL is not set in production')
      throw new Error('NEXT_PUBLIC_SITE_URL must be set in production')
    }
    console.log(`[OAuth] Production mode, using: ${productionUrl}`)
    return productionUrl
  }

  // In development, use localhost (or NEXT_PUBLIC_SITE_URL if set)
  const devUrl = productionUrl ?? 'http://localhost:3000'
  console.log(`[OAuth] Development mode, using: ${devUrl}`)
  return devUrl
}

export async function loginWithGoogle() {
  const supabase = await createSupabaseServerClient()

  let siteUrl: string
  try {
    siteUrl = await resolveSiteUrl()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[OAuth] Failed to resolve site URL: ${message}`)
    return { error: message }
  }

  console.log(`[OAuth] Redirect URL: ${siteUrl}/auth/callback`)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    console.error(`[OAuth] signInWithOAuth error: ${error.message}`)
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }

  console.error('[OAuth] No redirect URL returned from Supabase')
  return { error: 'Failed to initiate Google login — no redirect URL returned' }
}

export async function logout() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
