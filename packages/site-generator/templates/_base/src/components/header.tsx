import Link from 'next/link'
import { Phone } from 'lucide-react'
import { config } from '@/lib/config'

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-primary">
          {config.businessName}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/#services" className="text-sm font-medium text-gray-600 hover:text-primary">
            Services
          </Link>
          <Link href="/#areas" className="text-sm font-medium text-gray-600 hover:text-primary">
            Areas
          </Link>
          {config.googleReviewUrl && (
            <Link href="/reviews" className="text-sm font-medium text-gray-600 hover:text-primary">
              Reviews
            </Link>
          )}
          <Link href="/#contact" className="text-sm font-medium text-gray-600 hover:text-primary">
            Contact
          </Link>
        </nav>

        <a
          href={`tel:${config.phone.replace(/\D/g, '')}`}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Phone className="h-4 w-4" />
          <span className="hidden sm:inline">{config.phone}</span>
          <span className="sm:hidden">Call</span>
        </a>
      </div>
    </header>
  )
}
