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
  services: ServiceItem[]
  areas: AreaItem[]
  trustSignals: string[]
}

export interface ServiceItem {
  slug: string
  name: string
  description: string
  icon: string
}

export interface AreaItem {
  slug: string
  name: string
  description: string
}

export interface NicheContent {
  niche: string
  colors: SiteConfig['colors']
  hero: {
    headline: string
    subheadline: string
    cta: string
  }
  seo: {
    title: string
    description: string
  }
  services: ServiceItem[]
  defaultAreas: AreaItem[]
  trustSignals: string[]
}

export interface GenerateSiteInput {
  clientId: string
  niche: string
  businessName: string
  phone: string
  email: string
  contactEmail: string
  city: string
  state: string
  address: string
  googleReviewUrl?: string
  services?: string[]
  areas?: string[]
  primaryColor?: string
}

export interface DeployResult {
  url: string
  projectId: string
  deploymentId: string
  status: 'READY' | 'ERROR'
}
