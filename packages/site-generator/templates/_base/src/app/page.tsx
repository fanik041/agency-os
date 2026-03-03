import { config } from '@/lib/config'
import { Hero } from '@/components/hero'
import { ServiceCard } from '@/components/service-card'
import { AreaCard } from '@/components/area-card'
import { ContactForm } from '@/components/contact-form'
import { Shield, Clock, Star, ThumbsUp } from 'lucide-react'

const trustIcons = [Shield, Clock, Star, ThumbsUp, Shield]

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* Trust Signals */}
      <section className="border-b bg-secondary py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-6 px-4">
          {config.trustSignals.map((signal, i) => {
            const Icon = trustIcons[i % trustIcons.length]
            return (
              <div key={signal} className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
                <Icon className="h-4 w-4" />
                {signal}
              </div>
            )
          })}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-2 text-center text-3xl font-bold">Our Services</h2>
          <p className="mb-10 text-center text-gray-600">
            Professional services for {config.city} and surrounding areas
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {config.services.map((service) => (
              <ServiceCard key={service.slug} {...service} />
            ))}
          </div>
        </div>
      </section>

      {/* Areas */}
      <section id="areas" className="bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-2 text-center text-3xl font-bold">Service Areas</h2>
          <p className="mb-10 text-center text-gray-600">
            Proudly serving {config.city}, {config.state} and nearby communities
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {config.areas.map((area) => (
              <AreaCard key={area.slug} {...area} />
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="mb-2 text-center text-3xl font-bold">Get in Touch</h2>
          <p className="mb-10 text-center text-gray-600">
            Request a free estimate or ask us a question
          </p>
          <ContactForm />
        </div>
      </section>
    </>
  )
}
