import type { LeadStatus, CallOutcome, SiteStatus, ScrapeJobStatus } from '@agency-os/db'

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-[#e7f3ff] text-[#1877f2] rounded-full px-2.5',
  scoring: 'bg-[#e7f3ff] text-[#1264c8] rounded-full px-2.5',
  needs_review: 'bg-[#fff3cd] text-[#856404] rounded-full px-2.5',
  approved: 'bg-[#d4edda] text-[#155724] rounded-full px-2.5',
  sent: 'bg-[#cce5ff] text-[#004085] rounded-full px-2.5',
  replied: 'bg-[#d4edda] text-[#16a34a] rounded-full px-2.5',
  booked: 'bg-[#cce5ff] text-[#004085] rounded-full px-2.5 font-semibold',
  closed: 'bg-[#f0f2f5] text-[#65676b] rounded-full px-2.5',
  skip: 'bg-[#f0f2f5] text-[#8a8d91] rounded-full px-2.5',
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  scoring: 'Scoring',
  needs_review: 'Needs Review',
  approved: 'Approved',
  sent: 'Sent',
  replied: 'Replied',
  booked: 'Booked',
  closed: 'Closed',
  skip: 'Skip',
}

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  no_answer: 'No Answer',
  voicemail: 'Voicemail',
  not_interested: 'Not Interested',
  callback_requested: 'Callback Requested',
  demo_booked: 'Demo Booked',
  closed: 'Closed',
}

export const SITE_STATUS_COLORS: Record<SiteStatus, string> = {
  building: 'bg-[#fff3cd] text-[#856404] rounded-full px-2.5',
  live: 'bg-[#d4edda] text-[#155724] rounded-full px-2.5',
  paused: 'bg-[#f0f2f5] text-[#65676b] rounded-full px-2.5',
}

export const JOB_STATUS_COLORS: Record<ScrapeJobStatus, string> = {
  queued: 'bg-[#f0f2f5] text-[#65676b] rounded-full px-2.5',
  running: 'bg-[#e7f3ff] text-[#1877f2] rounded-full px-2.5',
  done: 'bg-[#d4edda] text-[#155724] rounded-full px-2.5',
  failed: 'bg-[#f8d7da] text-[#721c24] rounded-full px-2.5',
}
