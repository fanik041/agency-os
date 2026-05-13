import type { Lead } from '@agency-os/db'

export type CellType = 'text' | 'longtext' | 'collapsible' | 'json' | 'number' | 'boolean' | 'status' | 'date' | 'readonly'

export interface CrmColumnMeta {
  field: keyof Lead
  label: string
  type: CellType
  width: number
  pinned?: boolean
  filterable?: boolean
  sortable?: boolean
  defaultVisible: boolean
}

export const CRM_COLUMNS: CrmColumnMeta[] = [
  { field: 'name', label: 'Name', type: 'text', width: 280, pinned: true, sortable: true, defaultVisible: true },
  { field: 'phone', label: 'Phone', type: 'text', width: 170, pinned: true, sortable: true, defaultVisible: true },
  { field: 'status', label: 'Status', type: 'status', width: 170, pinned: true, filterable: true, sortable: true, defaultVisible: true },
  { field: 'website', label: 'Website', type: 'text', width: 360, sortable: true, defaultVisible: true },
  { field: 'email_found', label: 'Email', type: 'text', width: 300, sortable: true, defaultVisible: true },
  { field: 'niche', label: 'Niche', type: 'text', width: 160, filterable: true, sortable: true, defaultVisible: true },
  { field: 'city', label: 'City', type: 'text', width: 180, filterable: true, sortable: true, defaultVisible: true },
  { field: 'address', label: 'Address', type: 'text', width: 400, defaultVisible: true },
  { field: 'pain_score', label: 'Pain', type: 'number', width: 80, sortable: true, defaultVisible: true },
  { field: 'review_count', label: 'Reviews', type: 'number', width: 90, sortable: true, defaultVisible: true },
  { field: 'rating', label: 'Rating', type: 'number', width: 80, sortable: true, defaultVisible: true },
  { field: 'has_booking', label: 'Booking', type: 'boolean', width: 90, defaultVisible: true },
  { field: 'has_chat_widget', label: 'Chat', type: 'boolean', width: 80, defaultVisible: true },
  { field: 'has_contact_form', label: 'Form', type: 'boolean', width: 80, defaultVisible: true },
  { field: 'follow_up_date', label: 'Follow-up', type: 'date', width: 150, sortable: true, defaultVisible: true },
  { field: 'notes', label: 'Notes', type: 'longtext', width: 380, defaultVisible: true },
  { field: 'pain_points', label: 'Pain Points', type: 'collapsible', width: 380, defaultVisible: true },
  { field: 'suggested_angle', label: 'Angle', type: 'longtext', width: 460, defaultVisible: true },
  { field: 'message_draft', label: 'Pitch / Draft', type: 'longtext', width: 560, defaultVisible: true },
  { field: 'analyze', label: 'AI Analysis', type: 'json', width: 380, defaultVisible: true },
  { field: 'reviews_raw', label: 'Reviews (raw)', type: 'longtext', width: 360, defaultVisible: false },
  { field: 'created_at', label: 'Created', type: 'readonly', width: 140, sortable: true, defaultVisible: true },
]
