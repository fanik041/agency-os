'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface ContactRow {
  lead_name: string
  contact_name: string
  title: string
  email: string
  phone: string
  linkedin_url: string
  source: string
  confidence: string
}

export function ExportCsvButton({ contacts }: { contacts: ContactRow[] }) {
  function handleExport() {
    if (contacts.length === 0) return

    const headers = ['Lead Name', 'Contact Name', 'Title', 'Email', 'Phone', 'LinkedIn', 'Source', 'Confidence']
    const escape = (v: string) => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`
      }
      return v
    }

    const rows = contacts.map((c) => [
      c.lead_name,
      c.contact_name,
      c.title,
      c.email,
      c.phone,
      c.linkedin_url,
      c.source,
      c.confidence,
    ].map(escape).join(','))

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={contacts.length === 0}>
      <Download className="mr-1 h-3 w-3" /> Export CSV
    </Button>
  )
}
