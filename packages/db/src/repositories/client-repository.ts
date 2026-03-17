import { supabaseAdmin } from '../client'
import type { Client } from '../types'

export class ClientRepository {
  async getAll() {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*, leads(name, niche, city)')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Failed to fetch clients: ${error.message}`)
    return data
  }

  async getById(id: string) {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*, leads(name, niche, city)')
      .eq('id', id)
      .single()
    if (error) throw new Error(`Client not found: ${error.message}`)
    return data
  }

  async create(client: Omit<Client, 'id' | 'created_at'>): Promise<Client> {
    const { data, error } = await supabaseAdmin.from('clients').insert(client).select().single()
    if (error) throw new Error(`Failed to create client: ${error.message}`)
    return data as Client
  }

  async update(id: string, updates: Partial<Omit<Client, 'id' | 'created_at'>>): Promise<Client> {
    const { data, error } = await supabaseAdmin.from('clients').update(updates).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update client: ${error.message}`)
    return data as Client
  }
}
