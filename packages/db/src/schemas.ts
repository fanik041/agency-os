// packages/db/src/schemas.ts
import { z } from 'zod'
import {
  LeadStatus, CallOutcome, ScrapeJobStatus,
  RevenueType, SiteStatus, ContactSource,
} from './enums'

// -- Leads --
export const updateLeadStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: z.nativeEnum(LeadStatus),
  notes: z.string().max(5000).optional(),
})

export const logCallSchema = z.object({
  leadId: z.string().uuid(),
  outcome: z.nativeEnum(CallOutcome),
  notes: z.string().max(5000),
  durationSeconds: z.number().int().nullable(),
})

export const importLeadsSchema = z.object({
  leads: z.array(z.object({
    name: z.string().min(1).max(500),
    niche: z.string().max(200).nullable(),
    phone: z.string().max(50).nullable(),
    email: z.string().email().nullable().or(z.literal(null)),
    website: z.string().max(2000).nullable(),
    pain_score: z.number().int().min(0).max(100).nullable(),
    city: z.string().max(200).nullable(),
  })).min(1).max(10000),
  fileName: z.string().max(500).optional(),
})

// -- Attio Sync --
export const updateSingleAttioEntrySchema = z.object({
  leadId: z.string().uuid(),
  leadName: z.string().min(1),
  recordId: z.string().min(1),
  entryValues: z.record(z.string(), z.unknown()),
  changedFields: z.array(z.string()),
})

// -- Scraper --
export const triggerScrapeSchema = z.object({
  niches: z.array(z.string().min(1)).min(1),
  location: z.string().min(1),
  maxPerNiche: z.number().int().min(1).max(100),
  withEmails: z.boolean(),
})

// -- Clients --
export const createClientSchema = z.object({
  lead_id: z.string().uuid().nullable(),
  business_name: z.string().min(1).max(500),
  contact_name: z.string().max(500).nullable(),
  phone: z.string().max(50).nullable(),
  email: z.string().email().nullable().or(z.literal(null)),
  niche: z.string().max(200).nullable(),
  city: z.string().max(200).nullable(),
  deal_value: z.number().nullable(),
})

export const updateClientSchema = z.object({
  id: z.string().uuid(),
  business_name: z.string().min(1).max(500),
  contact_name: z.string().max(500).nullable(),
  phone: z.string().max(50).nullable(),
  email: z.string().email().nullable().or(z.literal(null)),
  niche: z.string().max(200).nullable(),
  city: z.string().max(200).nullable(),
  site_url: z.string().max(2000).nullable(),
  deal_value: z.number().nullable(),
  paid_upfront: z.number().default(0),
  paid_final: z.number().default(0),
  retainer_amount: z.number().default(0),
  retainer_active: z.boolean().default(false),
  retainer_billing_day: z.number().int().min(1).max(31).nullable(),
  site_status: z.nativeEnum(SiteStatus).default(SiteStatus.Building),
})

// -- Contacts --
export const triggerResearchSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
})

export const updateContactTagsSchema = z.object({
  contactId: z.string().uuid(),
  tags: z.array(z.string().max(100)),
})

export const updateContactNotesSchema = z.object({
  contactId: z.string().uuid(),
  notes: z.string().max(10000),
})

export const linkContactToLeadSchema = z.object({
  contactId: z.string().uuid(),
  leadId: z.string().uuid().nullable(),
})

// -- Revenue --
export const addRevenueEventSchema = z.object({
  client_id: z.string().uuid(),
  type: z.nativeEnum(RevenueType),
  amount: z.number().positive(),
  date: z.string().min(1),
  notes: z.string().max(5000).nullable(),
})

// -- Scraper Job Status --
export const updateJobStatusSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['done', 'failed']),
})
