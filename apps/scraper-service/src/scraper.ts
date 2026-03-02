import { chromium, type Browser, type Page } from 'playwright'

export interface RawBusiness {
  name: string
  phone: string | null
  address: string | null
  website: string | null
  rating: number | null
  review_count: number
  maps_url: string | null
}

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
  return browser
}

export async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
  }
}

async function autoScroll(page: Page, containerSelector: string, maxScrolls = 10) {
  for (let i = 0; i < maxScrolls; i++) {
    const container = await page.$(containerSelector)
    if (!container) break

    const previousHeight = await container.evaluate((el) => el.scrollHeight)
    await container.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await page.waitForTimeout(1500)
    const newHeight = await container.evaluate((el) => el.scrollHeight)

    // Stop if we've reached the bottom
    if (newHeight === previousHeight) break
  }
}

async function extractBusinessDetail(page: Page): Promise<Partial<RawBusiness>> {
  const detail: Partial<RawBusiness> = {}

  // Phone
  try {
    const phoneEl = await page.$('button[data-tooltip="Copy phone number"]')
    if (phoneEl) {
      const phoneText = await phoneEl.evaluate((el) => {
        const parent = el.closest('[data-tooltip="Copy phone number"]')
        return parent?.textContent?.trim() ?? null
      })
      if (phoneText) {
        // Extract just the phone number from the text
        const phoneMatch = phoneText.match(/[\d().\-+\s]{7,}/)
        detail.phone = phoneMatch ? phoneMatch[0].trim() : null
      }
    }
  } catch {}

  // Address
  try {
    const addressEl = await page.$('button[data-item-id="address"]')
    if (addressEl) {
      detail.address = await addressEl.evaluate((el) => el.textContent?.trim() ?? null)
    }
  } catch {}

  // Website
  try {
    const websiteEl = await page.$('a[data-item-id="authority"]')
    if (websiteEl) {
      detail.website = await websiteEl.getAttribute('href')
    }
  } catch {}

  return detail
}

export async function scrapeGoogleMaps(
  niche: string,
  location: string,
  maxResults: number,
  onLead?: (business: RawBusiness) => Promise<void>
): Promise<RawBusiness[]> {
  const b = await getBrowser()
  const context = await b.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  })
  const page = await context.newPage()
  const results: RawBusiness[] = []

  try {
    const query = encodeURIComponent(`${niche} in ${location}`)
    await page.goto(`https://www.google.com/maps/search/${query}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    // Wait for results to load
    await page.waitForSelector('a.hfpxzc', { timeout: 15000 }).catch(() => null)

    // Scroll the results panel to load more listings
    const feedSelector = 'div[role="feed"]'
    const scrolls = Math.ceil(maxResults / 8) // ~8 results per scroll
    await autoScroll(page, feedSelector, scrolls)

    // Get all listing links
    const listingLinks = await page.$$eval('a.hfpxzc', (els) =>
      els.map((el) => ({
        href: el.getAttribute('href') ?? '',
        name: el.getAttribute('aria-label') ?? '',
      }))
    )

    const toProcess = listingLinks.slice(0, maxResults)
    console.log(`  Found ${listingLinks.length} listings, processing ${toProcess.length}`)

    for (const listing of toProcess) {
      try {
        // Click the listing to open detail panel
        const link = await page.$(`a.hfpxzc[aria-label="${listing.name.replace(/"/g, '\\"')}"]`)
        if (!link) continue
        await link.click()
        await page.waitForTimeout(2000)

        // Extract rating
        let rating: number | null = null
        try {
          const ratingText = await page.$eval('span.MW4etd', (el) => el.textContent?.trim())
          if (ratingText) rating = parseFloat(ratingText)
        } catch {}

        // Extract review count
        let review_count = 0
        try {
          const reviewText = await page.$eval('span.UY7F9', (el) => el.textContent?.trim())
          if (reviewText) {
            const num = reviewText.replace(/[^0-9]/g, '')
            review_count = parseInt(num, 10) || 0
          }
        } catch {}

        // Extract detail (phone, address, website)
        const detail = await extractBusinessDetail(page)

        const business: RawBusiness = {
          name: listing.name,
          maps_url: listing.href,
          rating,
          review_count,
          phone: detail.phone ?? null,
          address: detail.address ?? null,
          website: detail.website ?? null,
        }

        results.push(business)
        if (onLead) await onLead(business)

        // Go back to results list
        const backButton = await page.$('button[aria-label="Back"]')
        if (backButton) {
          await backButton.click()
          await page.waitForTimeout(1000)
        }
      } catch (err) {
        console.warn(`  Failed to extract listing "${listing.name}":`, err)
      }
    }
  } finally {
    await context.close()
  }

  return results
}
