import Link from 'next/link'
import { MapPin } from 'lucide-react'

interface AreaCardProps {
  slug: string
  name: string
  description: string
}

export function AreaCard({ slug, name, description }: AreaCardProps) {
  return (
    <Link
      href={`/areas/${slug}`}
      className="group flex items-start gap-3 rounded-xl border bg-white p-5 transition hover:border-primary hover:shadow-lg"
    >
      <div className="mt-0.5 shrink-0 rounded-lg bg-secondary p-2">
        <MapPin className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="font-bold group-hover:text-primary">{name}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </Link>
  )
}
