'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { importLeadsCrmAction } from '@/app/crm/actions'
import { parseCsv } from '@/lib/crm-csv'

export function ImportCsvDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState<string | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const { rows: parsed, errors } = parseCsv(String(reader.result ?? ''))
      setRows(parsed)
      setErrors(errors)
      setFileName(file.name)
    }
    reader.readAsText(file)
  }

  async function submit() {
    setSubmitting(true)
    try {
      const res = await importLeadsCrmAction({
        rows: rows.map(coerceRow),
        fileName,
      })
      if (!res.ok) throw new Error('import failed')
      toast.success(`Imported: ${res.created} new, ${res.updated} updated${res.failures.length ? `, ${res.failures.length} failed` : ''}`)
      onDone()
      onOpenChange(false)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => onOpenChange(false)}>
      <div className="w-[640px] rounded bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">Import CSV</h2>
        <input type="file" accept=".csv" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {fileName && <div className="mt-2 text-sm text-muted-foreground">{fileName} — {rows.length} rows</div>}
        {errors.length > 0 && (
          <div className="mt-2 max-h-24 overflow-y-auto text-xs text-red-600">
            {errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}
        {rows.length > 0 && (
          <pre className="mt-3 max-h-40 overflow-auto rounded border border-[#dadde1] p-2 text-xs">
            {JSON.stringify(rows.slice(0, 5), null, 2)}
          </pre>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => onOpenChange(false)} className="rounded border border-[#dadde1] px-3 py-1 text-sm">Cancel</button>
          <button onClick={submit} disabled={rows.length === 0 || submitting} className="rounded bg-[#1c1e21] px-3 py-1 text-sm text-white disabled:opacity-50">
            {submitting ? 'Importing…' : `Import ${rows.length}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function coerceRow(r: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...r }
  for (const key of ['pain_score', 'review_count', 'rating']) {
    if (out[key] !== undefined && out[key] !== '') out[key] = Number(out[key])
    else if (out[key] === '') delete out[key]
  }
  for (const key of ['has_booking', 'has_chat_widget', 'has_contact_form']) {
    if (out[key] === 'true') out[key] = true
    else if (out[key] === 'false') out[key] = false
    else if (out[key] === '') delete out[key]
  }
  return out
}
