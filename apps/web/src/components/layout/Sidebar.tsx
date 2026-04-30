'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs'
import {
  LayoutDashboard,
  Plug,
  BookOpen,
  FileText,
  Shield,
  Settings,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/connectors', label: 'Connectors', icon: Plug },
  { href: '/dashboard/dictionary', label: 'Dictionary', icon: BookOpen },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
  { href: '/dashboard/rules', label: 'Business Rules', icon: Shield },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 flex flex-col bg-navy-500 text-white shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-teal-DEFAULT" />
          <span className="font-bold text-lg tracking-tight">Context Layer</span>
        </div>
        <p className="text-xs text-white/50 mt-0.5">Implementation Dashboard</p>
      </div>

      {/* Org switcher */}
      <div className="px-4 py-3 border-b border-white/10">
        <OrganizationSwitcher
          appearance={{
            elements: {
              organizationSwitcherTrigger: 'text-white hover:bg-white/10 rounded-lg px-2 py-1.5 w-full',
              organizationSwitcherTriggerIcon: 'text-white/60',
            },
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-teal-DEFAULT text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User button */}
      <div className="px-4 py-4 border-t border-white/10">
        <UserButton
          appearance={{
            elements: {
              userButtonAvatarBox: 'w-8 h-8',
            },
          }}
        />
      </div>
    </aside>
  )
}
