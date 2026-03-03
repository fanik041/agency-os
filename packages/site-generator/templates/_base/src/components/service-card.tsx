import Link from 'next/link'
import * as Icons from 'lucide-react'

interface ServiceCardProps {
  slug: string
  name: string
  description: string
  icon: string
}

export function ServiceCard({ slug, name, description, icon }: ServiceCardProps) {
  const Icon = (Icons as Record<string, React.ComponentType<{ className?: string }>>)[icon] ?? Icons.Wrench

  return (
    <Link
      href={`/services/${slug}`}
      className="group rounded-xl border bg-white p-6 transition hover:border-primary hover:shadow-lg"
    >
      <div className="mb-4 inline-flex rounded-lg bg-secondary p-3">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mb-2 text-lg font-bold group-hover:text-primary">{name}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  )
}
