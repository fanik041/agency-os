'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'

export function ScoreRowButton({
  leadId,
  onDone,
}: {
  leadId: string
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function score() {
    setLoading(true)
    try {
      const resp = await fetch('/api/score/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: [leadId] }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => `HTTP ${resp.status}`)
        throw new Error(text)
      }
      const json = await resp.json().catch(() => ({}))
      if (json.error) throw new Error(json.error)
      const scored = json.scored ?? 0
      const failed = json.failed ?? 0
      if (failed > 0) {
        toast.error(`Scoring failed for this lead${json.errors?.length ? `: ${json.errors[0]}` : ''}`)
      } else if (scored > 0) {
        toast.success('AI fields generated')
      } else {
        toast(`Skipped (${json.skipped ?? 0}) — already scored or no website`)
      }
      onDone()
    } catch (err) {
      toast.error(`AI call failed: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={score}
      disabled={loading}
      title="Generate AI pain points, angle, pitch, and analysis"
      className="inline-flex items-center gap-1 rounded border border-[#dadde1] bg-white px-2 py-1 text-xs font-medium text-[#1c1e21] hover:bg-[#f7f8fa] disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {loading ? 'Scoring…' : 'AI'}
    </button>
  )
}
