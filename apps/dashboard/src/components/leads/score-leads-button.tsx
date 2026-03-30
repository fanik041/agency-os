'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { scoreLeadsAction } from '@/app/leads/actions'

export function ScoreLeadsButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    sent: number; failed: number; total: number; errors: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleScore() {
    setLoading(true)
    setError(null)
    setResult(null)
    setOpen(true)

    try {
      const res = await scoreLeadsAction()
      if (res.ok) {
        setResult({ sent: res.sent, failed: res.failed, total: res.total, errors: res.errors })
      } else {
        setError('Scoring failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={handleScore} disabled={loading} size="sm" variant="outline">
        {loading ? 'Scoring...' : 'Score Leads'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {loading ? 'Sending leads to scorer...' : error ? 'Error' : 'Scoring Complete'}
            </DialogTitle>
            <DialogDescription>
              {loading
                ? 'Sending unscored leads to the n8n scoring pipeline...'
                : error
                  ? error
                  : result?.total === 0
                    ? 'No unscored leads found. All leads already have scores.'
                    : `Sent ${result?.sent} of ${result?.total} leads to the scoring pipeline.`}
            </DialogDescription>
          </DialogHeader>

          {!loading && result && result.total > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold text-green-600">{result.sent}</div>
                  <div className="text-xs text-muted-foreground">Sent</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-xs space-y-1">
                  <div className="font-medium text-red-700 dark:text-red-400">Errors:</div>
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-red-600 dark:text-red-300">{e}</div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Leads are being scored in the background by n8n. Refresh the page in a minute to see updated scores.
              </p>
            </div>
          )}

          {!loading && (
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
