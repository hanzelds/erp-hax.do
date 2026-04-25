'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      router.replace('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Credenciales incorrectas')
    }
  }

  return (
    <div className="min-h-screen flex bg-[#0d1117]">

      {/* ── Left — decorative panel ───────────────────── */}
      <div className="hidden lg:flex flex-col w-[52%] relative overflow-hidden">

        {/* Background gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a2533] via-[#0d1117] to-[#0d1117]" />
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#293c4f]/40 rounded-full blur-[120px] -translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#1e3a5f]/30 rounded-full blur-[100px] translate-x-1/4 translate-y-1/4" />

        {/* Grid lines overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-14 justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-sm">
              <HaxIcon />
            </div>
            <div>
              <p className="text-white font-semibold tracking-tight">ERP Hax</p>
              <p className="text-white/30 text-xs">Sistema de gestión</p>
            </div>
          </div>

          {/* Main content */}
          <div className="space-y-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                República Dominicana · DGII Certificado
              </div>
              <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
                Control total<br />
                <span className="text-white/40">de tu negocio.</span>
              </h1>
              <p className="text-white/40 text-base leading-relaxed max-w-xs">
                Facturación electrónica, contabilidad y nómina integrados en una sola plataforma.
              </p>
            </div>

            {/* Feature list */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Facturación e‑CF', sub: 'Tipos B01–B16' },
                { label: 'Reportes DGII', sub: '606 · 607 · P&L' },
                { label: 'Contabilidad', sub: 'Asientos automáticos' },
                { label: 'Nómina', sub: 'TSS · AFP · SFS' },
              ].map((f) => (
                <div key={f.label}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors">
                  <p className="text-white/80 text-sm font-medium">{f.label}</p>
                  <p className="text-white/30 text-xs mt-0.5">{f.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/25 text-xs font-medium tracking-wide uppercase">HAX Estudio Creativo</p>
              <p className="text-white/15 text-xs mt-0.5">RNC 133290251</p>
            </div>
            <p className="text-white/15 text-xs">© 2026</p>
          </div>
        </div>
      </div>

      {/* ── Right — form panel ────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 relative">

        {/* Subtle top accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
              <HaxIcon />
            </div>
            <span className="font-semibold text-white tracking-tight">ERP Hax</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Bienvenido</h2>
            <p className="text-white/35 text-sm mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@hax.com.do"
                required
                autoComplete="email"
                className={cn(
                  'w-full px-4 py-3 rounded-xl text-sm text-white',
                  'bg-white/[0.05] border border-white/[0.08]',
                  'placeholder:text-white/20 outline-none',
                  'transition-all duration-150',
                  'focus:bg-white/[0.08] focus:border-white/20 focus:ring-0',
                )}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  autoComplete="current-password"
                  className={cn(
                    'w-full px-4 py-3 pr-11 rounded-xl text-sm text-white',
                    'bg-white/[0.05] border border-white/[0.08]',
                    'placeholder:text-white/20 outline-none',
                    'transition-all duration-150',
                    'focus:bg-white/[0.08] focus:border-white/20 focus:ring-0',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full mt-2 py-3 rounded-xl text-sm font-semibold',
                'flex items-center justify-center gap-2',
                'bg-white text-[#0d1117] transition-all duration-150',
                isLoading
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-white/90 active:scale-[0.99]',
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ingresando…
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-xs text-white/20 mt-8">
            ¿Problemas de acceso?{' '}
            <a href="mailto:hanzel@hax.com.do"
              className="text-white/40 hover:text-white/60 transition-colors underline underline-offset-2">
              hanzel@hax.com.do
            </a>
          </p>

          {/* Koder footer */}
          <p className="text-center text-xs text-white/15 mt-6">
            Diseñado con mucho amor y código por{' '}
            <a href="https://koder.com.do" target="_blank" rel="noopener noreferrer"
              className="text-white/30 hover:text-white/60 transition-colors font-medium">
              Koder
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

function HaxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5z" fill="white" fillOpacity="0.8" rx="1" />
    </svg>
  )
}
