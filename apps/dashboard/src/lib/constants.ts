import type { LeadStatus, CallOutcome, SiteStatus, ScrapeJobStatus } from '@agency-os/db'

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-gray-100 text-gray-700',
  scoring: 'bg-blue-100 text-blue-700',
  needs_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-purple-100 text-purple-700',
  sent: 'bg-indigo-100 text-indigo-700',
  replied: 'bg-teal-100 text-teal-700',
  booked: 'bg-green-100 text-green-700',
  closed: 'bg-green-200 text-green-800',
  skip: 'bg-red-100 text-red-700',
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
  building: 'bg-yellow-100 text-yellow-700',
  live: 'bg-green-100 text-green-700',
  paused: 'bg-gray-100 text-gray-700',
}

export const JOB_STATUS_COLORS: Record<ScrapeJobStatus, string> = {
  queued: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}
