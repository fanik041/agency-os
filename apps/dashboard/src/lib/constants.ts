import type { CallStatus, CallOutcome, SiteStatus, ScrapeJobStatus } from '@agency-os/db'

export const STATUS_COLORS: Record<CallStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  called: 'bg-blue-100 text-blue-700',
  callback: 'bg-yellow-100 text-yellow-700',
  interested: 'bg-purple-100 text-purple-700',
  closed: 'bg-green-100 text-green-700',
  dead: 'bg-red-100 text-red-700',
}

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  no_answer: 'No Answer',
  voicemail: 'Voicemail',
  not_interested: 'Not Interested',
  callback_requested: 'Callback Requested',
  demo_booked: 'Demo Booked',
  closed: 'Closed',
}

export function outcomeToStatus(outcome: CallOutcome): CallStatus {
  switch (outcome) {
    case 'no_answer':
    case 'voicemail':
      return 'called'
    case 'callback_requested':
      return 'callback'
    case 'demo_booked':
      return 'interested'
    case 'closed':
      return 'closed'
    case 'not_interested':
      return 'dead'
  }
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
