import type { LeadRepository, LeadSourceRepository } from '@agency-os/db'
import { LeadStatus, CallOutcome, AttioSyncStatus, LeadSourceType } from '@agency-os/db'

export class LeadService {
  constructor(
    private leadRepo: LeadRepository,
    private sourceRepo: LeadSourceRepository,
  ) {}

  async updateStatus(leadId: string, status: LeadStatus, notes?: string) {
    return this.leadRepo.updateStatus(leadId, status, notes)
  }

  outcomeToLeadStatus(outcome: CallOutcome): LeadStatus {
    switch (outcome) {
      case CallOutcome.DemoBooked: return LeadStatus.Booked
      case CallOutcome.Closed: return LeadStatus.Closed
      case CallOutcome.NotInterested: return LeadStatus.Skip
      default: return LeadStatus.Sent
    }
  }

  async importLeads(leads: Array<{
    name: string; niche: string | null; phone: string | null;
    email: string | null; website: string | null;
    pain_score: number | null; city: string | null;
  }>, fileName?: string) {
    const source = await this.sourceRepo.create({
      type: LeadSourceType.Import,
      label: fileName || `Import (${leads.length} leads)`,
    })

    const leadsToInsert = leads.map(l => ({
      name: l.name, niche: l.niche, phone: l.phone, website: l.website,
      address: null, rating: null, review_count: 0, maps_url: null,
      place_id: null, city: l.city, has_website: !!l.website,
      site_quality: null, pain_score: l.pain_score, pain_points: null,
      suggested_angle: null, message_draft: null, email_found: l.email,
      has_booking: false, has_chat_widget: false, has_contact_form: false,
      reviews_raw: null, follow_up_date: null, notes: null,
      page_load_ms: null, mobile_friendly: null, has_ssl: null,
      seo_issues: null, has_cta: null, phone_on_site: null,
      hours_on_site: null, has_social_proof: null, tech_stack: null,
      analyze: null, status: LeadStatus.New as LeadStatus,
      attio_sync_status: AttioSyncStatus.NotSynced as AttioSyncStatus,
      attio_synced_at: null, source_id: source.id,
    }))

    const result = await this.leadRepo.bulkUpsert(leadsToInsert)
    await this.sourceRepo.updateCount(source.id, result.inserted)
    return result
  }
}
