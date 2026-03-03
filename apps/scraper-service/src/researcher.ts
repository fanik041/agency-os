import { chromium } from 'playwright'

export interface ContactResult {
  name: string
  title: string | null
  email: string | null
  linkedin_url: string | null
  source: 'google_linkedin' | 'website_about' | 'website_contact'
  confidence: number // 1-5
}

interface BusinessInput {
  name: string
  city: string | null
  website: string | null
}

/**
 * Search for decision makers (owner/manager) for a given business
 * using Google search and website scraping.
 */
export async function searchDecisionMakers(business: BusinessInput): Promise<ContactResult[]> {
  const contacts: ContactResult[] = []
  const city = business.city || ''

  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })

    // Step 1: Google search for LinkedIn profiles
    try {
      const linkedInResults = await googleSearch(
        context,
        `"${business.name}" "${city}" owner OR manager OR director site:linkedin.com`
      )
      for (const result of linkedInResults) {
        if (result.url?.includes('linkedin.com/in/')) {
          contacts.push({
            name: cleanLinkedInName(result.title),
            title: extractTitle(result.snippet),
            email: null,
            linkedin_url: result.url,
            source: 'google_linkedin',
            confidence: 4,
          })
        }
      }
    } catch {
      // LinkedIn search failed, continue
    }

    // Step 2: Google search for email
    let foundEmail: string | null = null
    try {
      const emailResults = await googleSearch(
        context,
        `"${business.name}" "${city}" owner email`
      )
      for (const result of emailResults) {
        const email = extractEmailFromText(result.snippet)
        if (email) {
          foundEmail = email
          break
        }
      }
    } catch {
      // Email search failed, continue
    }

    // Step 3: Scrape company website /about /team pages
    if (business.website) {
      try {
        const websiteContacts = await scrapeWebsiteForContacts(context, business.website)
        contacts.push(...websiteContacts)
      } catch {
        // Website scraping failed, continue
      }
    }

    // Step 4: Cross-match — merge email into contacts if found
    if (foundEmail && contacts.length > 0) {
      // Assign email to highest confidence contact that lacks one
      const target = contacts.find((c) => !c.email)
      if (target) target.email = foundEmail
    } else if (foundEmail && contacts.length === 0) {
      contacts.push({
        name: 'Unknown (email found)',
        title: 'Owner/Manager',
        email: foundEmail,
        linkedin_url: null,
        source: 'google_linkedin',
        confidence: 2,
      })
    }

    // Deduplicate by name similarity
    return deduplicateContacts(contacts)
  } catch {
    return contacts
  } finally {
    await browser?.close()
  }
}

async function googleSearch(
  context: import('playwright').BrowserContext,
  query: string
): Promise<{ title: string; url: string; snippet: string }[]> {
  const page = await context.newPage()
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`
    await page.goto(searchUrl, { timeout: 15000, waitUntil: 'domcontentloaded' })

    // Wait a moment for results
    await page.waitForTimeout(1500)

    const results = await page.evaluate(() => {
      const items: { title: string; url: string; snippet: string }[] = []
      const divs = document.querySelectorAll('#search .g')
      divs.forEach((div) => {
        const anchor = div.querySelector('a[href]') as HTMLAnchorElement | null
        const titleEl = div.querySelector('h3')
        const snippetEl = div.querySelector('[data-sncf], .VwiC3b, [style*="-webkit-line-clamp"]')
        if (anchor && titleEl) {
          items.push({
            title: titleEl.textContent ?? '',
            url: anchor.href,
            snippet: snippetEl?.textContent ?? '',
          })
        }
      })
      return items.slice(0, 5)
    })

    return results
  } finally {
    await page.close()
  }
}

async function scrapeWebsiteForContacts(
  context: import('playwright').BrowserContext,
  website: string
): Promise<ContactResult[]> {
  const contacts: ContactResult[] = []
  const baseUrl = website.startsWith('http') ? website : `https://${website}`

  const aboutPaths = ['/about', '/about-us', '/team', '/our-team', '/staff']

  for (const path of aboutPaths) {
    const page = await context.newPage()
    try {
      const url = new URL(path, baseUrl).toString()
      const response = await page.goto(url, { timeout: 10000, waitUntil: 'domcontentloaded' }).catch(() => null)

      if (!response || response.status() >= 400) continue

      const pageContacts = await page.evaluate(() => {
        const results: { name: string; title: string | null; email: string | null }[] = []

        // Look for name/title patterns in headings and list items
        const elements = document.querySelectorAll('h2, h3, h4, li, p, .team-member, [class*="team"], [class*="staff"]')
        const titleKeywords = ['owner', 'manager', 'director', 'ceo', 'founder', 'president', 'principal', 'partner']

        elements.forEach((el) => {
          const text = el.textContent?.trim() ?? ''
          const lower = text.toLowerCase()

          // Check if element contains a title keyword
          if (titleKeywords.some((kw) => lower.includes(kw)) && text.length < 200) {
            // Try to extract name and title
            const parts = text.split(/[,\-–—|]/).map((s) => s.trim())
            if (parts.length >= 2) {
              const namePart = parts[0]
              const titlePart = parts.slice(1).join(', ')
              if (namePart.length > 2 && namePart.length < 60) {
                results.push({ name: namePart, title: titlePart, email: null })
              }
            } else if (text.length < 60) {
              results.push({ name: text, title: null, email: null })
            }
          }
        })

        // Extract emails from page
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
        const html = document.body?.innerHTML ?? ''
        const emails = html.match(emailRegex)?.filter(
          (e) =>
            !e.includes('example.com') &&
            !e.includes('sentry.io') &&
            !e.includes('wixpress') &&
            !e.includes('@2x') &&
            !e.endsWith('.png') &&
            !e.endsWith('.jpg')
        ) ?? []

        // Assign first email to first contact
        if (results.length > 0 && emails.length > 0) {
          results[0].email = emails[0]
        }

        return results.slice(0, 3)
      })

      for (const pc of pageContacts) {
        contacts.push({
          name: pc.name,
          title: pc.title,
          email: pc.email,
          linkedin_url: null,
          source: path.includes('team') ? 'website_about' : 'website_about',
          confidence: 3,
        })
      }

      if (contacts.length > 0) break // Found contacts, stop checking pages
    } catch {
      // Page failed, try next
    } finally {
      await page.close()
    }
  }

  return contacts
}

function cleanLinkedInName(title: string): string {
  // LinkedIn titles are usually "Name - Title - Company | LinkedIn"
  return title.replace(/\s*[-–|].*/, '').replace(/\s*\(.*\)/, '').trim() || title
}

function extractTitle(snippet: string): string | null {
  const titleKeywords = ['owner', 'manager', 'director', 'ceo', 'founder', 'president', 'principal', 'partner']
  const lower = snippet.toLowerCase()
  for (const kw of titleKeywords) {
    const idx = lower.indexOf(kw)
    if (idx >= 0) {
      // Extract surrounding context
      const start = Math.max(0, idx - 10)
      const end = Math.min(snippet.length, idx + kw.length + 20)
      return snippet.slice(start, end).replace(/^[^a-zA-Z]+/, '').replace(/[^a-zA-Z]+$/, '').trim()
    }
  }
  return null
}

function extractEmailFromText(text: string): string | null {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(emailRegex)
  if (!matches) return null
  const filtered = matches.filter(
    (e) =>
      !e.includes('example.com') &&
      !e.includes('sentry.io') &&
      !e.includes('wixpress') &&
      !e.endsWith('.png') &&
      !e.endsWith('.jpg')
  )
  return filtered[0] ?? null
}

function deduplicateContacts(contacts: ContactResult[]): ContactResult[] {
  const seen = new Map<string, ContactResult>()

  for (const contact of contacts) {
    const key = contact.name.toLowerCase().replace(/[^a-z]/g, '')
    const existing = seen.get(key)

    if (!existing) {
      seen.set(key, contact)
    } else {
      // Merge: keep highest confidence, fill in missing fields
      if (contact.confidence > existing.confidence) {
        existing.confidence = contact.confidence
      }
      if (!existing.email && contact.email) existing.email = contact.email
      if (!existing.linkedin_url && contact.linkedin_url) existing.linkedin_url = contact.linkedin_url
      if (!existing.title && contact.title) existing.title = contact.title
    }
  }

  return [...seen.values()]
}
