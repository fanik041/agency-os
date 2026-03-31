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

async function resolveSiteUrl(): Promise<string> {
  const localhostUrl = 'http://localhost:3000'
  const productionUrl = process.env.NEXT_PUBLIC_SITE_URL

  // Try localhost first (local dev)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)
    const resp = await fetch(localhostUrl, {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (resp.ok || resp.status < 500) {
      console.log(`[OAuth] Using localhost: ${localhostUrl}`)
      return localhostUrl
    }
  } catch {
    // localhost not reachable — fall through
  }

  // Fall back to production URL
  if (productionUrl) {
    console.log(`[OAuth] Localhost unreachable, using production: ${productionUrl}`)
    return productionUrl
  }

  // No production URL configured
  console.error('[OAuth] Neither localhost nor NEXT_PUBLIC_SITE_URL is available')
  throw new Error('OAuth redirect URL not configured: set NEXT_PUBLIC_SITE_URL or run on localhost')
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
