import { Phone } from 'lucide-react'
import { config } from '@/lib/config'

export function Hero() {
  return (
    <section className="bg-primary px-4 py-20 text-primary-foreground">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
          {config.hero.headline}
        </h1>
        <p className="mb-8 text-lg opacity-90 md:text-xl">{config.hero.subheadline}</p>
        <a
          href={`tel:${config.phone.replace(/\D/g, '')}`}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-bold text-primary transition hover:opacity-90"
        >
          <Phone className="h-5 w-5" />
          {config.hero.cta}
        </a>
      </div>
    </section>
  )
}
