'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  LayoutDashboard,
  Users,
  Search,
  UserSearch,
  Briefcase,
  DollarSign,
  Globe,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/app/login/actions'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/scraper', label: 'Scraper', icon: Search },
  { href: '/contacts', label: 'Contacts', icon: UserSearch },
  { href: '/clients', label: 'Clients', icon: Briefcase },
  { href: '/revenue', label: 'Revenue', icon: DollarSign },
  { href: '/sites', label: 'Sites', icon: Globe },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(() => logout())
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-[#dadde1] bg-white px-4 md:hidden">
        <span className="text-lg font-semibold tracking-tight text-[#1c1e21]">Agency OS</span>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile dropdown nav */}
      {mobileOpen && (
        <nav className="fixed top-14 left-0 right-0 z-40 border-b border-[#dadde1] bg-white p-2 md:hidden">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-56 flex-col border-r border-[#dadde1] bg-white md:flex">
        <div className="flex h-14 items-center border-b border-[#dadde1] px-4">
          <span className="text-lg font-semibold tracking-tight text-[#1c1e21]">Agency OS</span>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#e7f3ff] text-[#1877f2]'
                    : 'text-[#65676b] hover:bg-[#f0f2f5] hover:text-[#1c1e21]'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-[#dadde1] p-2">
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#65676b] transition-colors hover:bg-[#f0f2f5] hover:text-[#1c1e21] disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {isPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>
    </>
  )
}
