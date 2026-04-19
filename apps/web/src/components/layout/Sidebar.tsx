'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, LogOut, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navigation } from '@/lib/navigation'
import { useAuthStore } from '@/lib/auth-store'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname  = usePathname()
  const { user, logout, can } = useAuthStore()

  return (
    <aside
      className={cn(
        'flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300 ease-in-out',
        'border-r border-white/8',
        collapsed ? 'w-16' : 'w-60'
      )}
      style={{ backgroundColor: '#293c4f' }}
    >
      {/* ── Logo ─────────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b shrink-0',
          'border-white/8',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
            >
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">
                ERP Hax
              </p>
              <p className="text-white/50 text-xs truncate">
                HAX ESTUDIO CREATIVO
              </p>
            </div>
          </div>
        )}

        {collapsed && (
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            <Building2 className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Toggle button — only show when not collapsed */}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-all shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {navigation.map((section) => {
          const visibleItems = section.items.filter(item => can(item.module))
          if (visibleItems.length === 0) return null
          return (
          <div key={section.title} className="mb-1">
            {/* Section title */}
            {!collapsed && (
              <p className="px-4 py-1.5 text-white/35 text-xs font-medium uppercase tracking-wider">
                {section.title}
              </p>
            )}
            {collapsed && (
              <div className="mx-2 my-1 h-px bg-white/8" />
            )}

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
                    'flex items-center gap-3 mx-2 my-0.5 rounded-md transition-all duration-150',
                    collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2',
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/8'
                  )}
                >
                  <item.icon
                    className={cn(
                      'shrink-0 transition-colors',
                      collapsed ? 'w-5 h-5' : 'w-4 h-4',
                      isActive ? 'text-white' : 'text-white/60'
                    )}
                  />
                  {!collapsed && (
                    <span className="text-sm font-medium truncate">
                      {item.label}
                    </span>
                  )}
                  {!collapsed && isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                  )}
                </Link>
              )
            })}
          </div>
          )
        })}
      </nav>

      {/* ── User footer ──────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/8 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {user?.name ?? 'Usuario'}
              </p>
              <p className="text-white/45 text-xs truncate">
                {user?.role === 'ADMIN' ? 'Administrador' : 'Contabilidad'}
              </p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/8 transition-all shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="w-7 h-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/8 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Collapsed: expand button at bottom */}
      {collapsed && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-all z-50"
          style={{
            backgroundColor: '#293c4f',
            borderColor: 'rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  )
}
