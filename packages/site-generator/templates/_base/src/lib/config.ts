import siteConfig from '../../../site-config.json'

export interface SiteConfig {
  businessName: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  googleReviewUrl: string | null
  contactEmail: string
  colors: {
    primary: string
    primaryForeground: string
    secondary: string
    secondaryForeground: string
    accent: string
  }
  hero: {
    headline: string
    subheadline: string
    cta: string
  }
  seo: {
    title: string
    description: string
  }
  services: {
    slug: string
    name: string
    description: string
    icon: string
  }[]
  areas: {
    slug: string
    name: string
    description: string
  }[]
  trustSignals: string[]
}

export const config: SiteConfig = siteConfig as SiteConfig
