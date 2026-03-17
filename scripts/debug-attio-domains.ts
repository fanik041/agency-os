import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=name,website&order=name.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const leads = await resp.json() as { name: string; website: string | null }[]

  // Group by extracted domain
  const byDomain = new Map<string, string[]>()
  for (const l of leads) {
    if (!l.website) continue
    try {
      const url = new URL(l.website.startsWith('http') ? l.website : `https://${l.website}`)
      const domain = url.hostname.replace(/^www\./, '')
      const group = byDomain.get(domain) ?? []
      group.push(l.name)
      byDomain.set(domain, group)
    } catch {}
  }

  console.log('Domains shared by multiple leads:')
  for (const [domain, names] of byDomain) {
    if (names.length > 1) {
      console.log(`  ${domain}:`)
      for (const n of names) console.log(`    - ${n}`)
    }
  }
}

main().catch(console.error)
