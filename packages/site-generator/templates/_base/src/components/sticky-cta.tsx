import { Phone } from 'lucide-react'
import { config } from '@/lib/config'

export function StickyCta() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-primary p-3 md:hidden">
      <a
        href={`tel:${config.phone.replace(/\D/g, '')}`}
        className="flex items-center justify-center gap-2 text-lg font-bold text-primary-foreground"
      >
        <Phone className="h-5 w-5" />
        Call {config.phone}
      </a>
    </div>
  )
}
