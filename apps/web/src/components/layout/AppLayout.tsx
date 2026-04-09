'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar }  from './Topbar'
import { useAuthStore } from '@/lib/auth-store'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [collapsed, setCollapsed]   = useState(false)
  const [mounted, setMounted]       = useState(false)
  const { isAuthenticated }         = useAuthStore()
  const router                      = useRouter()

  // Restore sidebar state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('hax_sidebar_collapsed')
    if (saved === 'true') setCollapsed(true)
    setMounted(true)
  }, [])

  // Persist sidebar state
  const handleToggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('hax_sidebar_collapsed', String(next))
  }

  // Redirect if not authenticated
  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace('/auth/login')
    }
  }, [mounted, isAuthenticated, router])

  if (!mounted || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#293c4f' }}
          >
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{
                  backgroundColor: '#293c4f',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar collapsed={collapsed} onToggle={handleToggle} />

      {/* Main area */}
      <div
        className={cn(
          'flex flex-col min-h-screen transition-all duration-300 ease-in-out',
          collapsed ? 'ml-16' : 'ml-60'
        )}
      >
        {/* Topbar */}
        <Topbar sidebarCollapsed={collapsed} />

        {/* Page content */}
        <main className="flex-1 mt-16 p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-3 border-t border-gray-100 bg-white">
          <p className="text-xs text-gray-400 text-center">
            ERP Hax V1 · HAX ESTUDIO CREATIVO EIRL · RNC 133290251
          </p>
        </footer>
      </div>
    </div>
  )
}
