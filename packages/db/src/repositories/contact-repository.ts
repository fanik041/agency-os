import { supabaseAdmin } from '../client'
import type { Contact } from '../types'

export class ContactRepository {
  async getAll() {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('*, leads(name, niche, city)')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Failed to fetch contacts: ${error.message}`)
    return data
  }

  async getForLead(leadId: string): Promise<Contact[]> {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('lead_id', leadId)
      .order('confidence', { ascending: false })
    if (error) throw new Error(`Failed to fetch contacts: ${error.message}`)
    return data as Contact[]
  }

  async upsert(contact: Omit<Contact, 'id' | 'created_at'>): Promise<Contact> {
    const row = { ...contact, tags: contact.tags?.length ? contact.tags : [] }
    const { data, error } = await supabaseAdmin.from('contacts').insert(row).select().single()
    if (error) throw new Error(`Failed to upsert contact: ${error.message}`)
    return data as Contact
  }

  async update(id: string, updates: Partial<Omit<Contact, 'id' | 'created_at'>>): Promise<Contact> {
    const { data, error } = await supabaseAdmin.from('contacts').update(updates).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update contact: ${error.message}`)
    return data as Contact
  }

  async updateTags(id: string, tags: string[]): Promise<Contact> {
    const { data, error } = await supabaseAdmin.from('contacts').update({ tags }).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update tags: ${error.message}`)
    return data as Contact
  }

  async linkToLead(contactId: string, leadId: string | null) {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update({ lead_id: leadId })
      .eq('id', contactId)
      .select('*, leads(name, niche, city)')
      .single()
    if (error) throw new Error(`Failed to link contact: ${error.message}`)
    return data
  }
}
