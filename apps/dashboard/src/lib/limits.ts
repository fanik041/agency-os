import {
  getProfileById,
  getUserSubscription,
  getUsageCountByAction,
  getLifetimeUsageCount,
  insertUsageRecord,
} from '@agency-os/db'
import { UsageAction, PlanId } from '@agency-os/db'

export interface LimitCheckResult {
  allowed: boolean
  reason?: string
  cost_cents?: number
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function getMonthlyUsageTotal(userId: string, action: UsageAction): Promise<number> {
  const { data } = await getUsageCountByAction(userId, action, currentPeriod())
  if (!data) return 0
  return data.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
}

async function getLifetimeUsageTotal(userId: string, action: UsageAction): Promise<number> {
  const { data } = await getLifetimeUsageCount(userId, action)
  if (!data) return 0
  return data.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
}

export async function checkLimit(userId: string, action: UsageAction): Promise<LimitCheckResult> {
  console.log(`[checkLimit] userId=${userId}, action=${action}`)

  // Admin bypass
  const { data: profile, error: profileError } = await getProfileById(userId)
  if (profileError) {
    console.error(`[checkLimit] Failed to fetch profile: ${profileError.message}`)
    return { allowed: false, reason: `Profile lookup failed: ${profileError.message}` }
  }
  if (!profile) {
    console.error(`[checkLimit] No profile found for userId=${userId}`)
    return { allowed: false, reason: 'User profile not found' }
  }
  console.log(`[checkLimit] Profile found: is_admin=${profile.is_admin}`)
  if (profile.is_admin) {
    console.log('[checkLimit] Admin bypass — allowed')
    return { allowed: true }
  }

  // Get subscription + plan
  const { data: subscription } = await getUserSubscription(userId)
  const plan = subscription?.subscription_plans as {
    id: string
    max_scores_per_month: number | null
    max_scores_lifetime: number | null
    max_scrapes_per_month: number | null
    max_scrapes_lifetime: number | null
    max_scrape_leads_lifetime: number | null
    attio_sync_enabled: boolean
    cost_per_score_cents: number
    cost_per_scrape_cents: number
    cost_per_scrape_large_cents: number
    cost_per_attio_sync_cents: number
  } | null

  // No subscription = free tier
  const planId = subscription?.plan_id ?? PlanId.Free

  if (!plan && planId !== PlanId.Free) {
    return { allowed: false, reason: 'Subscription plan not found' }
  }

  switch (action) {
    case UsageAction.Score: {
      if (planId === PlanId.Free) {
        const lifetime = await getLifetimeUsageTotal(userId, UsageAction.Score)
        if (lifetime >= 1) {
          return { allowed: false, reason: 'Free plan allows 1 score. Upgrade to continue scoring.' }
        }
        return { allowed: true, cost_cents: 0 }
      }
      if (planId === PlanId.PerUse) {
        return { allowed: true, cost_cents: plan?.cost_per_score_cents ?? 10 }
      }
      if (planId === PlanId.Pro) {
        const monthly = await getMonthlyUsageTotal(userId, UsageAction.Score)
        if (monthly >= (plan?.max_scores_per_month ?? 100)) {
          return { allowed: false, reason: 'Pro plan limit reached (100 scores/month). Upgrade to Enterprise.' }
        }
        return { allowed: true, cost_cents: 0 }
      }
      // Enterprise
      return { allowed: true, cost_cents: 0 }
    }

    case UsageAction.Scrape: {
      if (planId === PlanId.Free) {
        const lifetimeScrapes = await getLifetimeUsageTotal(userId, UsageAction.Scrape)
        if (lifetimeScrapes >= 5) {
          return { allowed: false, reason: 'Free plan allows 5 scrape jobs. Upgrade to continue.' }
        }
        return { allowed: true, cost_cents: 0 }
      }
      if (planId === PlanId.PerUse) {
        return { allowed: true, cost_cents: plan?.cost_per_scrape_cents ?? 50 }
      }
      if (planId === PlanId.Pro) {
        const monthly = await getMonthlyUsageTotal(userId, UsageAction.Scrape)
        if (monthly >= (plan?.max_scrapes_per_month ?? 100)) {
          return { allowed: false, reason: 'Pro plan limit reached (100 scrapes/month). Upgrade to Enterprise.' }
        }
        return { allowed: true, cost_cents: 0 }
      }
      return { allowed: true, cost_cents: 0 }
    }

    case UsageAction.ScrapeLarge: {
      if (planId === PlanId.PerUse) {
        return { allowed: true, cost_cents: plan?.cost_per_scrape_large_cents ?? 100 }
      }
      return checkLimit(userId, UsageAction.Scrape)
    }

    case UsageAction.AttioSync: {
      if (planId === PlanId.Free) {
        return { allowed: false, reason: 'Attio sync is not available on the Free plan. Upgrade to Per Use or higher.' }
      }
      if (planId === PlanId.PerUse) {
        return { allowed: true, cost_cents: plan?.cost_per_attio_sync_cents ?? 100 }
      }
      return { allowed: true, cost_cents: 0 }
    }

    default:
      return { allowed: true, cost_cents: 0 }
  }
}

export async function recordUsage(
  userId: string,
  action: UsageAction,
  costCents: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  // Admin bypass — don't track admin usage
  const { data: profile } = await getProfileById(userId)
  if (profile?.is_admin) return

  await insertUsageRecord({
    user_id: userId,
    action,
    quantity: 1,
    cost_cents: costCents,
    period: currentPeriod(),
    metadata: metadata ?? null,
  })
}
