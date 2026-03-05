import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '@/components/sidebar'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Agency OS',
  description: 'Internal CRM for web design agency',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const isLoginPage = pathname === '/login'

  return (
    <html lang="en">
      <body className={inter.className}>
        <TooltipProvider>
          {isLoginPage ? (
            <>
              {children}
              <Toaster />
            </>
          ) : (
            <div className="flex h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto pt-14 p-4 md:pt-6 md:p-6">{children}</main>
              <Toaster />
            </div>
          )}
        </TooltipProvider>
      </body>
    </html>
  )
}
