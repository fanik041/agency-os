'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createLeadCrmAction, updateLeadFieldAction } from '@/app/crm/actions'
import type { Lead } from '@agency-os/db'
import { LeadStatus } from '@agency-os/db'

export function LeadEditDrawer({
  mode,
  lead,
  open,
  onOpenChange,
  onDone,
}: {
  mode: 'create' | 'edit'
  lead?: Lead
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [name, setName] = useState(lead?.name ?? '')
  const [phone, setPhone] = useState(lead?.phone ?? '')
  const [email, setEmail] = useState(lead?.email_found ?? '')
  const [website, setWebsite] = useState(lead?.website ?? '')
  const [niche, setNiche] = useState(lead?.niche ?? '')
  const [city, setCity] = useState(lead?.city ?? '')
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? LeadStatus.New)
  const [followUp, setFollowUp] = useState(lead?.follow_up_date ?? '')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  async function save() {
    setSaving(true)
    try {
      if (mode === 'create') {
        const res = await createLeadCrmAction({
          name,
          phone: phone || null,
          email_found: email || null,
          website: website || null,
          niche: niche || null,
          city: city || null,
          status,
        })
        if (!res.ok) throw new Error('create failed')
        toast.success('Lead created')
      } else if (lead) {
        const updates: Array<[string, unknown]> = [
          ['name', name],
          ['phone', phone || null],
          ['email_found', email || null],
          ['website', website || null],
          ['niche', niche || null],
          ['city', city || null],
          ['status', status],
          ['follow_up_date', followUp || null],
        ]
        for (const [f, v] of updates) await updateLeadFieldAction(lead.id, f, v)
        toast.success('Lead updated')
      }
      onDone()
      onOpenChange(false)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => onOpenChange(false)}>
      <div className="h-full w-[420px] overflow-y-auto bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{mode === 'create' ? 'New Lead' : 'Edit Lead'}</h2>
        <div className="space-y-3 text-sm">
          <Field label="Name *"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Phone"><input className={inputCls} value={phone ?? ''} onChange={e => setPhone(e.target.value)} /></Field>
          <Field label="Email"><input className={inputCls} value={email ?? ''} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Website"><input className={inputCls} value={website ?? ''} onChange={e => setWebsite(e.target.value)} /></Field>
          <Field label="Niche"><input className={inputCls} value={niche ?? ''} onChange={e => setNiche(e.target.value)} /></Field>
          <Field label="City"><input className={inputCls} value={city ?? ''} onChange={e => setCity(e.target.value)} /></Field>
          <Field label="Status">
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value as LeadStatus)}>
              {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {mode === 'edit' && (
            <Field label="Follow-up date">
              <input type="date" className={inputCls} value={followUp ?? ''} onChange={e => setFollowUp(e.target.value)} />
            </Field>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => onOpenChange(false)} className="rounded border border-[#dadde1] px-3 py-1 text-sm">Cancel</button>
          <button onClick={save} disabled={!name || saving} className="rounded bg-[#1c1e21] px-3 py-1 text-sm text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded border border-[#dadde1] px-2 py-1'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
