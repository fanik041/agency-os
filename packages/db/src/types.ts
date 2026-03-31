import type {
  LeadStatus,
  AttioSyncStatus,
  ScrapeJobStatus,
  CallOutcome,
  RevenueType,
  SiteStatus,
  ContactSource,
  LeadSourceType,
  ResearchJobStatus,
  SubscriptionStatus,
  UsageAction,
} from './enums'

export type {
  LeadStatus,
  AttioSyncStatus,
  ScrapeJobStatus,
  CallOutcome,
  RevenueType,
  SiteStatus,
  ContactSource,
  LeadSourceType,
  ResearchJobStatus,
  SubscriptionStatus,
  UsageAction,
} from './enums'

/** @deprecated Use LeadStatus instead */
export type CallStatus = LeadStatus

export interface Lead {
  id: string
  name: string
  website: string | null
  phone: string | null
  has_booking: boolean
  has_chat_widget: boolean
  has_contact_form: boolean
  reviews_raw: string | null
  pain_score: number | null
  pain_points: string | null
  suggested_angle: string | null
  message_draft: string | null
  email_found: string | null
  status: LeadStatus
  follow_up_date: string | null
  notes: string | null
  // Legacy fields kept for backward compat
  niche: string | null
  address: string | null
  rating: number | null
  review_count: number
  maps_url: string | null
  city: string | null
  has_website: boolean
  site_quality: number | null
  page_load_ms: number | null
  mobile_friendly: boolean | null
  has_ssl: boolean | null
  seo_issues: string | null
  has_cta: boolean | null
  phone_on_site: boolean | null
  hours_on_site: boolean | null
  has_social_proof: boolean | null
  tech_stack: string | null
  analyze: string | null
  source_id: string | null
  attio_sync_status: AttioSyncStatus
  attio_synced_at: string | null
  created_at: string
}

export interface Client {
  id: string
  lead_id: string | null
  business_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  niche: string | null
  city: string | null
  site_url: string | null
  github_repo: string | null
  vercel_project_id: string | null
  deal_value: number | null
  paid_upfront: number
  paid_final: number
  retainer_amount: number
  retainer_active: boolean
  retainer_billing_day: number | null
  site_status: SiteStatus
  created_at: string
}

export interface ScrapeJob {
  id: string
  niches: string[]
  location: string
  city: string | null
  max_per_niche: number
  with_emails: boolean
  status: ScrapeJobStatus
  leads_found: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface CallLog {
  id: string
  lead_id: string
  outcome: CallOutcome | null
  notes: string | null
  duration_seconds: number | null
  called_at: string
}

export interface RevenueEvent {
  id: string
  client_id: string
  type: RevenueType | null
  amount: number
  date: string
  notes: string | null
}

export interface Contact {
  id: string
  lead_id: string | null
  name: string
  title: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  source: ContactSource | null
  confidence: number | null // 1-5, 5 = high
  notes: string | null
  tags: string[]
  created_at: string
}

export interface ResearchJob {
  id: string
  status: ResearchJobStatus
  lead_ids: string[]
  total: number
  processed: number
  contacts_found: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface LeadSource {
  id: string
  type: LeadSourceType
  label: string
  scrape_job_id: string | null
  leads_count: number
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_admin: boolean
  created_at: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  base_price_cents: number
  max_leads: number | null
  max_scores_per_month: number | null
  max_scores_lifetime: number | null
  max_scrapes_per_month: number | null
  max_scrapes_lifetime: number | null
  max_scrape_leads_lifetime: number | null
  attio_sync_enabled: boolean
  cost_per_score_cents: number
  cost_per_scrape_cents: number
  cost_per_scrape_large_cents: number
  cost_per_lead_overage_cents: number
  cost_per_attio_sync_cents: number
  created_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  started_at: string
  expires_at: string | null
  created_at: string
}

export interface UsageRecord {
  id: string
  user_id: string
  action: UsageAction
  quantity: number
  cost_cents: number
  period: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: Lead
        Insert: Omit<Lead, 'id' | 'created_at'>
        Update: Partial<Omit<Lead, 'id' | 'created_at'>>
      }
      clients: {
        Row: Client
        Insert: Omit<Client, 'id' | 'created_at'>
        Update: Partial<Omit<Client, 'id' | 'created_at'>>
      }
      scrape_jobs: {
        Row: ScrapeJob
        Insert: Omit<ScrapeJob, 'id' | 'created_at'>
        Update: Partial<Omit<ScrapeJob, 'id' | 'created_at'>>
      }
      call_log: {
        Row: CallLog
        Insert: Omit<CallLog, 'id' | 'called_at'>
        Update: Partial<Omit<CallLog, 'id' | 'called_at'>>
      }
      revenue_events: {
        Row: RevenueEvent
        Insert: Omit<RevenueEvent, 'id'>
        Update: Partial<Omit<RevenueEvent, 'id'>>
      }
      contacts: {
        Row: Contact
        Insert: Omit<Contact, 'id' | 'created_at'>
        Update: Partial<Omit<Contact, 'id' | 'created_at'>>
      }
      research_jobs: {
        Row: ResearchJob
        Insert: Omit<ResearchJob, 'id' | 'created_at'>
        Update: Partial<Omit<ResearchJob, 'id' | 'created_at'>>
      }
      lead_sources: {
        Row: LeadSource
        Insert: Omit<LeadSource, 'id' | 'created_at'>
        Update: Partial<Omit<LeadSource, 'id' | 'created_at'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      subscription_plans: {
        Row: SubscriptionPlan
        Insert: Omit<SubscriptionPlan, 'created_at'>
        Update: Partial<Omit<SubscriptionPlan, 'id' | 'created_at'>>
      }
      user_subscriptions: {
        Row: UserSubscription
        Insert: Omit<UserSubscription, 'id' | 'created_at'>
        Update: Partial<Omit<UserSubscription, 'id' | 'created_at'>>
      }
      usage_records: {
        Row: UsageRecord
        Insert: Omit<UsageRecord, 'id' | 'created_at'>
        Update: Partial<Omit<UsageRecord, 'id' | 'created_at'>>
      }
    }
  }
}
