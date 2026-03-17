import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ATTIO_API_KEY = process.env.ATTIO_API_KEY!
const ATTIO_LIST_ID = process.env.ATTIO_LIST_ID!

async function main() {
  // Fetch all Supabase leads
  const leadResp = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=name,address,website&order=name.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const leads = await leadResp.json() as { name: string; address: string | null; website: string | null }[]

  // Fetch all Attio entries
  const attioEntries: { name: string }[] = []
  let offset = 0
  while (true) {
    const resp = await fetch(`https://api.attio.com/v2/lists/${ATTIO_LIST_ID}/entries/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ATTIO_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 500, offset }),
    })
    const data = await resp.json() as { data?: { entry_values?: Record<string, unknown[]> }[] }
    const page = data.data ?? []
    for (const entry of page) {
      const vals = entry.entry_values ?? {}
      const nameArr = (vals.company_name ?? vals.name ?? []) as { value?: string }[]
      const name = nameArr[0]?.value ?? ''
      attioEntries.push({ name })
    }
    if (page.length < 500) break
    offset += 500
  }

  console.log(`Supabase: ${leads.length} leads`)
  console.log(`Attio: ${attioEntries.length} entries`)

  const attioNames = new Set(attioEntries.map(e => e.name.toLowerCase().trim()))

  const missing = leads.filter(l => !attioNames.has(l.name.toLowerCase().trim()))
  console.log(`\nMissing from Attio (${missing.length}):`)
  for (const m of missing) {
    console.log(`  - "${m.name}" | ${m.address ?? '(no address)'} | ${m.website ?? '(no website)'}`)
  }

  const supabaseNames = new Set(leads.map(l => l.name.toLowerCase().trim()))
  const extra = attioEntries.filter(e => !supabaseNames.has(e.name.toLowerCase().trim()))
  if (extra.length > 0) {
    console.log(`\nExtra in Attio not in Supabase (${extra.length}):`)
    for (const e of extra) {
      console.log(`  - "${e.name}"`)
    }
  }
}

main().catch(console.error)
