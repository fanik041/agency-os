import Link from 'next/link'
import { Phone, Mail, MapPin } from 'lucide-react'
import { config } from '@/lib/config'

export function Footer() {
  return (
    <footer className="border-t bg-gray-50 pb-24 md:pb-8">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-4 text-lg font-bold text-primary">{config.businessName}</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" /> {config.address}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <a href={`tel:${config.phone.replace(/\D/g, '')}`} className="hover:text-primary">
                  {config.phone}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <a href={`mailto:${config.email}`} className="hover:text-primary">
                  {config.email}
                </a>
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">Services</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              {config.services.map((service) => (
                <li key={service.slug}>
                  <Link href={`/services/${service.slug}`} className="hover:text-primary">
                    {service.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-bold">Service Areas</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              {config.areas.map((area) => (
                <li key={area.slug}>
                  <Link href={`/areas/${area.slug}`} className="hover:text-primary">
                    {area.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} {config.businessName}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
