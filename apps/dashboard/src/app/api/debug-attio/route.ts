import { NextResponse } from 'next/server'
import { container } from '@/lib/container'

export const dynamic = 'force-dynamic'

export async function GET() {
  const logs: { type: string; text: string }[] = []
  const log = (type: string, text: string) => {
    logs.push({ type, text })
    console.log(`[${type}] ${text}`)
  }

  try {
    log('info', 'Step 1: Fetching leads from Supabase and entries from Attio...')

    const [leads, attioResult] = await Promise.all([
      container.leadRepo.getAll(),
      container.attioSyncService.fetchEntries(),
    ])

    log('info', `Supabase: ${leads.length} leads`)
    log('info', `Attio: ${attioResult.entries.length} entries`)

    // --- Name comparison ---
    const attioNames = new Map(
      attioResult.entries.map(e => [e.company_name.toLowerCase().trim(), e])
    )
    const supabaseNames = new Set(leads.map(l => l.name.toLowerCase().trim()))

    const missingFromAttio = leads
      .filter(l => !attioNames.has(l.name.toLowerCase().trim()))
      .map(l => ({ name: l.name, address: l.address, website: l.website }))

    const extraInAttio = attioResult.entries
      .filter(e => !supabaseNames.has(e.company_name.toLowerCase().trim()))
      .map(e => ({ name: e.company_name, values: e.values }))

    log('info', '')
    log('info', `Missing from Attio (by name): ${missingFromAttio.length}`)
    for (const m of missingFromAttio) {
      log('warn', `  - "${m.name}" | ${m.address ?? '(no address)'} | ${m.website ?? '(no website)'}`)
    }

    if (extraInAttio.length > 0) {
      log('info', '')
      log('info', `Extra in Attio (not in Supabase): ${extraInAttio.length}`)
      for (const e of extraInAttio) {
        log('warn', `  - "${e.name}"`)
      }
    }

    // --- Shared domain detection ---
    const domainCount = new Map<string, string[]>()
    for (const lead of leads) {
      if (!lead.website) continue
      try {
        const url = new URL(lead.website.startsWith('http') ? lead.website : `https://${lead.website}`)
        const domain = url.hostname.replace(/^www\./, '')
        const group = domainCount.get(domain) ?? []
        group.push(lead.name)
        domainCount.set(domain, group)
      } catch { /* ignore invalid URLs */ }
    }

    const sharedDomains = [...domainCount.entries()].filter(([, names]) => names.length > 1)
    if (sharedDomains.length > 0) {
      log('info', '')
      log('info', `Shared domains (${sharedDomains.length} domains, would cause merge conflicts):`)
      for (const [domain, names] of sharedDomains) {
        log('detail', `  ${domain}:`)
        for (const n of names) {
          const inAttio = attioNames.has(n.toLowerCase().trim())
          log('detail', `    ${inAttio ? '✓' : '✗'} ${n}`)
        }
      }
    }

    // --- Duplicate names in Supabase ---
    const nameGroupsSupa = new Map<string, string[]>()
    for (const l of leads) {
      const key = l.name.toLowerCase().trim()
      const group = nameGroupsSupa.get(key) ?? []
      group.push(l.id)
      nameGroupsSupa.set(key, group)
    }
    const dupNamesInSupa = [...nameGroupsSupa.entries()].filter(([, ids]) => ids.length > 1)
    if (dupNamesInSupa.length > 0) {
      log('info', '')
      log('info', `Duplicate names in Supabase (${dupNamesInSupa.length}):`)
      for (const [name, ids] of dupNamesInSupa) {
        log('warn', `  "${name}" — ${ids.length} entries (IDs: ${ids.join(', ')})`)
      }
    }

    // --- Duplicate names in Attio ---
    const nameGroupsAttio = new Map<string, number>()
    for (const e of attioResult.entries) {
      const key = e.company_name.toLowerCase().trim()
      nameGroupsAttio.set(key, (nameGroupsAttio.get(key) ?? 0) + 1)
    }
    const dupNamesInAttio = [...nameGroupsAttio.entries()].filter(([, count]) => count > 1)
    if (dupNamesInAttio.length > 0) {
      log('info', '')
      log('info', `Duplicate names in Attio (${dupNamesInAttio.length}):`)
      for (const [name, count] of dupNamesInAttio) {
        log('warn', `  "${name}" — ${count} entries`)
      }
    }

    // --- Run the actual compare to see what sync would do ---
    log('info', '')
    log('info', '--- Sync Dry Run (what compare() returns) ---')

    const compare = await container.attioSyncService.compare()

    log('info', `Supabase: ${compare.supabaseCount} leads`)
    log('info', `Attio: ${compare.attioCount} entries`)
    log('info', `Matched & unchanged: ${compare.unchanged}`)
    log(compare.diffs.length > 0 ? 'warn' : 'info', `Matched & need updating: ${compare.diffs.length}`)
    log(compare.newEntries.length > 0 ? 'warn' : 'info', `Missing from Attio (new): ${compare.newEntries.length}`)

    const totalWork = compare.newEntries.length + compare.diffs.length
    log('info', `Total work items: ${totalWork}`)
    log('info', '')

    // Log what would be created
    if (compare.newEntries.length > 0) {
      log('info', `--- Would CREATE ${compare.newEntries.length} entries ---`)
      for (let i = 0; i < compare.newEntries.length; i++) {
        const entry = compare.newEntries[i]
        const fieldNames = Object.keys(entry.entryValues).filter(k => k !== 'company_name')
        log('warn', `[${i + 1}/${totalWork}/${compare.supabaseCount}] CREATE "${entry.leadName}"`)
        log('detail', `  Domain for assertCompany: ${entry.domain ?? '(none — will POST new)'}`)
        log('detail', `  Fields: ${fieldNames.join(', ')}`)
      }
    }

    // Log what would be updated
    if (compare.diffs.length > 0) {
      log('info', '')
      log('info', `--- Would UPDATE ${compare.diffs.length} entries ---`)
      for (let i = 0; i < compare.diffs.length; i++) {
        const entry = compare.diffs[i]
        log('warn', `[${compare.newEntries.length + i + 1}/${totalWork}/${compare.supabaseCount}] UPDATE "${entry.leadName}" — ${entry.diffs.length} field(s)`)
        for (const diff of entry.diffs) {
          const attioVal = diff.attio.length > 80 ? diff.attio.slice(0, 80) + '...' : diff.attio
          const supaVal = diff.supabase.length > 80 ? diff.supabase.slice(0, 80) + '...' : diff.supabase
          log('detail', `  ${diff.field}: "${attioVal}" → "${supaVal}"`)
        }
      }
    }

    if (totalWork === 0) {
      log('success', 'Everything is in sync!')
    }

    return NextResponse.json({
      supabaseCount: leads.length,
      attioCount: attioResult.entries.length,
      missingFromAttio,
      missingCount: missingFromAttio.length,
      extraInAttio: extraInAttio.map(e => e.name),
      extraCount: extraInAttio.length,
      sharedDomains: sharedDomains.map(([d, names]) => ({ domain: d, leads: names })),
      duplicateNamesInSupabase: dupNamesInSupa.map(([name, ids]) => ({ name, count: ids.length })),
      duplicateNamesInAttio: dupNamesInAttio.map(([name, count]) => ({ name, count })),
      syncDryRun: {
        unchanged: compare.unchanged,
        wouldCreate: compare.newEntries.map(e => ({ name: e.leadName, domain: e.domain ?? null })),
        wouldUpdate: compare.diffs.map(e => ({ name: e.leadName, fields: e.diffs.map(d => d.field) })),
      },
      logs,
    })
  } catch (err) {
    log('error', `Fatal error: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.json({ error: String(err), logs }, { status: 500 })
  }
}
