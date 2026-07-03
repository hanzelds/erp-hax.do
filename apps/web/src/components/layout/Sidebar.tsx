'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navigation } from '@/lib/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { HaxLogo, HaxMark } from '@/components/ui/HaxLogo'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout, can } = useAuthStore()

  return (
    <aside
      className={cn(
        'flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300 ease-in-out border-r',
        'bg-white border-gray-100',
        'w-60',
        collapsed && 'md:w-16',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
    >
      {/* ── Logo ──────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b border-gray-100 shrink-0',
          collapsed ? 'md:justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center min-w-0 flex-1">
            <HaxLogo color="#293c4f" className="h-7 w-auto" />
          </Link>
        )}

        <div className="hidden md:flex">
          {collapsed && (
            <Link href="/dashboard" title="ERP Hax" className="flex items-center justify-center">
              <HaxMark color="#293c4f" className="h-8 w-auto" />
            </Link>
          )}

          {!collapsed && (
            <button
              onClick={onToggle}
              className="w-6 h-6 rounded flex items-center justify-center transition-all shrink-0 text-gray-300 hover:text-gray-600 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mobile: always show logo */}
        <div className="md:hidden flex items-center min-w-0 flex-1">
          <HaxLogo color="#293c4f" className="h-7 w-auto" />
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {navigation.map((section) => {
          const visibleItems = section.items.filter((item) => can(item.module))
          if (visibleItems.length === 0) return null
          return (
            <div key={section.title} className="mb-1">
              {!collapsed && (
                <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {section.title}
                </p>
              )}
              {collapsed && <div className="mx-3 my-1.5 h-px bg-gray-100 hidden md:block" />}

              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={onMobileClose}
                    className={cn(
                      'flex items-center gap-3 mx-2 my-0.5 rounded-lg transition-all duration-150',
                      collapsed ? 'md:px-2 md:py-2.5 md:justify-center px-3 py-2' : 'px-3 py-2',
                      isActive
                        ? 'bg-[#293c4f]/10 text-[#293c4f]'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
                    )}
                  >
                    <item.icon
                      className={cn(
                        'shrink-0 transition-colors',
                        collapsed ? 'md:w-4.5 md:h-4.5 w-4 h-4' : 'w-4 h-4',
                        isActive ? 'text-[#293c4f]' : 'text-gray-400',
                      )}
                    />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    )}
                    {/* Always show label on mobile */}
                    {collapsed && (
                      <span className="text-sm font-medium truncate md:hidden">{item.label}</span>
                    )}
                    {!collapsed && isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0 bg-[#293c4f] opacity-50" />
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* ── User footer ───────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-100 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white bg-[#293c4f]">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gray-700">{user?.name ?? 'Usuario'}</p>
              <p className="text-xs truncate text-gray-400">
                {user?.role === 'ADMIN' ? 'Administrador' : 'Contabilidad'}
              </p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all shrink-0 text-gray-300 hover:text-gray-600 hover:bg-gray-50"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-[#293c4f]">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-gray-300 hover:text-gray-600 hover:bg-gray-50"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Collapsed: expand button (desktop only) */}
      {collapsed && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center transition-all z-50 hidden md:flex bg-white border-gray-200 text-gray-400 hover:text-gray-700"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  )
}

