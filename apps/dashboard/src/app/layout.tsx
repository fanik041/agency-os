import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '@/components/sidebar'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Agency OS',
  description: 'Internal CRM for web design agency',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TooltipProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto pt-14 p-4 md:pt-6 md:p-6">{children}</main>
          </div>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  )
}
