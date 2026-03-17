import type { AttioEntry, AttioListEntry, AttioSelfResponse } from './types'

export class AttioClient {
  private baseUrl = 'https://api.attio.com/v2'
  private headers: Record<string, string>

  constructor(
    private apiKey: string,
    private listId: string,
  ) {
    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  async verifyConnection(): Promise<{ workspace: string }> {
    const resp = await fetch(`${this.baseUrl}/self`, { headers: this.headers })
    if (!resp.ok) throw new Error(`Auth failed: HTTP ${resp.status}`)
    const data = (await resp.json()) as AttioSelfResponse
    return { workspace: data.data?.workspace?.name ?? 'Unknown' }
  }

  async getListName(): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/lists/${this.listId}`, { headers: this.headers })
    if (!resp.ok) throw new Error(`Failed to get list: HTTP ${resp.status}`)
    const data = (await resp.json()) as { data?: { name?: string } }
    return data.data?.name ?? this.listId
  }

  async fetchAllEntries(): Promise<AttioEntry[]> {
    const entries: AttioEntry[] = []
    let offset = 0
    const pageSize = 500

    while (true) {
      const resp = await fetch(`${this.baseUrl}/lists/${this.listId}/entries/query`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ limit: pageSize, offset }),
        cache: 'no-store',
      })
      if (!resp.ok) throw new Error(`Failed to fetch entries: HTTP ${resp.status}`)

      const data = (await resp.json()) as { data?: AttioListEntry[] }
      const page: AttioListEntry[] = data.data ?? []

      for (const entry of page) {
        entries.push(this.parseEntry(entry))
      }

      if (page.length < pageSize) break
      offset += pageSize
    }

    return entries
  }

  async upsertEntry(recordId: string, entryValues: Record<string, unknown>): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/lists/${this.listId}/entries`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({
        data: {
          parent_record_id: recordId,
          parent_object: 'companies',
          entry_values: entryValues,
        },
      }),
    })

    if (!resp.ok) {
      const errData = (await resp.json().catch(() => null)) as { message?: string } | null
      throw new Error(errData?.message ?? `HTTP ${resp.status}`)
    }
  }

  async assertCompany(name: string): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/objects/companies/records`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({
        data: {
          values: {
            name: [{ value: name }],
          },
        },
        matching_attribute: 'name',
      }),
    })
    if (!resp.ok) {
      const errData = (await resp.json().catch(() => null)) as { message?: string } | null
      throw new Error(`Failed to assert company "${name}": ${errData?.message ?? `HTTP ${resp.status}`}`)
    }
    const data = (await resp.json()) as { data?: { id?: { record_id?: string } } }
    const recordId = data.data?.id?.record_id
    if (!recordId) throw new Error(`No record_id returned for company "${name}"`)
    return recordId
  }

  async deleteEntry(entryId: string): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/lists/${this.listId}/entries/${entryId}`, {
      method: 'DELETE',
      headers: this.headers,
    })
    if (!resp.ok) throw new Error(`Failed to delete entry: HTTP ${resp.status}`)
  }

  private attioVal(arr: unknown): unknown {
    if (!Array.isArray(arr) || arr.length === 0) return undefined
    const first = arr[0] as Record<string, unknown>
    if (first.value !== undefined) return first.value
    if (first.domain !== undefined) return first.domain
    const option = first.option as Record<string, unknown> | undefined
    if (option?.title !== undefined) return option.title
    return undefined
  }

  private parseEntry(raw: AttioListEntry): AttioEntry {
    const vals = raw.entry_values ?? {}
    const name = ((vals.company_name?.[0] as Record<string, unknown>)?.value as string | undefined)
      ?? ((vals.name?.[0] as Record<string, unknown>)?.value as string | undefined)
      ?? ''
    const flat: Record<string, unknown> = {}
    for (const [key, arr] of Object.entries(vals)) {
      flat[key] = this.attioVal(arr)
    }
    return {
      entryId: raw.id?.entry_id ?? '',
      recordId: raw.parent_record_id ?? '',
      name,
      values: flat,
      createdAt: raw.created_at ?? '',
    }
  }
}
