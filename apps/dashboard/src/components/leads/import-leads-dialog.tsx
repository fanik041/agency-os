'use client'

import { useState, useTransition, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { importLeadsAction } from '@/app/leads/actions'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ParsedLead {
  name: string
  niche: string | null
  phone: string | null
  email: string | null
  website: string | null
  pain_score: number | null
  city: string | null
}

const COLUMN_MAP: Record<string, keyof ParsedLead> = {
  'business name': 'name',
  'business': 'name',
  'name': 'name',
  'niche': 'niche',
  'industry': 'niche',
  'phone': 'phone',
  'phone number': 'phone',
  'email': 'email',
  'email address': 'email',
  'website': 'website',
  'site url': 'website',
  'url': 'website',
  'site quality': 'pain_score',
  'quality': 'pain_score',
  'pain score': 'pain_score',
  'city': 'city',
  'location': 'city',
}

export function ImportLeadsDialog() {
  const [open, setOpen] = useState(false)
  const [leads, setLeads] = useState<ParsedLead[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })

        // Try to find "Lead Qualification Matrix" sheet, else use first sheet
        const sheetName =
          workbook.SheetNames.find((n) =>
            n.toLowerCase().includes('lead qualification')
          ) ?? workbook.SheetNames[0]

        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

        const parsed: ParsedLead[] = rows
          .map((row) => {
            const lead: ParsedLead = {
              name: '',
              niche: null,
              phone: null,
              email: null,
              website: null,
              pain_score: null,
              city: null,
            }

            for (const [col, val] of Object.entries(row)) {
              const key = COLUMN_MAP[col.toLowerCase().trim()]
              if (key && val != null && val !== '') {
                const strVal = String(val).trim()
                if (key === 'pain_score') {
                  lead.pain_score = parseInt(strVal, 10) || null
                } else if (key === 'name') {
                  lead.name = strVal
                } else if (key === 'niche') {
                  lead.niche = strVal
                } else if (key === 'phone') {
                  lead.phone = strVal
                } else if (key === 'email') {
                  lead.email = strVal
                } else if (key === 'website') {
                  lead.website = strVal
                } else if (key === 'city') {
                  lead.city = strVal
                }
              }
            }

            return lead
          })
          .filter((l) => l.name)

        setLeads(parsed)
        if (parsed.length === 0) {
          toast.error('No valid leads found in file. Check column names.')
        }
      } catch {
        toast.error('Failed to parse file')
        setLeads([])
      }
    }

    reader.readAsArrayBuffer(file)
  }

  function handleImport() {
    if (leads.length === 0) return

    startTransition(async () => {
      try {
        const result = await importLeadsAction(leads, fileName ?? undefined)
        toast.success(`Imported ${result.inserted} leads`)
        if (result.errors.length > 0) {
          toast.error(`${result.errors.length} errors occurred`)
        }
        setOpen(false)
        setLeads([])
        setFileName(null)
        if (fileRef.current) fileRef.current.value = ''
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Import failed')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v)
      if (!v) {
        setLeads([])
        setFileName(null)
        if (fileRef.current) fileRef.current.value = ''
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-1 h-3 w-3" /> Import XLSX
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Leads from XLSX/CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            {fileName && (
              <p className="mt-1 text-xs text-muted-foreground">
                File: {fileName} — {leads.length} leads parsed
              </p>
            )}
          </div>

          {leads.length > 0 && (
            <>
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Niche</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Pain Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.slice(0, 50).map((lead, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>{lead.niche ?? '—'}</TableCell>
                        <TableCell>{lead.phone ?? '—'}</TableCell>
                        <TableCell>{lead.email ?? '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {lead.website ?? '—'}
                        </TableCell>
                        <TableCell>{lead.pain_score ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {leads.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  Showing first 50 of {leads.length} leads
                </p>
              )}

              <Button onClick={handleImport} disabled={isPending} className="w-full">
                {isPending ? 'Importing...' : `Import ${leads.length} Leads`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
