import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Phone, MapPin } from 'lucide-react'
import { config } from '@/lib/config'

export function generateStaticParams() {
  return config.areas.map((a) => ({ slug: a.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const area = config.areas.find((a) => a.slug === params.slug)
  if (!area) return {}
  return {
    title: `${area.name} | ${config.businessName}`,
    description: `${config.businessName} serves ${area.name}. ${area.description}`,
  }
}

export default function AreaPage({ params }: { params: { slug: string } }) {
  const area = config.areas.find((a) => a.slug === params.slug)
  if (!area) notFound()

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8 inline-flex rounded-xl bg-secondary p-4">
        <MapPin className="h-10 w-10 text-primary" />
      </div>
      <h1 className="mb-4 text-4xl font-bold">{config.businessName} in {area.name}</h1>
      <p className="mb-6 text-lg text-gray-600">{area.description}</p>

      <div className="mb-8">
        <h2 className="mb-4 text-2xl font-bold">Services Available in {area.name}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {config.services.map((service) => (
            <Link
              key={service.slug}
              href={`/services/${service.slug}`}
              className="rounded-lg border p-4 transition hover:border-primary hover:shadow"
            >
              <h3 className="font-bold hover:text-primary">{service.name}</h3>
              <p className="text-sm text-gray-600">{service.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <a
          href={`tel:${config.phone.replace(/\D/g, '')}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition hover:opacity-90"
        >
          <Phone className="h-5 w-5" />
          Call {config.phone}
        </a>
        <Link
          href="/#contact"
          className="inline-flex items-center justify-center rounded-lg border-2 border-primary px-6 py-3 font-bold text-primary transition hover:bg-secondary"
        >
          Get a Free Estimate
        </Link>
      </div>
    </div>
  )
}
