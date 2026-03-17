import type { AttioClient, AttioDiffEntry, AttioDiffField, AttioNewEntry } from '@agency-os/attio'
import type { LeadRepository } from '@agency-os/db'
import type { Lead } from '@agency-os/db'
import { AttioSyncStatus } from '@agency-os/db'

const STATUS_MAP: Record<string, string> = {
  new: 'New', scoring: 'Scoring', needs_review: 'Needs Review',
  approved: 'Approved', sent: 'Sent', replied: 'Replied',
  booked: 'Booked', closed: 'Closed', skip: 'Skip',
}

export class AttioSyncService {
  constructor(
    private attioClient: AttioClient,
    private leadRepo: LeadRepository,
  ) {}

  async fetchEntries(): Promise<{
    workspace: string
    listName: string
    entries: { company_name: string; values: Record<string, unknown> }[]
  }> {
    const { workspace } = await this.attioClient.verifyConnection()
    const listName = await this.attioClient.getListName()
    const entries = await this.attioClient.fetchAllEntries()
    return {
      workspace,
      listName,
      entries: entries.map(e => ({ company_name: e.name, values: e.values })),
    }
  }

  async deduplicate(): Promise<{ duplicatesFound: number; removed: number; failed: number }> {
    const entries = await this.attioClient.fetchAllEntries()
    const byName = new Map<string, typeof entries>()
    for (const e of entries) {
      const key = e.name.toLowerCase().trim()
      if (!key) continue
      const group = byName.get(key) ?? []
      group.push(e)
      byName.set(key, group)
    }

    const toDelete: { entryId: string; name: string }[] = []
    for (const [, group] of byName) {
      if (group.length <= 1) continue
      group.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      for (let i = 1; i < group.length; i++) {
        toDelete.push({ entryId: group[i].entryId, name: group[i].name })
      }
    }

    if (toDelete.length === 0) return { duplicatesFound: 0, removed: 0, failed: 0 }

    let removed = 0
    let failed = 0
    for (const dup of toDelete) {
      try {
        await this.attioClient.deleteEntry(dup.entryId)
        removed++
      } catch {
        failed++
      }
    }
    return { duplicatesFound: toDelete.length, removed, failed }
  }

  async compare(): Promise<{
    diffs: AttioDiffEntry[]
    newEntries: AttioNewEntry[]
    unchanged: number
    supabaseCount: number
    attioCount: number
  }> {
    const [leads, attioEntries] = await Promise.all([
      this.leadRepo.getAll(),
      this.attioClient.fetchAllEntries(),
    ])

    // Build lookup maps: prefer name+address composite key for unique matching,
    // fall back to name-only for leads without duplicates
    const attioByNameAddress = new Map<string, typeof attioEntries[number]>()
    const attioByName = new Map<string, typeof attioEntries[number]>()
    for (const e of attioEntries) {
      const nameKey = e.name.toLowerCase().trim()
      const addr = String(e.values.place_id ?? e.values.address ?? '').toLowerCase().trim()
      if (addr) {
        attioByNameAddress.set(`${nameKey}::${addr}`, e)
      }
      // Only use name fallback if there's no duplicate name (chains like "Anytime Fitness")
      if (!attioByName.has(nameKey)) {
        attioByName.set(nameKey, e)
      } else {
        // Multiple entries with same name — remove from name map to force composite matching
        attioByName.delete(nameKey)
      }
    }

    // Detect domains shared by multiple leads — these can't use domain matching
    // in assertCompany because Attio would merge them into one company record
    const domainCount = new Map<string, number>()
    for (const lead of leads) {
      const domain = this.extractDomain(lead.website)
      if (domain) domainCount.set(domain, (domainCount.get(domain) ?? 0) + 1)
    }
    const sharedDomains = new Set(
      [...domainCount.entries()].filter(([, count]) => count > 1).map(([d]) => d)
    )

    const diffs: AttioDiffEntry[] = []
    const newEntries: AttioNewEntry[] = []
    let unchanged = 0

    for (const lead of leads) {
      // Match by name+address first (handles franchises), then fall back to name-only
      const nameKey = lead.name.toLowerCase().trim()
      const addr = (lead.address ?? '').toLowerCase().trim()
      const attioEntry = (addr ? attioByNameAddress.get(`${nameKey}::${addr}`) : undefined)
        ?? attioByName.get(nameKey)
      const desired = this.leadToAttioValues(lead)

      if (!attioEntry) {
        // Lead exists in Supabase but not in Attio — needs to be created
        // Don't pass domain if it's shared by multiple leads (would merge into one company)
        const domain = this.extractDomain(lead.website)
        const safeDomain = domain && !sharedDomains.has(domain) ? domain : undefined
        newEntries.push({
          leadId: lead.id,
          leadName: lead.name,
          domain: safeDomain,
          entryValues: desired,
        })
        continue
      }

      // Lead exists in both — compare field by field
      const diffFields: AttioDiffField[] = []

      for (const [key, desiredVal] of Object.entries(desired)) {
        const desiredStr = String(desiredVal ?? '')
        const attioStr = String(attioEntry.values[key] ?? '')
        if (desiredStr !== attioStr) {
          diffFields.push({ field: key, supabase: desiredStr || '(empty)', attio: attioStr || '(empty)' })
        }
      }

      if (diffFields.length === 0) { unchanged++; continue }

      diffs.push({
        leadId: lead.id,
        leadName: lead.name,
        recordId: attioEntry.recordId,
        diffs: diffFields,
        entryValues: desired,
      })
    }

    return { diffs, newEntries, unchanged, supabaseCount: leads.length, attioCount: attioEntries.length }
  }

  async syncEntry(entry: {
    leadId: string
    leadName: string
    recordId: string
    entryValues: Record<string, unknown>
    changedFields: string[]
  }): Promise<{ ok: boolean; error?: string }> {
    const patchValues: Record<string, unknown> = { company_name: entry.entryValues.company_name }
    for (const field of entry.changedFields) {
      if (field !== 'company_name') patchValues[field] = entry.entryValues[field]
    }

    console.log(`[SYNC:UPDATE] "${entry.leadName}" — fields: ${entry.changedFields.join(', ')} | recordId: ${entry.recordId}`)
    try {
      await this.attioClient.upsertEntry(entry.recordId, patchValues)
      await this.leadRepo.updateAttioSync(entry.leadId, AttioSyncStatus.Synced)
      console.log(`[SYNC:UPDATE] "${entry.leadName}" — SUCCESS`)
      return { ok: true }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[SYNC:UPDATE] "${entry.leadName}" — FAILED: ${errMsg}`)
      await this.leadRepo.updateAttioSync(entry.leadId, AttioSyncStatus.Failed).catch(() => {})
      return { ok: false, error: errMsg }
    }
  }

  async createEntry(entry: {
    leadId: string
    leadName: string
    domain?: string
    entryValues: Record<string, unknown>
  }): Promise<{ ok: boolean; error?: string }> {
    console.log(`[SYNC:CREATE] "${entry.leadName}" — domain: ${entry.domain ?? '(none, will POST new)'} | fields: ${Object.keys(entry.entryValues).filter(k => k !== 'company_name').join(', ')}`)
    try {
      // Step 1: Assert/create the company record in Attio, get its record ID
      const recordId = await this.attioClient.assertCompany(entry.leadName, entry.domain)
      console.log(`[SYNC:CREATE] "${entry.leadName}" — assertCompany returned recordId: ${recordId}`)

      // Step 2: Add/update the list entry with all field values
      await this.attioClient.upsertEntry(recordId, entry.entryValues)
      console.log(`[SYNC:CREATE] "${entry.leadName}" — upsertEntry SUCCESS`)

      // Step 3: Mark as synced in Supabase
      await this.leadRepo.updateAttioSync(entry.leadId, AttioSyncStatus.Synced)
      console.log(`[SYNC:CREATE] "${entry.leadName}" — marked as synced in Supabase`)
      return { ok: true }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[SYNC:CREATE] "${entry.leadName}" — FAILED: ${errMsg}`)
      await this.leadRepo.updateAttioSync(entry.leadId, AttioSyncStatus.Failed).catch(() => {})
      return { ok: false, error: errMsg }
    }
  }

  private leadToAttioValues(lead: Lead): Record<string, unknown> {
    const v: Record<string, unknown> = { company_name: lead.name }
    if (lead.website) v.website = lead.website
    if (lead.phone) v.phone = lead.phone
    if (lead.address) v.place_id = lead.address
    if (lead.reviews_raw) v.reviews_raw = lead.reviews_raw
    if (lead.pain_points) v.pain_points = lead.pain_points
    if (lead.suggested_angle) v.suggested_angle = lead.suggested_angle
    if (lead.message_draft) v.message_draft = lead.message_draft
    if (lead.email_found) v.email_found = lead.email_found
    if (lead.notes) v.notes = lead.notes
    v.has_booking = lead.has_booking
    v.has_chat_widget = lead.has_chat_widget
    v.has_contact_form = lead.has_contact_form
    if (lead.pain_score != null) v.pain_score = lead.pain_score
    if (lead.review_count != null && lead.review_count > 0) {
      v.review_count = lead.review_count
      v.count = lead.review_count
    }
    if (lead.rating != null) v.rating_3 = `${lead.rating}/5`
    if (lead.analyze) v.analyze = lead.analyze
    if (lead.status && STATUS_MAP[lead.status]) v.status = STATUS_MAP[lead.status]
    if (lead.follow_up_date) v.follow_up_date = lead.follow_up_date
    if (lead.niche) v.niche = lead.niche
    if (lead.city) v.city = lead.city
    if (lead.address) v.address = lead.address
    return v
  }

  private extractDomain(website: string | null): string | undefined {
    if (!website) return undefined
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`)
      return url.hostname.replace(/^www\./, '')
    } catch {
      return undefined
    }
  }
}
