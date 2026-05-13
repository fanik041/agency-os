'use server'

import { revalidatePath } from 'next/cache'
import { unstable_noStore } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import {
  listLeadsForCrmSchema,
  updateLeadFieldSchema,
  bulkUpdateLeadsStatusSchema,
  softDeleteLeadsSchema,
  restoreLeadsSchema,
  createLeadCrmSchema,
  importLeadsCrmSchema,
} from '@agency-os/db'
import type { Lead, LeadStatus } from '@agency-os/db'
import { leadsToCsv } from '@/lib/crm-csv'

export async function listLeadsForCrmAction(input: unknown) {
  unstable_noStore()
  await requireAuth()
  const parsed = listLeadsForCrmSchema.parse(input)
  const result = await container.leadRepo.listForCrm({
    page: parsed.page,
    pageSize: parsed.pageSize,
    search: parsed.search,
    sortField: parsed.sortField as keyof Lead | undefined,
    sortDir: parsed.sortDir,
    statusFilter: parsed.statusFilter,
    cityFilter: parsed.cityFilter,
    nicheFilter: parsed.nicheFilter,
    minPainScore: parsed.minPainScore,
    maxPainScore: parsed.maxPainScore,
    includeDeleted: parsed.includeDeleted,
  })
  return { ok: true as const, data: result.data, count: result.count }
}

export async function getDistinctLeadValuesAction(field: 'status' | 'city' | 'niche') {
  await requireAuth()
  const values = await container.leadRepo.getDistinctValues(field)
  return { ok: true as const, values }
}

export async function updateLeadFieldAction(leadId: string, field: string, value: unknown) {
  await requireAuth()
  const parsed = updateLeadFieldSchema.parse({ leadId, field, value })
  await container.leadRepo.updateField(parsed.leadId, parsed.field, parsed.value)
  revalidatePath('/crm')
  return { ok: true as const }
}

export async function bulkUpdateLeadsStatusAction(leadIds: string[], status: LeadStatus) {
  await requireAuth()
  const parsed = bulkUpdateLeadsStatusSchema.parse({ leadIds, status })
  await container.leadRepo.bulkUpdateStatus(parsed.leadIds, parsed.status)
  revalidatePath('/crm')
  return { ok: true as const }
}

export async function softDeleteLeadsAction(leadIds: string[]) {
  await requireAuth()
  const parsed = softDeleteLeadsSchema.parse({ leadIds })
  await container.leadRepo.softDelete(parsed.leadIds)
  revalidatePath('/crm')
  revalidatePath('/leads')
  return { ok: true as const }
}

export async function restoreLeadsAction(leadIds: string[]) {
  await requireAuth()
  const parsed = restoreLeadsSchema.parse({ leadIds })
  await container.leadRepo.restore(parsed.leadIds)
  revalidatePath('/crm')
  revalidatePath('/leads')
  return { ok: true as const }
}

export async function createLeadCrmAction(input: unknown) {
  await requireAuth()
  const parsed = createLeadCrmSchema.parse(input)
  const created = await container.leadRepo.upsert({
    name: parsed.name,
    website: parsed.website ?? null,
    phone: parsed.phone ?? null,
    email_found: parsed.email_found || null,
    niche: parsed.niche ?? null,
    city: parsed.city ?? null,
    address: parsed.address ?? null,
    notes: parsed.notes ?? null,
    status: parsed.status,
    has_booking: false,
    has_chat_widget: false,
    has_contact_form: false,
    reviews_raw: null,
    pain_score: null,
    pain_points: null,
    suggested_angle: null,
    message_draft: null,
    follow_up_date: null,
    rating: null,
    review_count: 0,
    maps_url: null,
    has_website: !!parsed.website,
    site_quality: null,
    page_load_ms: null,
    mobile_friendly: null,
    has_ssl: null,
    seo_issues: null,
    has_cta: null,
    phone_on_site: null,
    hours_on_site: null,
    has_social_proof: null,
    tech_stack: null,
    analyze: null,
    source_id: null,
    deleted_at: null,
  } as never)
  revalidatePath('/crm')
  return { ok: true as const, lead: created }
}

export async function importLeadsCrmAction(input: unknown) {
  await requireAuth()
  const parsed = importLeadsCrmSchema.parse(input)
  let created = 0
  let updated = 0
  const failures: { row: number; error: string }[] = []

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i]
    try {
      if (row.id) {
        await container.leadRepo.updateField(row.id, 'name', row.name)
        for (const [k, v] of Object.entries(row)) {
          if (k === 'id' || k === 'name' || v == null) continue
          await container.leadRepo.updateField(row.id, k, v)
        }
        updated++
      } else {
        await container.leadRepo.upsert({
          name: row.name,
          website: row.website ?? null,
          phone: row.phone ?? null,
          email_found: row.email_found ?? null,
          niche: row.niche ?? null,
          city: row.city ?? null,
          address: row.address ?? null,
          notes: row.notes ?? null,
          status: row.status ?? ('new' as never),
          pain_score: row.pain_score ?? null,
          review_count: row.review_count ?? 0,
          rating: row.rating ?? null,
          has_booking: row.has_booking ?? false,
          has_chat_widget: row.has_chat_widget ?? false,
          has_contact_form: row.has_contact_form ?? false,
          reviews_raw: row.reviews_raw ?? null,
          pain_points: row.pain_points ?? null,
          suggested_angle: row.suggested_angle ?? null,
          message_draft: row.message_draft ?? null,
          follow_up_date: row.follow_up_date ?? null,
          analyze: row.analyze ?? null,
          maps_url: null,
          has_website: !!row.website,
          site_quality: null,
          page_load_ms: null,
          mobile_friendly: null,
          has_ssl: null,
          seo_issues: null,
          has_cta: null,
          phone_on_site: null,
          hours_on_site: null,
          has_social_proof: null,
          tech_stack: null,
          source_id: null,
          deleted_at: null,
        } as never)
        created++
      }
    } catch (err) {
      failures.push({ row: i + 1, error: String(err) })
    }
  }
  revalidatePath('/crm')
  return { ok: true as const, created, updated, failures }
}

export async function exportLeadsCrmCsvAction(input: unknown) {
  await requireAuth()
  // Reuse the filter validation by zeroing out paging params (they'll get the schema defaults).
  const filterInput = { ...((input as object) ?? {}) } as Record<string, unknown>
  delete filterInput.page
  delete filterInput.pageSize
  const parsed = listLeadsForCrmSchema.parse(filterInput)

  const BATCH = 500
  const all: Lead[] = []
  for (let page = 1; ; page++) {
    const result = await container.leadRepo.listForCrm({
      page,
      pageSize: BATCH,
      search: parsed.search,
      sortField: parsed.sortField as keyof Lead | undefined,
      sortDir: parsed.sortDir,
      statusFilter: parsed.statusFilter,
      cityFilter: parsed.cityFilter,
      nicheFilter: parsed.nicheFilter,
      minPainScore: parsed.minPainScore,
      maxPainScore: parsed.maxPainScore,
      includeDeleted: parsed.includeDeleted,
    })
    all.push(...result.data)
    if (result.data.length < BATCH) break
    if (all.length >= result.count) break
    // Safety: hard cap at 50k rows to avoid runaway memory
    if (all.length >= 50000) break
  }

  return {
    ok: true as const,
    csv: leadsToCsv(all),
    rowCount: all.length,
    filename: `leads-export-${new Date().toISOString().slice(0, 16).replace(':', '')}.csv`,
  }
}
