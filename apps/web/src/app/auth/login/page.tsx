'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, ArrowRight, BarChart3, FileText, Check } from 'lucide-react'
import { useAuthStore, type ErpMode } from '@/lib/auth-store'
import { cn } from '@/lib/utils'
import { HaxLogo } from '@/components/ui/HaxLogo'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading, setMode } = useAuthStore()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  // 'credentials' = paso 1 | 'mode' = paso 2 selección de modo
  const [step, setStep]         = useState<'credentials' | 'mode'>('credentials')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      // Mostrar selector de modo antes de entrar al dashboard
      setStep('mode')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Credenciales incorrectas')
    }
  }

  function handleModeSelect(mode: ErpMode) {
    setMode(mode)
    router.replace('/dashboard')
  }

  // ── Paso 2: Selección de modo ────────────────────────────────
  if (step === 'mode') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117] p-6">
        {/* Background mesh */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#293c4f]/30 rounded-full blur-[120px] -translate-x-1/3 -translate-y-1/3" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#1e3a5f]/20 rounded-full blur-[100px] translate-x-1/4 translate-y-1/4" />
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }}
          />
        </div>

        <div className="relative z-10 w-full max-w-xl">
          <div className="text-center mb-10">
            <HaxLogo color="white" className="h-8 w-auto opacity-90 mx-auto mb-8" />
            <h2 className="text-2xl font-bold text-white tracking-tight">¿Cómo vas a trabajar hoy?</h2>
            <p className="text-white/40 text-sm mt-2">Elige el modo de operación. Puedes cambiarlo después desde la barra lateral.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* ERP Fiscal */}
            <button
              onClick={() => handleModeSelect('normal')}
              className={cn(
                'group relative text-left p-6 rounded-2xl border transition-all duration-200',
                'bg-white/[0.04] border-white/[0.08]',
                'hover:bg-white/[0.08] hover:border-white/[0.18] hover:scale-[1.02]',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500/50',
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-white font-semibold text-base mb-1">ERP Fiscal</h3>
              <p className="text-white/40 text-xs leading-relaxed mb-4">Operación completa con DGII, NCF y asientos contables automáticos.</p>
              <ul className="space-y-1.5">
                {['NCF + e-CF DGII', 'Asientos automáticos', 'Reportes 606 / 607', 'Conciliación bancaria'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-400 text-[11px] font-medium">Modo activo</span>
              </div>
            </button>

            {/* ERP Proforma */}
            <button
              onClick={() => handleModeSelect('proforma')}
              className={cn(
                'group relative text-left p-6 rounded-2xl border transition-all duration-200',
                'bg-white/[0.04] border-white/[0.08]',
                'hover:bg-amber-500/[0.08] hover:border-amber-500/[0.25] hover:scale-[1.02]',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center mb-4">
                <FileText className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-white font-semibold text-base mb-1">ERP Proforma</h3>
              <p className="text-white/40 text-xs leading-relaxed mb-4">Documentos internos sin validez fiscal, para estimados y presupuestos.</p>
              <ul className="space-y-1.5">
                {['Sin NCF ni DGII', 'Sin asientos contables', 'Sin ITBIS automático', 'Cuenta banco separada'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                    <Check className="w-3 h-3 text-amber-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-amber-400 text-[11px] font-medium">Dark mode</span>
              </div>
            </button>
          </div>

          <p className="text-center text-white/20 text-xs mt-8">
            Sesión iniciada como <span className="text-white/40 font-medium">{email}</span>
          </p>
        </div>
      </div>
    )
  }

  // ── Paso 1: Credenciales ─────────────────────────────────────
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
          <div>
            <HaxLogo color="white" className="h-8 w-auto opacity-90" />
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
          <div className="mb-10 lg:hidden">
            <HaxLogo color="white" className="h-7 w-auto opacity-90" />
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

