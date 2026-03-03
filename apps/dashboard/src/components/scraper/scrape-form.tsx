'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Download } from 'lucide-react'

interface LogEntry {
  type: string
  message: string
}

export function ScrapeForm() {
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [leadCount, setLeadCount] = useState(0)
  const [collectedLeads, setCollectedLeads] = useState<Record<string, unknown>[]>([])
  const [showConsole, setShowConsole] = useState(false)
  const consoleRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  function appendLog(entry: LogEntry) {
    setLogs((prev) => [...prev, entry])
    // Scroll to bottom on next tick
    setTimeout(() => {
      if (consoleRef.current) {
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight
      }
    }, 0)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    const nichesRaw = formData.get('niches') as string
    const location = formData.get('location') as string
    const maxPerNiche = parseInt(formData.get('maxPerNiche') as string, 10) || 20
    const withEmails = formData.get('withEmails') === 'on'

    const niches = nichesRaw.split(',').map((n) => n.trim()).filter(Boolean)
    if (niches.length === 0 || !location) {
      toast.error('Niches and location are required')
      return
    }

    // Reset state
    setLogs([])
    setLeadCount(0)
    setCollectedLeads([])
    setIsRunning(true)
    setShowConsole(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      appendLog({ type: 'log', message: 'Starting scrape...' })

      const resp = await fetch('/api/scrape/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niches, location, maxPerNiche, withEmails }),
        signal: controller.signal,
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }))
        appendLog({ type: 'error', message: err.error || resp.statusText })
        setIsRunning(false)
        return
      }

      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let count = 0
      const leads: Record<string, unknown>[] = []
      let reading = true

      while (reading) {
        const { done, value } = await reader.read()
        if (done) {
          reading = false
          break
        }
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'log') {
              appendLog({ type: 'log', message: evt.message })
            } else if (evt.type === 'warn') {
              appendLog({ type: 'warn', message: evt.message })
            } else if (evt.type === 'error') {
              appendLog({ type: 'error', message: evt.message })
              setIsRunning(false)
            } else if (evt.type === 'lead') {
              count++
              setLeadCount(count)
              if (evt.data) leads.push(evt.data)
              appendLog({ type: 'lead', message: evt.message })
            } else if (evt.type === 'done') {
              if (evt.data?.leads) leads.splice(0, leads.length, ...evt.data.leads)
              appendLog({ type: 'done', message: evt.message })
              setIsRunning(false)
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }

      setCollectedLeads(leads)
      setIsRunning(false)
      if (leads.length > 0) {
        toast.success(`Scrape complete — ${leads.length} leads collected`)
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        appendLog({ type: 'error', message: err.message || 'Stream failed' })
      }
      setIsRunning(false)
    }
  }

  function downloadCSV() {
    if (collectedLeads.length === 0) return
    const keys = Object.keys(collectedLeads[0])
    const escape = (v: unknown) => {
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s
    }
    const csv = [
      keys.join(','),
      ...collectedLeads.map((r) => keys.map((k) => escape(r[k])).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const logColors: Record<string, string> = {
    log: 'text-gray-300',
    warn: 'text-yellow-400',
    error: 'text-red-400',
    lead: 'text-green-400',
    done: 'text-blue-400 font-semibold',
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>New Scrape Job</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="niches">Niches (comma-separated)</Label>
              <Input
                id="niches"
                name="niches"
                placeholder="dentist, hvac, plumber"
                required
                disabled={isRunning}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                placeholder="Austin, TX"
                required
                disabled={isRunning}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="maxPerNiche">Max per Niche</Label>
              <Input
                id="maxPerNiche"
                name="maxPerNiche"
                type="number"
                defaultValue={20}
                min={1}
                max={100}
                disabled={isRunning}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="withEmails" name="withEmails" disabled={isRunning} />
              <Label htmlFor="withEmails">Extract Emails</Label>
            </div>

            <Button type="submit" disabled={isRunning} className="w-full">
              {isRunning ? 'Scraping...' : 'Start Scrape'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {showConsole && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Live Logs</CardTitle>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                {leadCount} leads
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              ref={consoleRef}
              className="h-72 overflow-auto rounded-md bg-gray-950 p-3 font-mono text-xs leading-relaxed"
            >
              {logs.map((entry, i) => (
                <div key={i} className={logColors[entry.type] || 'text-gray-300'}>
                  {entry.type === 'lead' ? `+ ${entry.message}` : entry.message}
                </div>
              ))}
              {isRunning && logs.length > 0 && (
                <div className="text-gray-500 animate-pulse">waiting...</div>
              )}
            </div>

            {collectedLeads.length > 0 && !isRunning && (
              <Button onClick={downloadCSV} variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download CSV ({collectedLeads.length} leads)
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
