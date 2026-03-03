export type CallStatus = 'pending' | 'called' | 'callback' | 'interested' | 'closed' | 'dead'
export type SiteStatus = 'building' | 'live' | 'paused'
export type ScrapeJobStatus = 'queued' | 'running' | 'done' | 'failed'
export type CallOutcome =
  | 'no_answer'
  | 'voicemail'
  | 'not_interested'
  | 'callback_requested'
  | 'demo_booked'
  | 'closed'
export type RevenueType = 'deposit' | 'final' | 'retainer'
export type ResearchJobStatus = 'queued' | 'running' | 'done' | 'failed'
export type ContactSource = 'google_linkedin' | 'website_about' | 'website_contact' | 'manual'
export type LeadSourceType = 'scrape' | 'import' | 'manual'

export interface Lead {
  id: string
  niche: string | null
  name: string
  phone: string | null
  address: string | null
  email: string | null
  website: string | null
  rating: number | null
  review_count: number
  maps_url: string | null
  city: string | null
  has_website: boolean
  site_quality: number | null // 1-5, 5 = no website (hottest)
  call_status: CallStatus
  call_notes: string | null
  called_at: string | null
  source_id: string | null
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
    }
  }
}
