import { chromium } from 'playwright'

export interface AnalyzeSignals {
  has_booking: boolean
  has_chat_widget: boolean
  has_contact_form: boolean
  page_load_ms: number | null
  mobile_friendly: boolean
  has_ssl: boolean
  seo_issues: string | null
  has_cta: boolean
  phone_on_site: boolean
  hours_on_site: boolean
  has_social_proof: boolean
  tech_stack: string | null
}

export interface AnalyzeResult extends AnalyzeSignals {
  url: string
  reachable: boolean
}

export function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function buildErrorResult(url: string): AnalyzeResult {
  return {
    url,
    reachable: false,
    has_booking: false,
    has_chat_widget: false,
    has_contact_form: false,
    page_load_ms: null,
    mobile_friendly: false,
    has_ssl: false,
    seo_issues: null,
    has_cta: false,
    phone_on_site: false,
    hours_on_site: false,
    has_social_proof: false,
    tech_stack: null,
  }
}

export async function analyzeWebsite(rawUrl: string): Promise<AnalyzeResult> {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

  if (!isValidUrl(url)) return buildErrorResult(url)

  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812 },
    })
    const page = await context.newPage()

    const startTime = Date.now()
    const response = await page
      .goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' })
      .catch(() => null)

    if (!response || response.status() >= 400) {
      return buildErrorResult(url)
    }

    const pageLoadMs = Date.now() - startTime

    // Wait a bit for JS to render
    await page.waitForTimeout(2000)

    const html = await page.content()
    const lowerHtml = html.toLowerCase()

    // ── Signal detection ──────────────────────────────────
    const has_booking =
      lowerHtml.includes('calendly.com') ||
      lowerHtml.includes('acuityscheduling.com') ||
      lowerHtml.includes('booksy.com') ||
      lowerHtml.includes('square.site/book') ||
      lowerHtml.includes('setmore.com')

    const has_chat_widget =
      lowerHtml.includes('widget.intercom.io') ||
      lowerHtml.includes('js.driftt.com') ||
      lowerHtml.includes('code.tidio.co') ||
      lowerHtml.includes('livechatinc.com') ||
      lowerHtml.includes('crisp.chat') ||
      lowerHtml.includes('tawk.to')

    const has_contact_form = (await page.$$('form')).length > 0

    const mobile_friendly = lowerHtml.includes('name="viewport"')

    const has_ssl = url.startsWith('https')

    // SEO issues
    const seoProblems: string[] = []
    const title = await page.title()
    if (!title) seoProblems.push('Missing title')
    const metaDesc = await page
      .$('meta[name="description"]')
      .then((el) => el?.getAttribute('content'))
      .catch(() => null)
    if (!metaDesc) seoProblems.push('Missing meta description')
    const h1Count = await page.$$eval('h1', (els) => els.length).catch(() => 0)
    if (h1Count === 0) seoProblems.push('Missing h1')
    const seo_issues = seoProblems.length > 0 ? seoProblems.join(', ') : null

    // CTA detection
    const ctaText = await page
      .$$eval('a, button', (els) =>
        els.map((el) => (el.textContent || '').toLowerCase()).join(' ')
      )
      .catch(() => '')
    const ctaPattern = /get started|book|schedule|call|contact us|free quote|request|sign up/i
    const has_cta = ctaPattern.test(ctaText)

    // Phone on site
    const has_tel_link = lowerHtml.includes('tel:')
    const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
    const phone_on_site = has_tel_link || phoneRegex.test(html)

    // Hours on site (word-boundary patterns)
    const hoursRegex =
      /\b(mon|tue|wed|thu|fri|sat|sun)\w*\s*[-\u2013]\s*(mon|tue|wed|thu|fri|sat|sun)\w*|(\d{1,2}:\d{2}\s*(am|pm))\s*[-\u2013]\s*(\d{1,2}:\d{2}\s*(am|pm))|\bhours\b|\bopen\s+(daily|24)/i
    const hours_on_site = hoursRegex.test(html)

    // Social proof
    const has_social_proof =
      lowerHtml.includes('testimonial') ||
      lowerHtml.includes('reviews') ||
      lowerHtml.includes('client-logo') ||
      lowerHtml.includes('as seen on') ||
      lowerHtml.includes('trusted by')

    // Tech stack detection (specific patterns)
    const techFound: string[] = []
    if (lowerHtml.includes('wp-content') || lowerHtml.includes('wp-includes'))
      techFound.push('WordPress')
    if (lowerHtml.includes('cdn.shopify.com')) techFound.push('Shopify')
    if (lowerHtml.includes('squarespace.com')) techFound.push('Squarespace')
    if (lowerHtml.includes('wix.com')) techFound.push('Wix')
    if (lowerHtml.includes('react-dom') || lowerHtml.includes('__next'))
      techFound.push('React')
    if (lowerHtml.includes('/_next/')) techFound.push('Next.js')
    if (lowerHtml.includes('jquery')) techFound.push('jQuery')
    if (lowerHtml.includes('bootstrap')) techFound.push('Bootstrap')
    if (lowerHtml.includes('tailwindcss') || lowerHtml.includes('tailwind'))
      techFound.push('Tailwind')
    const tech_stack = techFound.length > 0 ? techFound.join(', ') : null

    return {
      url,
      reachable: true,
      has_booking,
      has_chat_widget,
      has_contact_form,
      page_load_ms: pageLoadMs,
      mobile_friendly,
      has_ssl,
      seo_issues,
      has_cta,
      phone_on_site,
      hours_on_site,
      has_social_proof,
      tech_stack,
    }
  } catch {
    return buildErrorResult(url)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
