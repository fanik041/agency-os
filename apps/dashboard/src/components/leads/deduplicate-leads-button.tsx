'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deduplicateLeadsAction } from '@/app/leads/actions'

export function DeduplicateLeadsButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    ok: boolean
    duplicatesFound: number
    merged: number
    deleted: number
    errors: string[]
    error?: string
  } | null>(null)

  async function handleDeduplicate() {
    setLoading(true)
    setResult(null)
    const res = await deduplicateLeadsAction()
    setResult(res)
    setLoading(false)
  }

  return (
    <>
      <Button onClick={handleDeduplicate} disabled={loading} size="sm" variant="outline">
        {loading ? 'Deduplicating...' : 'Deduplicate'}
      </Button>

      <Dialog open={result !== null} onOpenChange={() => setResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deduplication Results</DialogTitle>
            <DialogDescription>
              Leads with matching names were merged and duplicates removed.
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-2 text-sm">
              {!result.ok ? (
                <p className="text-red-500">Error: {result.error}</p>
              ) : result.duplicatesFound === 0 ? (
                <p className="text-green-500">No duplicates found.</p>
              ) : (
                <>
                  <p>Duplicates found: <strong>{result.duplicatesFound}</strong></p>
                  <p>Leads merged: <strong>{result.merged}</strong></p>
                  <p>Duplicates deleted: <strong>{result.deleted}</strong></p>
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
