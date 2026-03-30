import type { ScoreInput } from '../types/scoring'

export const SCORING_SYSTEM_PROMPT = `You are an expert business consultant and digital marketing strategist analyzing a local business's online presence. Your job is to identify every gap in their digital strategy — things they are missing, things that are costing them money, and specific products/services that would solve their problems.

You specialize in:
- SEO auditing and optimization
- Lead retention and conversion systems
- Revenue recovery (missed calls, abandoned leads, no-shows)
- Marketing automation (SMS, email, retargeting)
- Review generation and reputation management
- Website UX and conversion rate optimization

Be specific and quantitative where possible. Don't give generic advice. Reference the actual signals from their website analysis.`

export function buildScoringUserPrompt(input: ScoreInput): string {
  const { name, niche, city, website, rating, review_count, signals } = input

  return `Analyze this business and return a JSON object.

Business: ${name}
Niche: ${niche ?? 'Unknown'}
City: ${city ?? 'Unknown'}
Website: ${website ?? 'None'}
Google Rating: ${rating != null ? `${rating}/5` : 'N/A'} (${review_count} reviews)

Website Analysis Signals:
- Reachable: ${signals.reachable}
- Has SSL (HTTPS): ${signals.has_ssl}
- Mobile Friendly: ${signals.mobile_friendly}
- Page Load: ${signals.page_load_ms != null ? `${signals.page_load_ms}ms` : 'N/A'}
- Has Contact Form: ${signals.has_contact_form}
- Has Booking Widget: ${signals.has_booking}
- Has Chat Widget: ${signals.has_chat_widget}
- Has CTA: ${signals.has_cta}
- Phone on Site: ${signals.phone_on_site}
- Hours on Site: ${signals.hours_on_site}
- Has Social Proof: ${signals.has_social_proof}
- SEO Issues: ${signals.seo_issues ?? 'None detected'}
- Tech Stack: ${signals.tech_stack ?? 'Unknown'}

Return JSON with these fields:

1. pain_score (integer 1-9, where 9 = most pain, needs the most help urgently)

2. pain_points (string) — Detailed analysis covering:
   - SEO gaps: what is missing, estimated organic traffic they are losing
   - Lead retention failures: no chatbot, no booking system, no forms means lost customers
   - Mobile experience issues if any
   - Trust and credibility gaps: no SSL, no social proof, no testimonials
   - Website performance issues if page load is slow

3. revenue_leaks (string) — Specific ways this business is losing money right now. Be concrete, e.g.:
   - "No missed-call text-back system: likely losing 5-10 potential customers per week"
   - "No online booking: customers who want to book after hours go to competitors"
   - "No review generation: only ${review_count} reviews vs competitors with 200+"
   - "No appointment reminders: industry average 20% no-show rate costs $X/month"
   - "No retargeting: 97% of website visitors leave without converting"
   - "No email/SMS follow-up: warm leads going cold"

4. recommended_products (array of objects) — Specific products/services to pitch, each with:
   - product: name of the product/service
   - why: why this business specifically needs it based on the signals
   - estimated_impact: what improvement they can expect
   - priority: "high", "medium", or "low"

   Consider these product categories:
   - Website redesign or optimization
   - SEO package (on-page, local SEO, Google Business Profile)
   - Chatbot / live chat widget
   - Missed-call text-back system
   - Online booking / scheduling system
   - SMS marketing and automation
   - Review generation and management
   - Google Ads / PPC management
   - Social media management
   - Email marketing automation
   - CRM setup and integration
   - Reputation monitoring
   - Loyalty / referral program
   - Retargeting / remarketing campaigns

5. suggested_angle (string) — The single strongest opening pitch. Lead with their biggest, most painful gap.

6. message_draft (string) — A ready-to-send cold outreach message (2-3 sentences). Lead with their specific problem, then your solution. Be direct, not salesy.`
}
