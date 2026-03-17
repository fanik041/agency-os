import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

export interface RawBusiness {
  name: string
  phone: string | null
  address: string | null
  website: string | null
  rating: number | null
  review_count: number
  reviews_raw: string | null
  maps_url: string | null
}

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
      ],
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

// ── Stealth helpers ──────────────────────────────────────────────

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const STEALTH_INIT_SCRIPT = `
  // Hide webdriver flag
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // Fake plugins array (real Chrome has plugins)
  Object.defineProperty(navigator, 'plugins', {
    get: () => [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
      { name: 'Native Client', filename: 'internal-nacl-plugin' },
    ],
  });

  // Fake languages
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // Pass Chrome app check
  window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };

  // Hide headless in permissions query
  const originalQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions);
  if (originalQuery) {
    window.navigator.permissions.query = (params) =>
      params.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(params);
  }
`

async function createStealthContext(b: Browser): Promise<BrowserContext> {
  const context = await b.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    geolocation: undefined,
    permissions: [],
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  await context.addInitScript(STEALTH_INIT_SCRIPT)
  return context
}

/** Dismiss Google cookie consent if it appears */
async function dismissConsent(page: Page) {
  try {
    // Google consent buttons — try multiple selectors
    const selectors = [
      'button[aria-label="Accept all"]',
      'button[aria-label="Reject all"]',
      'form[action*="consent"] button',
      '[aria-label="Before you continue to Google Maps"] button:first-of-type',
    ]
    for (const sel of selectors) {
      const btn = await page.$(sel)
      if (btn) {
        await btn.click()
        await page.waitForTimeout(randomDelay(800, 1500))
        return
      }
    }
    // Fallback: look for "Accept all" by text content
    const acceptBtn = await page.locator('button:has-text("Accept all")').first()
    if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptBtn.click()
      await page.waitForTimeout(randomDelay(800, 1500))
    }
  } catch {
    // No consent dialog — continue
  }
}

// ── Core scraper ─────────────────────────────────────────────────

async function autoScroll(page: Page, containerSelector: string, maxScrolls = 10) {
  for (let i = 0; i < maxScrolls; i++) {
    const container = await page.$(containerSelector)
    if (!container) break

    const previousHeight = await container.evaluate((el) => el.scrollHeight)
    await container.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    await page.waitForTimeout(randomDelay(1200, 2200))
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
  const context = await createStealthContext(b)
  const page = await context.newPage()
  const results: RawBusiness[] = []

  try {
    const query = encodeURIComponent(`${niche} in ${location}`)
    await page.goto(`https://www.google.com/maps/search/${query}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // Dismiss cookie consent if Google shows it
    await dismissConsent(page)

    // Wait for results to load (longer timeout for slow connections)
    await page.waitForSelector('a.hfpxzc', { timeout: 15000 }).catch(() => null)

    // Small human-like delay before scrolling
    await page.waitForTimeout(randomDelay(1000, 2000))

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
        await page.waitForTimeout(randomDelay(1500, 3000))

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

        // Extract review text (up to 5 most relevant reviews)
        let reviews_raw: string | null = null
        try {
          // Click the reviews tab
          const reviewsTab = await page.$('button[aria-label*="Reviews"]')
          if (reviewsTab) {
            await reviewsTab.click()
            await page.waitForTimeout(randomDelay(1500, 2500))

            // Grab review text snippets
            const reviewTexts = await page.$$eval(
              'span.wiI7pd',
              (els) => els.slice(0, 15).map((el) => el.textContent?.trim()).filter(Boolean)
            )
            if (reviewTexts.length > 0) {
              reviews_raw = reviewTexts.join(' | ')
            }
          }
        } catch {}

        const business: RawBusiness = {
          name: listing.name,
          maps_url: listing.href,
          rating,
          review_count,
          reviews_raw,
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
          await page.waitForTimeout(randomDelay(800, 1500))
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
