import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { config } from '@/lib/config'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { StickyCta } from '@/components/sticky-cta'
import { JsonLd } from '@/components/json-ld'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: config.seo.title,
  description: config.seo.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root {
              --color-primary: ${config.colors.primary};
              --color-primary-foreground: ${config.colors.primaryForeground};
              --color-secondary: ${config.colors.secondary};
              --color-secondary-foreground: ${config.colors.secondaryForeground};
              --color-accent: ${config.colors.accent};
            }`,
          }}
        />
      </head>
      <body className={inter.className}>
        <JsonLd />
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
        <StickyCta />
      </body>
    </html>
  )
}
