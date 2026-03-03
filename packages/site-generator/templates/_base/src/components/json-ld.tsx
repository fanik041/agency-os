import { config } from '@/lib/config'

export function JsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: config.businessName,
    telephone: config.phone,
    email: config.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: config.address,
      addressLocality: config.city,
      addressRegion: config.state,
    },
    url: typeof window !== 'undefined' ? window.location.origin : undefined,
    areaServed: config.areas.map((area) => ({
      '@type': 'City',
      name: area.name,
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
