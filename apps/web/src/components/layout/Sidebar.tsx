'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navigation } from '@/lib/navigation'
import { useAuthStore } from '@/lib/auth-store'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout, can } = useAuthStore()

  return (
    <aside
      className={cn(
        'flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300 ease-in-out',
        'bg-white border-r border-gray-100',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* ── Logo ──────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b border-gray-100 shrink-0',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#293c4f' }}>
              <HaxIcon />
            </div>
            <div className="min-w-0">
              <p className="text-gray-800 font-semibold text-sm leading-tight truncate">ERP Hax</p>
              <p className="text-gray-400 text-xs truncate">HAX ESTUDIO CREATIVO</p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#293c4f' }}>
            <HaxIcon />
          </div>
        )}

        {!collapsed && (
          <button
            onClick={onToggle}
            className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {navigation.map((section) => {
          const visibleItems = section.items.filter((item) => can(item.module))
          if (visibleItems.length === 0) return null
          return (
            <div key={section.title} className="mb-1">
              {!collapsed && (
                <p className="px-4 py-1.5 text-gray-400 text-[10px] font-semibold uppercase tracking-widest">
                  {section.title}
                </p>
              )}
              {collapsed && <div className="mx-3 my-1.5 h-px bg-gray-100" />}

              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 mx-2 my-0.5 rounded-lg transition-all duration-150',
                      collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2',
                      isActive
                        ? 'bg-[#293c4f]/10 text-[#293c4f]'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'shrink-0 transition-colors',
                        collapsed ? 'w-4.5 h-4.5' : 'w-4 h-4',
                        isActive ? 'text-[#293c4f]' : 'text-gray-400'
                      )}
                    />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    )}
                    {!collapsed && isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: '#293c4f', opacity: 0.5 }} />
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
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
              style={{ backgroundColor: '#293c4f' }}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 text-sm font-medium truncate">{user?.name ?? 'Usuario'}</p>
              <p className="text-gray-400 text-xs truncate">
                {user?.role === 'ADMIN' ? 'Administrador' : 'Contabilidad'}
              </p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: '#293c4f' }}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Collapsed: expand button */}
      {collapsed && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-700 transition-all z-50"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  )
}

function HaxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.85" />
      <rect x="8" y="1" width="5" height="5" rx="1" fill="white" fillOpacity="0.85" />
      <rect x="1" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.85" />
      <rect x="8" y="8" width="5" height="5" rx="1" fill="white" fillOpacity="0.85" />
    </svg>
  )
}
