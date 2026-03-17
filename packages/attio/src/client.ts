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
    console.log(`[ATTIO:upsertEntry] PUT /lists/${this.listId}/entries — recordId: ${recordId}, fields: ${Object.keys(entryValues).join(', ')}`)
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
      const errMsg = errData?.message ?? `HTTP ${resp.status}`
      console.error(`[ATTIO:upsertEntry] FAILED: ${errMsg}`)
      throw new Error(errMsg)
    }
    const respData = await resp.json() as { data?: { id?: { entry_id?: string } } }
    console.log(`[ATTIO:upsertEntry] OK — entryId: ${respData.data?.id?.entry_id ?? '(unknown)'}`)
  }

  async assertCompany(name: string, domain?: string): Promise<string> {
    // If we have a domain, use PUT assert with domains as matching_attribute (query param)
    // If no domain, use POST to create a new company record
    if (domain) {
      console.log(`[ATTIO:assertCompany] PUT with matching_attribute=domains — name: "${name}", domain: "${domain}"`)
      const url = new URL(`${this.baseUrl}/objects/companies/records`)
      url.searchParams.set('matching_attribute', 'domains')
      const resp = await fetch(url.toString(), {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({
          data: {
            values: {
              name: [{ value: name }],
              domains: [{ domain }],
            },
          },
        }),
      })
      if (!resp.ok) {
        const errData = (await resp.json().catch(() => null)) as { message?: string } | null
        const errMsg = `Failed to assert company "${name}": ${errData?.message ?? `HTTP ${resp.status}`}`
        console.error(`[ATTIO:assertCompany] ${errMsg}`)
        throw new Error(errMsg)
      }
      const data = (await resp.json()) as { data?: { id?: { record_id?: string } } }
      const recordId = data.data?.id?.record_id
      if (!recordId) throw new Error(`No record_id returned for company "${name}"`)
      console.log(`[ATTIO:assertCompany] OK — recordId: ${recordId}`)
      return recordId
    }

    // No domain — create new company record directly
    console.log(`[ATTIO:assertCompany] POST new company — name: "${name}" (no domain)`)
    const resp = await fetch(`${this.baseUrl}/objects/companies/records`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        data: {
          values: {
            name: [{ value: name }],
          },
        },
      }),
    })
    if (!resp.ok) {
      const errData = (await resp.json().catch(() => null)) as { message?: string } | null
      const errMsg = `Failed to create company "${name}": ${errData?.message ?? `HTTP ${resp.status}`}`
      console.error(`[ATTIO:assertCompany] ${errMsg}`)
      throw new Error(errMsg)
    }
    const data = (await resp.json()) as { data?: { id?: { record_id?: string } } }
    const recordId = data.data?.id?.record_id
    if (!recordId) throw new Error(`No record_id returned for company "${name}"`)
    console.log(`[ATTIO:assertCompany] OK — recordId: ${recordId}`)
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
