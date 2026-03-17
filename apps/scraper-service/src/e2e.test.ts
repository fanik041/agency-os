/**
 * End-to-end test: fetch leads → pick 3 with websites → analyze → push to Attio + Supabase.
 * Skips the OpenAI scoring phase.
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ATTIO_API_KEY, ATTIO_LIST_ID
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../../../.env.local') })

import { describe, it, expect } from 'vitest'
import { analyzeWebsite } from './analyzer'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ATTIO_API_KEY = process.env.ATTIO_API_KEY
const ATTIO_LIST_ID = process.env.ATTIO_LIST_ID

interface LeadRow {
  id: string
  name: string
  website: string | null
  phone: string | null
  address: string | null
  city: string | null
  niche: string | null
  rating: number | null
  review_count: number
  maps_url: string | null
  has_booking: boolean
  has_chat_widget: boolean
  has_contact_form: boolean
  status: string
  [key: string]: unknown
}

let allLeads: LeadRow[] = []
let testLeads: LeadRow[] = []
const analyzeResults: Record<string, any> = {}

describe('Phase 1: Fetch leads from Supabase', () => {
  it('should fetch leads via PostgREST', async () => {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    })
    expect(resp.ok).toBe(true)
    allLeads = await resp.json()
    expect(allLeads.length).toBeGreaterThan(0)
    console.log(`Fetched ${allLeads.length} leads`)
  })
})

describe('Phase 2: Select 3 leads with websites', () => {
  it('should find at least 3 leads with websites', () => {
    testLeads = allLeads.filter((l) => l.website).slice(0, 3)
    expect(testLeads.length).toBe(3)
    for (const l of testLeads) {
      console.log(`  ${l.name} — ${l.website}`)
    }
  })
})

describe('Phase 3: Analyze websites', () => {
  it('should analyze each website and return valid signals', async () => {
    for (const lead of testLeads) {
      console.log(`Analyzing ${lead.website}...`)
      const result = await analyzeWebsite(lead.website!)
      analyzeResults[lead.id] = result

      expect(result.url).toBeTruthy()
      expect(typeof result.reachable).toBe('boolean')
      expect(typeof result.has_booking).toBe('boolean')
      expect(typeof result.has_chat_widget).toBe('boolean')
      expect(typeof result.has_contact_form).toBe('boolean')
      expect(typeof result.mobile_friendly).toBe('boolean')
      expect(typeof result.has_ssl).toBe('boolean')
      expect(typeof result.has_cta).toBe('boolean')
      expect(typeof result.phone_on_site).toBe('boolean')
      expect(typeof result.hours_on_site).toBe('boolean')
      expect(typeof result.has_social_proof).toBe('boolean')

      if (result.reachable) {
        expect(result.page_load_ms).toBeGreaterThan(0)
      }

      console.log(`  Reachable: ${result.reachable}, SSL: ${result.has_ssl}, CTA: ${result.has_cta}, Tech: ${result.tech_stack}`)
    }
  })
})

describe('Phase 4: Push to Supabase and Attio', () => {
  it('should PATCH analyze results to Supabase', async () => {
    for (const lead of testLeads) {
      const result = analyzeResults[lead.id]
      if (!result) continue

      const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${lead.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          has_booking: result.has_booking,
          has_chat_widget: result.has_chat_widget,
          has_contact_form: result.has_contact_form,
          page_load_ms: result.page_load_ms,
          mobile_friendly: result.mobile_friendly,
          has_ssl: result.has_ssl,
          seo_issues: result.seo_issues,
          has_cta: result.has_cta,
          phone_on_site: result.phone_on_site,
          hours_on_site: result.hours_on_site,
          has_social_proof: result.has_social_proof,
          tech_stack: result.tech_stack,
          analyze: JSON.stringify(result),
        }),
      })
      expect(resp.ok).toBe(true)
      const updated = await resp.json()
      expect(updated.length).toBe(1)
      expect(updated[0].analyze).toBeTruthy()
      console.log(`  Supabase updated: ${lead.name}`)
    }
  })

  it('should push to Attio (if configured)', async () => {
    if (!ATTIO_API_KEY || !ATTIO_LIST_ID) {
      console.log('  Skipping Attio push — ATTIO_API_KEY or ATTIO_LIST_ID not set')
      return
    }

    for (const lead of testLeads) {
      const domain = lead.website?.replace(/https?:\/\//, '').replace(/\/.*$/, '')
      if (!domain) continue

      // Upsert company
      const compResp = await fetch('https://api.attio.com/v2/objects/companies/records?matching_attribute=domains', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ATTIO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            values: {
              name: [{ value: lead.name }],
              domains: [{ domain }],
            },
          },
        }),
      })
      expect(compResp.ok).toBe(true)
      const compData = await compResp.json()
      const recordId = compData?.data?.id?.record_id
      expect(recordId).toBeTruthy()

      // Add to list
      const result = analyzeResults[lead.id]
      const entryResp = await fetch(`https://api.attio.com/v2/lists/${ATTIO_LIST_ID}/entries`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ATTIO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            parent_record_id: recordId,
            parent_object: 'companies',
            entry_values: {
              company_name: lead.name,
              website: lead.website,
              analyze: result ? JSON.stringify(result) : null,
            },
          },
        }),
      })
      expect(entryResp.ok).toBe(true)
      console.log(`  Attio updated: ${lead.name}`)
    }
  })
})
