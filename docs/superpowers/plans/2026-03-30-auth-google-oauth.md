# Auth + Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth login, a `profiles` table with auto-creation trigger, a sign-up gate controlled by env var, and profile sync on Google login.

**Architecture:** Supabase handles the OAuth2 PKCE flow. A new `/auth/callback` route exchanges the code for a session and syncs profile data. A database trigger auto-creates profile rows on user sign-up. The `ALLOW_SIGNUPS` env var gates new account creation at the application layer.

**Tech Stack:** Supabase Auth (OAuth2 PKCE), @supabase/ssr, Next.js route handlers, PostgreSQL triggers.

**Spec:** `docs/superpowers/specs/2026-03-30-auth-google-oauth-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `supabase/migrations/002_add_profiles.sql` | Profiles table, RLS policies, auto-create trigger |
| `apps/dashboard/src/app/auth/callback/route.ts` | OAuth callback handler, session exchange, profile sync, sign-up gate |

### Modified Files
| File | Change |
|---|---|
| `packages/db/src/types.ts` | Add `Profile` interface, add profiles to Database interface |
| `packages/db/src/queries.ts` | Add `getProfileById`, `upsertProfile`, `deleteProfile` functions |
| `apps/dashboard/src/app/login/page.tsx` | Wire up Google button with OAuth action |
| `apps/dashboard/src/app/login/actions.ts` | Add `loginWithGoogle` server action |
| `apps/dashboard/src/middleware.ts` | Allow `/auth/callback` route through without auth check |
| `.env.example` | Add `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` and `ALLOW_SIGNUPS` |

---

### Task 1: Add Profile type and Database interface

**Files:**
- Modify: `packages/db/src/types.ts`

- [ ] **Step 1: Add Profile interface**

In `packages/db/src/types.ts`, add after the `LeadSource` interface (after line 160, before the `Database` interface):

```typescript
export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}
```

- [ ] **Step 2: Add profiles to Database interface**

In the same file, add inside `Database.public.Tables` (after the `lead_sources` entry, before the closing braces):

```typescript
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "feat(db): add Profile type and Database interface entry"
```

---

### Task 2: Add profile query functions

**Files:**
- Modify: `packages/db/src/queries.ts`

- [ ] **Step 1: Add profile query functions**

Add at the end of `packages/db/src/queries.ts` (before any closing content), after the last existing function:

```typescript
// PROFILES

export async function getProfileById(id: string) {
  return supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
}

export async function upsertProfile(profile: {
  id: string
  email: string
  full_name?: string | null
  avatar_url?: string | null
}) {
  return supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name ?? null,
        avatar_url: profile.avatar_url ?? null,
      },
      { onConflict: 'id' }
    )
    .select()
    .single()
}

export async function deleteProfile(id: string) {
  return supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', id)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/queries.ts
git commit -m "feat(db): add profile query functions (get, upsert, delete)"
```

---

### Task 3: Create profiles migration SQL

**Files:**
- Create: `supabase/migrations/002_add_profiles.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Create profiles table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Service role can manage all profiles (for admin operations)
create policy "Service role full access"
  on profiles for all
  using (auth.role() = 'service_role');

-- Auto-create profile on new user sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger fires after a new auth.users row is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Run the migration against Supabase**

```bash
# Option A: If using supabase CLI
supabase db push

# Option B: If using the push-schema script
node scripts/push-schema.js

# Option C: Copy/paste the SQL into Supabase Dashboard → SQL Editor and run it
```

The migration creates the table, RLS policies, and trigger. Existing auth.users rows won't get profiles automatically — only new sign-ups will. For existing users, the OAuth callback or a one-time script can backfill.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_add_profiles.sql
git commit -m "feat(db): add profiles table migration with RLS and auto-create trigger"
```

---

### Task 4: Update middleware to allow /auth/callback

**Files:**
- Modify: `apps/dashboard/src/middleware.ts`

- [ ] **Step 1: Add /auth/callback exception**

In `apps/dashboard/src/middleware.ts`, add after the login page check (after line 40, before the `// Protect all other routes` comment):

```typescript
  // Allow auth callback through (OAuth redirect)
  if (pathname.startsWith('/auth/callback')) {
    return supabaseResponse
  }
```

The full section should now read:

```typescript
  // Allow login page through always
  if (pathname === '/login') {
    if (user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return supabaseResponse
  }

  // Allow auth callback through (OAuth redirect)
  if (pathname.startsWith('/auth/callback')) {
    return supabaseResponse
  }

  // Protect all other routes
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/middleware.ts
git commit -m "feat(auth): allow /auth/callback route through middleware"
```

---

### Task 5: Create OAuth callback route

**Files:**
- Create: `apps/dashboard/src/app/auth/callback/route.ts`

- [ ] **Step 1: Create the directory and route handler**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { upsertProfile, deleteProfile } from '@agency-os/db'

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

  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  // Check sign-up gate: if this is a new user and sign-ups are disabled, block them
  const allowSignups = process.env.ALLOW_SIGNUPS === 'true'

  // Check if profile exists (trigger may have created it)
  const { data: existingProfile } = await import('@agency-os/db').then(db => db.getProfileById(user.id))

  if (!existingProfile) {
    // New user — trigger hasn't fired yet or failed
    if (!allowSignups) {
      // Sign-ups disabled: clean up and redirect with error
      await supabase.auth.signOut()
      // Use admin client to delete the user (service role)
      const { createClient } = await import('@supabase/supabase-js')
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await adminClient.auth.admin.deleteUser(user.id)
      return NextResponse.redirect(new URL('/login?error=signups_disabled', origin))
    }

    // Sign-ups enabled: create profile from Google metadata
    await upsertProfile({
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    })
  } else {
    // Existing user: sync profile with latest Google metadata
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/auth/callback/route.ts
git commit -m "feat(auth): add OAuth callback route with profile sync and sign-up gate"
```

---

### Task 6: Add loginWithGoogle server action

**Files:**
- Modify: `apps/dashboard/src/app/login/actions.ts`

- [ ] **Step 1: Add the loginWithGoogle action**

Add after the `loginWithEmail` function and before the `logout` function:

```typescript
export async function loginWithGoogle() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').origin : 'http://localhost:3000'}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }

  return { error: 'Failed to initiate Google login' }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/login/actions.ts
git commit -m "feat(auth): add loginWithGoogle server action"
```

---

### Task 7: Wire up Google button on login page

**Files:**
- Modify: `apps/dashboard/src/app/login/page.tsx`

- [ ] **Step 1: Update imports and add Google handler**

Replace the entire file content:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { loginWithEmail, loginWithGoogle } from './actions'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

const GOOGLE_AUTH_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'

const ERROR_MESSAGES: Record<string, string> = {
  signups_disabled: 'Sign-ups are currently disabled. Contact the administrator.',
  auth_failed: 'Authentication failed. Please try again.',
  missing_code: 'Authentication error. Please try again.',
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isGooglePending, startGoogleTransition] = useTransition()
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginWithEmail(formData)
      if (result?.error) setError(result.error)
    })
  }

  function handleGoogleLogin() {
    setError(null)
    startGoogleTransition(async () => {
      const result = await loginWithGoogle()
      if (result?.error) setError(result.error)
    })
  }

  const displayError = error ?? (urlError ? ERROR_MESSAGES[urlError] ?? urlError : null)
  const anyPending = isPending || isGooglePending

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Agency OS</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-sm space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={anyPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                disabled={anyPending}
              />
            </div>

            {displayError && (
              <p className="text-sm text-destructive">{displayError}</p>
            )}

            <Button type="submit" className="w-full" disabled={anyPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          {GOOGLE_AUTH_ENABLED && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                disabled={anyPending}
                onClick={handleGoogleLogin}
              >
                {isGooglePending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>
            </>
          )}

          {!GOOGLE_AUTH_ENABLED && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" disabled>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
                <span className="ml-2 text-xs text-muted-foreground">(coming soon)</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/login/page.tsx
git commit -m "feat(auth): wire up Google OAuth button on login page with feature flag"
```

---

### Task 8: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add new env vars**

Add after the existing Supabase section:

```
# Auth
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
ALLOW_SIGNUPS=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "feat(auth): add Google OAuth and sign-up gate env vars to .env.example"
```

---

### Task 9: Verify build

- [ ] **Step 1: Type-check the db package**

```bash
cd packages/db && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Build the dashboard**

```bash
cd apps/dashboard && npx next build
```

Expected: Build succeeds with no errors. `/auth/callback` route should appear in the route list.

- [ ] **Step 3: Fix any build issues and commit**

```bash
git add -A
git commit -m "fix(auth): address build issues from auth implementation"
```
