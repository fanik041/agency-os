import { Star, ExternalLink } from 'lucide-react'
import { config } from '@/lib/config'

export const metadata = {
  title: `Reviews | ${config.businessName}`,
  description: `See what customers say about ${config.businessName} in ${config.city}, ${config.state}.`,
}

export default function ReviewsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-4 text-4xl font-bold">Customer Reviews</h1>
      <p className="mb-8 text-lg text-gray-600">
        We take pride in delivering excellent service to every customer in {config.city}.
      </p>

      <div className="mb-8 rounded-xl bg-secondary p-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-8 w-8 fill-primary text-primary" />
          ))}
        </div>
        <p className="mb-6 text-lg text-secondary-foreground">
          Our customers love us! See our reviews on Google.
        </p>
        {config.googleReviewUrl ? (
          <a
            href={config.googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition hover:opacity-90"
          >
            <ExternalLink className="h-5 w-5" />
            Leave Us a Review on Google
          </a>
        ) : (
          <p className="text-sm text-gray-500">Google review link coming soon.</p>
        )}
      </div>

      <div className="rounded-xl border p-6">
        <h2 className="mb-4 text-xl font-bold">Why Customers Choose {config.businessName}</h2>
        <ul className="space-y-3 text-gray-600">
          {config.trustSignals.map((signal) => (
            <li key={signal} className="flex items-center gap-2">
              <Star className="h-4 w-4 shrink-0 text-primary" />
              {signal}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
