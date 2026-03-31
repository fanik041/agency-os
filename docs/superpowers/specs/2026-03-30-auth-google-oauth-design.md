# Auth + Google OAuth — Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Goal:** Add Google OAuth login, a profiles table, a sign-up gate flag, and profile sync. Sub-project 1 of 2 (auth first, then subscription tiers).

---

## Constraint

- Existing email/password login remains unchanged
- Middleware route protection logic stays the same
- RLS policies on existing tables unchanged
- All server actions continue using `requireAuth()` as-is
- No changes to existing table schemas

## New Database Table: `profiles`

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Service role can manage all profiles"
  on profiles for all
  using (auth.role() = 'service_role');
```

## Database Trigger: Auto-Create Profile on Sign-Up

```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

For Google OAuth users, `raw_user_meta_data` contains `name`, `picture`, `email`. The trigger maps:
- `name` → `full_name`
- `picture` → `avatar_url` (Google's hosted URL, stored as-is)

For email/password users, `full_name` and `avatar_url` will be null initially.

## Profile Sync on Login

Each time a Google user signs in, their profile is updated with the latest Google metadata. This happens in the OAuth callback route:

1. Exchange auth code for session
2. Read `user.user_metadata` (contains latest Google `name`, `picture`)
3. Upsert `profiles` row with fresh `full_name` and `avatar_url`

This keeps the avatar and name current without the user doing anything.

## Google OAuth Flow

### Supabase Configuration (manual step)
1. Create OAuth credentials in Google Cloud Console (Web application type)
2. Set authorized redirect URI: `https://<supabase-project>.supabase.co/auth/v1/callback`
3. Add client ID and secret to Supabase Dashboard → Authentication → Providers → Google
4. Enable Google provider in Supabase dashboard
5. Request scopes: `openid`, `email`, `profile`

### Login Page Changes

Add below existing email/password form:

```
─── or ───

[ Continue with Google ]     ← hidden when NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
```

The Google button calls:
```typescript
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
})
```

### OAuth Callback Route

New file: `apps/dashboard/src/app/auth/callback/route.ts`

Standard Supabase PKCE callback handler:
1. Extract `code` from URL search params
2. Call `supabase.auth.exchangeCodeForSession(code)`
3. After session established, sync profile:
   - Get user via `supabase.auth.getUser()`
   - Upsert `profiles` row with `full_name` from `user_metadata.name` and `avatar_url` from `user_metadata.picture`
4. Redirect to `/`

## Sign-Up Gate

### Environment Variable
```
ALLOW_SIGNUPS=false
```

### Enforcement Logic

In the OAuth callback route and in a new `ensureProfileExists` helper:

1. After authentication, check if a `profiles` row exists for this user
2. If profile exists → user is an existing user → allow access
3. If no profile exists → this is a new sign-up:
   - If `ALLOW_SIGNUPS=true` → create profile, allow access
   - If `ALLOW_SIGNUPS=false` → delete the auth.users row (or sign out), redirect to `/login?error=signups_disabled`

The database trigger still fires and creates a profile row, but the callback route checks the flag and removes both the profile and auth user if sign-ups are disabled. This prevents orphaned auth users.

Alternative approach: The trigger can check for the flag, but env vars aren't accessible in SQL triggers. So enforcement happens at the application layer (callback route).

### Implementation Detail

For the sign-up gate to work cleanly:
1. The trigger creates the profile (it always fires on auth.users insert)
2. The callback route checks `ALLOW_SIGNUPS`
3. If disabled: delete from `profiles` where `id = user.id`, then `supabase.auth.admin.deleteUser(user.id)`, then redirect with error
4. If enabled: profile already exists from trigger, proceed normally

This handles both Google and email sign-ups consistently.

## New Files

| File | Responsibility |
|---|---|
| `apps/dashboard/src/app/auth/callback/route.ts` | OAuth callback, session exchange, profile sync, sign-up gate |
| `packages/db/src/repositories/profile-repository.ts` | Profile CRUD operations |
| `packages/db/src/types.ts` | Add `Profile` interface |
| `supabase/migrations/add-profiles-table.sql` | SQL for profiles table, trigger, RLS |

## Modified Files

| File | Change |
|---|---|
| `apps/dashboard/src/app/login/page.tsx` | Add Google button with divider, error param display |
| `apps/dashboard/src/app/login/actions.ts` | Add `loginWithGoogle` server action |
| `packages/db/src/queries.ts` | Add profile query functions |
| `packages/db/src/index.ts` | Export new profile types and queries |
| `.env.example` | Add `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` and `ALLOW_SIGNUPS` |

## Types

```typescript
// packages/db/src/types.ts
export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}
```

## Environment Variables

```
# Google OAuth (new)
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false    # Controls button visibility on login page
ALLOW_SIGNUPS=false                      # Controls whether new accounts can be created

# Existing (unchanged)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## What Users See

### Sign-ups disabled (current state)
- Login page shows email/password form
- Google button visible if `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`
- New users who try to sign up (email or Google) get redirected to login with error: "Sign-ups are currently disabled"
- Existing users can log in normally via email or Google

### Sign-ups enabled (future)
- Same login page
- New users can create accounts via email or Google
- Profile auto-created from Google metadata (name + avatar)
- Redirected to dashboard after sign-up

## Security

- OAuth2 PKCE flow (Supabase default) — no client secret exposed to browser
- Google avatar URL stored as-is (Google's CDN, HTTPS)
- Profile RLS: users can only read/update their own row
- Service role used only server-side for admin operations (delete user on blocked sign-up)
- Sign-up gate enforced at application layer, not database (env vars aren't accessible in SQL)
