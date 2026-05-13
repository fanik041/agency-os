import Papa from 'papaparse'
import type { Lead } from '@agency-os/db'

export const CRM_CSV_COLUMNS = [
  'id', 'name', 'website', 'phone', 'email_found', 'niche', 'city', 'address',
  'status', 'pain_score', 'review_count', 'rating',
  'has_booking', 'has_chat_widget', 'has_contact_form', 'analyze',
  'notes', 'message_draft', 'suggested_angle', 'pain_points', 'reviews_raw',
  'follow_up_date', 'created_at',
] as const

export function leadsToCsv(leads: Lead[]): string {
  const rows = leads.map(l => {
    const row: Record<string, unknown> = {}
    for (const col of CRM_CSV_COLUMNS) row[col] = (l as unknown as Record<string, unknown>)[col] ?? ''
    return row
  })
  return Papa.unparse(rows, { columns: CRM_CSV_COLUMNS as unknown as string[] })
}

export function parseCsv(text: string): { rows: Record<string, string>[]; errors: string[] } {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  return {
    rows: result.data,
    errors: result.errors.map(e => `Row ${e.row}: ${e.message}`),
  }
}
