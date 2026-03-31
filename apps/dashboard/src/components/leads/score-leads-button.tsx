'use client'

import { useState } from 'react'
import { checkScoringLimitAction } from '@/app/leads/actions'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ScoringResult {
  ok: boolean
  scored: number
  skipped: number
  failed: number
  totalProducts: number
  errors: string[]
  error?: string
}

export function ScoreLeadsButton({ leadIds }: { leadIds?: string[] } = {}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScoringResult | null>(null)

  async function handleScore() {
    setLoading(true)
    setResult(null)

    // Check tier limits
    const limitResult = await checkScoringLimitAction()
    if (!limitResult.allowed) {
      setResult({ ok: false, scored: 0, skipped: 0, failed: 0, totalProducts: 0, errors: [], error: limitResult.reason })
      setLoading(false)
      return
    }

    try {
      const requestBody = leadIds?.length ? { leadIds } : {}
      const resp = await fetch('/api/score/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await resp.json()

      if (!resp.ok) {
        setResult({ ok: false, scored: 0, skipped: 0, failed: 0, totalProducts: 0, errors: [], error: data.error || `HTTP ${resp.status}` })
      } else {
        setResult(data as ScoringResult)
      }
    } catch (err) {
      setResult({ ok: false, scored: 0, skipped: 0, failed: 0, totalProducts: 0, errors: [], error: String(err) })
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <Button onClick={handleScore} disabled={loading} size="sm" variant="outline">
        {loading ? 'Scoring...' : 'Score Leads'}
      </Button>

      <Dialog open={result !== null} onOpenChange={() => setResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scoring Results</DialogTitle>
            <DialogDescription>
              AI scoring of leads is complete. Check Vercel logs for detailed progress.
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-2 text-sm">
              {!result.ok ? (
                <p className="text-red-500">Error: {result.error}</p>
              ) : result.scored === 0 && result.skipped === 0 && result.failed === 0 ? (
                <p className="text-green-500">No unscored leads found.</p>
              ) : (
                <>
                  {result.scored > 0 && <p>Leads scored: <strong>{result.scored}</strong></p>}
                  {result.skipped > 0 && <p>Leads skipped: <strong>{result.skipped}</strong></p>}
                  {result.failed > 0 && <p>Leads failed: <strong className="text-red-500">{result.failed}</strong></p>}
                  {result.totalProducts > 0 && <p>Products recommended: <strong>{result.totalProducts}</strong></p>}
                  {result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-red-500">Errors:</p>
                      <ul className="list-disc pl-4 text-red-400 text-xs">
                        {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
