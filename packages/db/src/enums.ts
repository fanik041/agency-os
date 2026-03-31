// packages/db/src/enums.ts
export enum LeadStatus {
  New = 'new',
  Scoring = 'scoring',
  NeedsReview = 'needs_review',
  Approved = 'approved',
  Sent = 'sent',
  Replied = 'replied',
  Booked = 'booked',
  Closed = 'closed',
  Skip = 'skip',
}

export enum AttioSyncStatus {
  NotSynced = 'not_synced',
  Synced = 'synced',
  Failed = 'failed',
}

export enum ScrapeJobStatus {
  Queued = 'queued',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
}

export enum CallOutcome {
  NoAnswer = 'no_answer',
  Voicemail = 'voicemail',
  NotInterested = 'not_interested',
  CallbackRequested = 'callback_requested',
  DemoBooked = 'demo_booked',
  Closed = 'closed',
}

export enum RevenueType {
  Deposit = 'deposit',
  Final = 'final',
  Retainer = 'retainer',
}

export enum SiteStatus {
  Building = 'building',
  Live = 'live',
  Paused = 'paused',
}

export enum ContactSource {
  GoogleLinkedin = 'google_linkedin',
  WebsiteAbout = 'website_about',
  WebsiteContact = 'website_contact',
  Manual = 'manual',
}

export enum LeadSourceType {
  Scrape = 'scrape',
  Import = 'import',
  Manual = 'manual',
}

export enum ResearchJobStatus {
  Queued = 'queued',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
}

export enum SubscriptionStatus {
  Active = 'active',
  Cancelled = 'cancelled',
  PastDue = 'past_due',
}

export enum UsageAction {
  Score = 'score',
  Scrape = 'scrape',
  ScrapeLarge = 'scrape_large',
  AttioSync = 'attio_sync',
  LeadOverage = 'lead_overage',
}

export enum PlanId {
  Free = 'free',
  PerUse = 'per_use',
  Pro = 'pro',
  Enterprise = 'enterprise',
}
