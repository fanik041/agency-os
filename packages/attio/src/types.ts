export interface AttioEntry {
  entryId: string
  recordId: string
  name: string
  values: Record<string, unknown>
  createdAt: string
}

export interface AttioListEntry {
  id?: { entry_id?: string }
  parent_record_id?: string
  entry_values?: Record<string, unknown[]>
  created_at?: string
}

export interface AttioSelfResponse {
  data?: {
    workspace?: {
      name?: string
    }
  }
}

export interface AttioDiffField {
  field: string
  supabase: string
  attio: string
}

export interface AttioDiffEntry {
  leadId: string
  leadName: string
  recordId: string
  diffs: AttioDiffField[]
  entryValues: Record<string, unknown>
}
