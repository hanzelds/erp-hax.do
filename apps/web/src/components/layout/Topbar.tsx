'use client'

import { usePathname } from 'next/navigation'
import { Bell, Search, HelpCircle, ChevronRight } from 'lucide-react'
import { navigation } from '@/lib/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'

interface TopbarProps {
  sidebarCollapsed: boolean
}

function getBreadcrumb(pathname: string) {
  const allItems = navigation.flatMap((s) => s.items)
  const current = allItems.find(
    (item) =>
      pathname === item.href ||
      (item.href !== '/dashboard' && pathname.startsWith(item.href))
  )
  return current ?? { label: 'ERP Hax', description: '' }
}

export function Topbar({ sidebarCollapsed }: TopbarProps) {
  const pathname = usePathname()
  const { user }  = useAuthStore()
  const crumb     = getBreadcrumb(pathname)
  const today     = formatDate(new Date())

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 flex items-center',
        'bg-white border-b border-gray-100',
        'transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'left-16' : 'left-60'
      )}
    >
      <div className="flex items-center w-full px-6 gap-4">

        {/* ── Breadcrumb ──────────────────────────────── */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-gray-400 text-sm hidden sm:block">ERP Hax</span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 hidden sm:block" />
          <div>
            <h1 className="text-gray-900 font-semibold text-sm leading-tight">
              {crumb.label}
            </h1>
            {crumb.description && (
              <p className="text-gray-400 text-xs hidden md:block">
                {crumb.description}
              </p>
            )}
          </div>
        </div>

        {/* ── Search ──────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-64 group focus-within:border-gray-300 focus-within:bg-white transition-all">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none w-full"
          />
          <kbd className="hidden lg:inline text-gray-300 text-xs font-mono border border-gray-200 rounded px-1 py-0.5 shrink-0">
            ⌘K
          </kbd>
        </div>

        {/* ── Date ─────────────────────────────────────── */}
        <span className="hidden lg:block text-xs text-gray-400 shrink-0">
          {today}
        </span>

        {/* ── Units badge ──────────────────────────────── */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: '#eef1f4', color: '#293c4f' }}
          >
            Hax
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            Koder
          </span>
        </div>

        {/* ── Notifications ────────────────────────────── */}
        <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell className="w-4 h-4" />
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>

        {/* ── Help ─────────────────────────────────────── */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors hidden sm:flex">
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* ── User avatar ──────────────────────────────── */}
        <div className="flex items-center gap-2.5 pl-1 border-l border-gray-100">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
            style={{ backgroundColor: '#293c4f' }}
          >
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-gray-800 text-sm font-medium leading-tight truncate max-w-28">
              {user?.name?.split(' ')[0] ?? 'Usuario'}
            </p>
            <p className="text-gray-400 text-xs">
              {user?.role === 'ADMIN' ? 'Admin' : 'Contabilidad'}
            </p>
          </div>
        </div>

      </div>
    </header>
  )
}
