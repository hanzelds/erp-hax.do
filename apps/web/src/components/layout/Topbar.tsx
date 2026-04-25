'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Search, ChevronRight, CheckCircle2, AlertCircle, Info, AlertTriangle, X, ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { navigation } from '@/lib/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { cn, formatDate } from '@/lib/utils'
import api from '@/lib/api'

interface TopbarProps {
  sidebarCollapsed: boolean
}

interface Notification {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  href?: string
  createdAt: string
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

const TYPE_ICON: Record<string, React.ReactNode> = {
  error:   <AlertCircle   className="w-3.5 h-3.5 text-red-500    shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500  shrink-0 mt-0.5" />,
  info:    <Info          className="w-3.5 h-3.5 text-blue-500   shrink-0 mt-0.5" />,
  success: <CheckCircle2  className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />,
}

const TYPE_DOT: Record<string, string> = {
  error:   'bg-red-500',
  warning: 'bg-amber-500',
  info:    'bg-blue-500',
  success: 'bg-emerald-500',
}

export function Topbar({ sidebarCollapsed }: TopbarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user } = useAuthStore()
  const crumb    = getBreadcrumb(pathname)
  const today    = formatDate(new Date())

  const [open, setOpen]     = useState(false)
  const [readAt, setReadAt] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('notif_read_at') ?? '0', 10)
    }
    return 0
  })
  const panelRef = useRef<HTMLDivElement>(null)

  const { data: notifications = [], isLoading: notifLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications')
      return data.data ?? data
    },
    refetchInterval: 60_000,
  })

  const unreadCount = notifications.filter(
    (n) => new Date(n.createdAt).getTime() > readAt
  ).length

  function markAllRead() {
    const now = Date.now()
    setReadAt(now)
    if (typeof window !== 'undefined') localStorage.setItem('notif_read_at', String(now))
  }

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function handleOpen() {
    setOpen((v) => !v)
    if (!open && unreadCount > 0) markAllRead()
  }

  function handleNotifClick(n: Notification) {
    setOpen(false)
    if (n.href) router.push(n.href)
  }

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
          <span className="text-gray-300 text-sm hidden sm:block">ERP Hax</span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-200 hidden sm:block" />
          <div>
            <h1 className="text-gray-700 font-semibold text-sm leading-tight">
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
        <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 w-64 transition-all focus-within:bg-white focus-within:border-gray-200">
          <Search className="w-3.5 h-3.5 text-gray-300 shrink-0" />
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent text-sm text-gray-600 placeholder:text-gray-300 outline-none w-full"
          />
          <kbd className="hidden lg:inline text-gray-300 text-xs font-mono border border-gray-100 rounded px-1 py-0.5 shrink-0">
            ⌘K
          </kbd>
        </div>

        {/* ── Date ─────────────────────────────────────── */}
        <span className="hidden lg:block text-xs text-gray-300 shrink-0">{today}</span>

        {/* ── Notifications ────────────────────────────── */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={handleOpen}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-11 w-80 bg-white rounded-xl border border-gray-100 overflow-hidden z-50 shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Notificaciones</h3>
                <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                {notifLoading ? (
                  <div className="py-8 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-100 border-t-gray-400 animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <CheckCircle2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Sin notificaciones pendientes</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const isUnread = new Date(n.createdAt).getTime() > readAt
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={cn(
                          'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors',
                          isUnread && 'bg-blue-50/40'
                        )}
                      >
                        {TYPE_ICON[n.type]}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium text-gray-700 leading-tight">{n.title}</p>
                            {isUnread && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-1', TYPE_DOT[n.type])} />}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 leading-snug truncate">{n.message}</p>
                          <p className="text-[10px] text-gray-300 mt-1">{formatDate(n.createdAt)}</p>
                        </div>
                        {n.href && <ExternalLink className="w-3 h-3 text-gray-300 shrink-0 mt-0.5" />}
                      </button>
                    )
                  })
                )}
              </div>

              {notifications.length > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-300">{notifications.length} notificaciones</span>
                  <button onClick={markAllRead} className="text-xs text-gray-500 font-medium hover:text-gray-700 transition-colors">
                    Marcar todas como leídas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── User avatar ──────────────────────────────── */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
            style={{ backgroundColor: '#293c4f' }}>
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-gray-700 text-sm font-medium leading-tight truncate max-w-28">
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
