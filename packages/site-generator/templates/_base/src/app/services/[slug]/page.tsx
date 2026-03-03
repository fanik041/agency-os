import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Phone } from 'lucide-react'
import * as Icons from 'lucide-react'
import { config } from '@/lib/config'

export function generateStaticParams() {
  return config.services.map((s) => ({ slug: s.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const service = config.services.find((s) => s.slug === params.slug)
  if (!service) return {}
  return {
    title: `${service.name} | ${config.businessName}`,
    description: `${service.description} ${config.businessName} in ${config.city}, ${config.state}.`,
  }
}

export default function ServicePage({ params }: { params: { slug: string } }) {
  const service = config.services.find((s) => s.slug === params.slug)
  if (!service) notFound()

  const Icon = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[service.icon] ?? Icons.Wrench

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-8 inline-flex rounded-xl bg-secondary p-4">
        <Icon className="h-10 w-10 text-primary" />
      </div>
      <h1 className="mb-4 text-4xl font-bold">{service.name}</h1>
      <p className="mb-6 text-lg text-gray-600">{service.description}</p>

      <div className="mb-8 rounded-xl bg-gray-50 p-6">
        <h2 className="mb-2 text-xl font-bold">Why Choose {config.businessName}?</h2>
        <ul className="space-y-2 text-gray-600">
          {config.trustSignals.map((signal) => (
            <li key={signal} className="flex items-center gap-2">
              <span className="text-primary">&#10003;</span> {signal}
            </li>
          ))}
        </ul>
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
          Request a Free Estimate
        </Link>
      </div>
    </div>
  )
}
