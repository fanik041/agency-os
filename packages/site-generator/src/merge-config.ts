import type { SiteConfig, NicheContent, GenerateSiteInput, AreaItem } from './types'

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

export function mergeConfig(niche: NicheContent, input: GenerateSiteInput): SiteConfig {
  const vars: Record<string, string> = {
    city: input.city,
    state: input.state,
    businessName: input.businessName,
  }

  const services = input.services?.length
    ? input.services.map((name) => {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const existing = niche.services.find(
          (s) => s.slug === slug || s.name.toLowerCase() === name.toLowerCase()
        )
        return existing ?? { slug, name, description: `Professional ${name.toLowerCase()} services in ${input.city}.`, icon: 'Wrench' }
      })
    : niche.services

  const areas: AreaItem[] = input.areas?.length
    ? input.areas.map((name) => {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        return { slug, name, description: interpolate(`Serving ${name} in {city}, {state}.`, vars) }
      })
    : niche.defaultAreas.map((a) => ({
        ...a,
        description: interpolate(a.description, vars),
      }))

  const colors = input.primaryColor
    ? { ...niche.colors, primary: input.primaryColor }
    : niche.colors

  return {
    businessName: input.businessName,
    phone: input.phone,
    email: input.email,
    address: input.address,
    city: input.city,
    state: input.state,
    googleReviewUrl: input.googleReviewUrl ?? null,
    contactEmail: input.contactEmail,
    colors,
    hero: {
      headline: interpolate(niche.hero.headline, vars),
      subheadline: interpolate(niche.hero.subheadline, vars),
      cta: niche.hero.cta,
    },
    seo: {
      title: interpolate(niche.seo.title, vars),
      description: interpolate(niche.seo.description, vars),
    },
    services,
    areas,
    trustSignals: niche.trustSignals,
  }
}
