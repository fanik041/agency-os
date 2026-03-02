import { chromium } from 'playwright'
import type { RawBusiness } from './scraper'

/**
 * Site quality score (1-5):
 * 5 = no website at all (hottest lead — needs a site)
 * 4 = website exists but is broken/empty/parked
 * 3 = website exists but is poor (no SSL, very slow, no mobile)
 * 2 = website exists and is decent but outdated
 * 1 = website is modern and well-built (coldest lead)
 */
export async function scoreSiteQuality(website: string | null): Promise<number> {
  if (!website) return 5

  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812 },
    })
    const page = await context.newPage()

    const url = website.startsWith('http') ? website : `https://${website}`

    const response = await page.goto(url, { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => null)

    // Site unreachable or error
    if (!response || response.status() >= 400) return 4

    // Check for parked/placeholder domains
    const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() ?? '')
    const parkedIndicators = [
      'domain for sale',
      'this domain',
      'parked',
      'coming soon',
      'under construction',
      'buy this domain',
      'godaddy',
      'squarespace',
    ]
    if (parkedIndicators.some((p) => bodyText.includes(p)) && bodyText.length < 500) return 4

    // Check basic quality signals
    let score = 1 // Start at best, deduct
    const issues: string[] = []

    // No HTTPS
    if (!page.url().startsWith('https')) {
      score += 1
      issues.push('no-ssl')
    }

    // Check viewport meta (mobile friendliness)
    const hasViewport = await page
      .evaluate(() => !!document.querySelector('meta[name="viewport"]'))
      .catch(() => false)
    if (!hasViewport) {
      score += 1
      issues.push('no-viewport')
    }

    // Very little content
    const contentLength = bodyText.length
    if (contentLength < 200) {
      score += 1
      issues.push('minimal-content')
    }

    // Check for modern frameworks/features
    const hasModernSignals = await page
      .evaluate(() => {
        const has = (sel: string) => !!document.querySelector(sel)
        return (
          has('link[rel="icon"]') &&
          has('meta[name="description"]') &&
          document.querySelectorAll('img').length > 1
        )
      })
      .catch(() => false)
    if (!hasModernSignals) {
      score += 0.5
    }

    return Math.min(Math.round(score), 4) // Cap at 4 since site exists
  } catch {
    // Site exists but couldn't load = probably bad
    return 4
  } finally {
    await browser?.close()
  }
}

/**
 * Extract email addresses from a business website
 */
export async function extractEmail(website: string): Promise<string | null> {
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()

    const url = website.startsWith('http') ? website : `https://${website}`
    await page.goto(url, { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => null)

    // Check current page for emails
    let email = await findEmailOnPage(page)
    if (email) return email

    // Try contact page
    const contactLink = await page
      .$eval('a[href*="contact"]', (el) => (el as HTMLAnchorElement).href)
      .catch(() => null)
    if (contactLink) {
      await page.goto(contactLink, { timeout: 10000, waitUntil: 'domcontentloaded' }).catch(() => null)
      email = await findEmailOnPage(page)
      if (email) return email
    }

    return null
  } catch {
    return null
  } finally {
    await browser?.close()
  }
}

async function findEmailOnPage(page: import('playwright').Page): Promise<string | null> {
  return page
    .evaluate(() => {
      // Check mailto links
      const mailtoEl = document.querySelector('a[href^="mailto:"]')
      if (mailtoEl) {
        const href = (mailtoEl as HTMLAnchorElement).href
        return href.replace('mailto:', '').split('?')[0].trim()
      }

      // Regex scan the page body
      const text = document.body?.innerHTML ?? ''
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
      const matches = text.match(emailRegex)
      if (matches && matches.length > 0) {
        // Filter out common false positives
        const filtered = matches.filter(
          (e) =>
            !e.includes('example.com') &&
            !e.includes('sentry.io') &&
            !e.includes('wixpress') &&
            !e.includes('@2x') &&
            !e.endsWith('.png') &&
            !e.endsWith('.jpg')
        )
        return filtered[0] ?? null
      }

      return null
    })
    .catch(() => null)
}

export interface EnrichedLead {
  name: string
  phone: string | null
  address: string | null
  email: string | null
  website: string | null
  rating: number | null
  review_count: number
  maps_url: string | null
  has_website: boolean
  site_quality: number
}

export async function enrichBusiness(
  business: RawBusiness,
  withEmail: boolean
): Promise<EnrichedLead> {
  const site_quality = await scoreSiteQuality(business.website)
  const has_website = !!business.website && site_quality < 5

  let email: string | null = null
  if (withEmail && business.website && site_quality < 5) {
    email = await extractEmail(business.website)
  }

  return {
    ...business,
    email,
    has_website,
    site_quality,
  }
}
