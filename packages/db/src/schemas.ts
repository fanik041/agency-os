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

// -- CRM tab --

const editableLeadFields = [
  'name', 'website', 'phone', 'email_found', 'niche', 'city', 'address',
  'notes', 'message_draft', 'suggested_angle', 'pain_points', 'reviews_raw',
  'pain_score', 'review_count', 'rating',
  'has_booking', 'has_chat_widget', 'has_contact_form', 'analyze',
  'status', 'follow_up_date',
] as const

export const updateLeadFieldSchema = z.object({
  leadId: z.string().uuid(),
  field: z.enum(editableLeadFields),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

export const bulkUpdateLeadsStatusSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(1000),
  status: z.nativeEnum(LeadStatus),
})

export const softDeleteLeadsSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(1000),
})

export const restoreLeadsSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(1000),
})

export const listLeadsForCrmSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(100),
  search: z.string().max(200).optional(),
  sortField: z.string().max(50).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  statusFilter: z.array(z.nativeEnum(LeadStatus)).optional(),
  cityFilter: z.array(z.string()).optional(),
  nicheFilter: z.array(z.string()).optional(),
  minPainScore: z.number().int().min(0).max(100).optional(),
  maxPainScore: z.number().int().min(0).max(100).optional(),
  includeDeleted: z.boolean().default(false),
})

export const importLeadsCrmRowSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(500),
  website: z.string().max(2000).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email_found: z.string().email().optional().nullable().or(z.literal('').transform(() => null)),
  niche: z.string().max(200).optional().nullable(),
  city: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  status: z.nativeEnum(LeadStatus).optional(),
  pain_score: z.number().int().min(0).max(100).optional().nullable(),
  review_count: z.number().int().min(0).optional(),
  rating: z.number().min(0).max(5).optional().nullable(),
  has_booking: z.boolean().optional(),
  has_chat_widget: z.boolean().optional(),
  has_contact_form: z.boolean().optional(),
  analyze: z.string().max(10000).optional().nullable(),
  message_draft: z.string().max(20000).optional().nullable(),
  suggested_angle: z.string().max(20000).optional().nullable(),
  pain_points: z.string().max(20000).optional().nullable(),
  reviews_raw: z.string().max(50000).optional().nullable(),
  follow_up_date: z.string().optional().nullable(),
})

export const importLeadsCrmSchema = z.object({
  rows: z.array(importLeadsCrmRowSchema).min(1).max(10000),
  fileName: z.string().max(500).optional(),
})

export const createLeadCrmSchema = z.object({
  name: z.string().min(1).max(500),
  website: z.string().max(2000).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email_found: z.string().email().optional().nullable().or(z.literal('')),
  niche: z.string().max(200).optional().nullable(),
  city: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  status: z.nativeEnum(LeadStatus).default(LeadStatus.New),
})
