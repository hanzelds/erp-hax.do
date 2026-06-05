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
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout, can, mode, setMode } = useAuthStore()
  const isProforma = mode === 'proforma'

  // Paleta dinámica según el modo
  const p = isProforma
    ? {
        aside:      'bg-[#111827] border-white/[0.06]',
        logoBorder: 'border-white/[0.06]',
        logoColor:  'white',
        sectionLabel: 'text-white/30',
        divider:    'bg-white/[0.05]',
        navActive:  'bg-amber-500/15 text-amber-300',
        navInactive:'text-white/50 hover:text-white/80 hover:bg-white/[0.04]',
        iconActive: 'text-amber-400',
        iconInact:  'text-white/30',
        dot:        '#f59e0b',
        footBorder: 'border-white/[0.06]',
        userName:   'text-white/80',
        userRole:   'text-white/30',
        logoutBtn:  'text-white/25 hover:text-white/60 hover:bg-white/[0.05]',
        expandBtn:  'bg-[#1a2533] border-white/10 text-white/40 hover:text-white/70',
        toggleBtn:  'bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25',
        collapseBtn:'text-white/25 hover:text-white/60 hover:bg-white/[0.05]',
      }
    : {
        aside:      'bg-white border-gray-100',
        logoBorder: 'border-gray-100',
        logoColor:  '#293c4f',
        sectionLabel: 'text-gray-400',
        divider:    'bg-gray-100',
        navActive:  'bg-[#293c4f]/10 text-[#293c4f]',
        navInactive:'text-gray-500 hover:text-gray-700 hover:bg-gray-50',
        iconActive: 'text-[#293c4f]',
        iconInact:  'text-gray-400',
        dot:        '#293c4f',
        footBorder: 'border-gray-100',
        userName:   'text-gray-700',
        userRole:   'text-gray-400',
        logoutBtn:  'text-gray-300 hover:text-gray-600 hover:bg-gray-50',
        expandBtn:  'bg-white border-gray-200 text-gray-400 hover:text-gray-700',
        toggleBtn:  'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20',
        collapseBtn:'text-gray-300 hover:text-gray-600 hover:bg-gray-50',
      }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen fixed left-0 top-0 z-40 transition-all duration-300 ease-in-out border-r',
        p.aside,
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* ── Logo ──────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center h-16 px-4 border-b shrink-0',
          p.logoBorder,
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center min-w-0 flex-1">
            <HaxLogo color={p.logoColor} className="h-7 w-auto" />
          </Link>
        )}

        {collapsed && (
          <Link href="/dashboard" title="ERP Hax" className="flex items-center justify-center">
            <HaxMark color={p.logoColor} className="h-8 w-auto" />
          </Link>
        )}

        {!collapsed && (
          <button
            onClick={onToggle}
            className={cn('w-6 h-6 rounded flex items-center justify-center transition-all shrink-0', p.collapseBtn)}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Modo toggle ───────────────────────────────── */}
      <div className={cn('px-3 pt-3 pb-1', collapsed && 'flex justify-center')}>
        <button
          onClick={() => setMode(isProforma ? 'normal' : 'proforma')}
          title={isProforma ? 'Modo Proforma activo — clic para cambiar a Fiscal' : 'Modo Fiscal activo — clic para cambiar a Proforma'}
          className={cn(
            'transition-all duration-200 font-medium rounded-full',
            p.toggleBtn,
            collapsed
              ? 'w-8 h-8 flex items-center justify-center text-xs'
              : 'w-full px-3 py-1.5 text-xs flex items-center gap-2',
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', isProforma ? 'bg-amber-400' : 'bg-emerald-500')} />
          {!collapsed && (isProforma ? 'Proforma' : 'Fiscal')}
        </button>
      </div>

      {/* ── Navigation ────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        {navigation.map((section) => {
          const visibleItems = section.items.filter((item) => can(item.module))
          if (visibleItems.length === 0) return null
          return (
            <div key={section.title} className="mb-1">
              {!collapsed && (
                <p className={cn('px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest', p.sectionLabel)}>
                  {section.title}
                </p>
              )}
              {collapsed && <div className={cn('mx-3 my-1.5 h-px', p.divider)} />}

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
                      isActive ? p.navActive : p.navInactive,
                    )}
                  >
                    <item.icon
                      className={cn(
                        'shrink-0 transition-colors',
                        collapsed ? 'w-4.5 h-4.5' : 'w-4 h-4',
                        isActive ? p.iconActive : p.iconInact,
                      )}
                    />
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    )}
                    {!collapsed && isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.dot, opacity: 0.5 }} />
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* ── User footer ───────────────────────────────── */}
      <div className={cn('shrink-0 border-t p-3', p.footBorder)}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white"
              style={{ backgroundColor: isProforma ? '#92400e' : '#293c4f' }}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-medium truncate', p.userName)}>{user?.name ?? 'Usuario'}</p>
              <p className={cn('text-xs truncate', p.userRole)}>
                {user?.role === 'ADMIN' ? 'Administrador' : 'Contabilidad'}
              </p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className={cn('w-7 h-7 flex items-center justify-center rounded-lg transition-all shrink-0', p.logoutBtn)}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ backgroundColor: isProforma ? '#92400e' : '#293c4f' }}>
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className={cn('w-7 h-7 flex items-center justify-center rounded-lg transition-all', p.logoutBtn)}
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
          className={cn(
            'absolute -right-3 top-20 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center transition-all z-50',
            p.expandBtn,
          )}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  )
}

