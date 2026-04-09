'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
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
      const msg =
        err?.response?.data?.error ??
        err?.message ??
        'Error al iniciar sesión'
      setError(msg)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f0f2f5' }}>

      {/* ── Left panel — branding ─────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-2/5 p-12"
        style={{ backgroundColor: '#293c4f' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-base leading-tight">ERP Hax</p>
            <p className="text-white/50 text-xs">Sistema de gestión</p>
          </div>
        </div>

        {/* Quote */}
        <div>
          <blockquote className="text-white/80 text-2xl font-light leading-relaxed mb-6">
            "Control total de tu negocio,<br />
            en un solo lugar."
          </blockquote>
          <div className="flex flex-col gap-2.5">
            {[
              'Facturación electrónica DGII',
              'Contabilidad automatizada',
              'Reportes 606 · 607 · P&L',
              'Nómina con TSS y AFP',
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                <span className="text-white/65 text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Company info */}
        <div className="border-t border-white/10 pt-6">
          <p className="text-white/40 text-xs">HAX ESTUDIO CREATIVO EIRL</p>
          <p className="text-white/30 text-xs">RNC: 133290251</p>
        </div>
      </div>

      {/* ── Right panel — form ────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#293c4f' }}
            >
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">ERP Hax</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Iniciar sesión
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            Accede a tu panel de control
          </p>

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3.5 mb-5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hanzel@hax.com.do"
                required
                autoComplete="email"
                className={cn(
                  'w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-900',
                  'placeholder:text-gray-400 outline-none transition-all',
                  'border-gray-200 bg-white',
                  'focus:border-[#293c4f] focus:ring-2 focus:ring-[#293c4f]/10'
                )}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className={cn(
                    'w-full px-3.5 py-2.5 pr-10 rounded-lg border text-sm text-gray-900',
                    'placeholder:text-gray-400 outline-none transition-all',
                    'border-gray-200 bg-white',
                    'focus:border-[#293c4f] focus:ring-2 focus:ring-[#293c4f]/10'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPass
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye    className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'w-full py-2.5 rounded-lg text-sm font-semibold text-white',
                'transition-all duration-150 mt-1',
                'flex items-center justify-center gap-2',
                isLoading
                  ? 'opacity-70 cursor-not-allowed'
                  : 'hover:opacity-90 active:scale-[0.99]'
              )}
              style={{ backgroundColor: '#293c4f' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            ¿Problemas de acceso? Contacta a{' '}
            <a
              href="mailto:hanzel@hax.com.do"
              className="underline hover:text-gray-600 transition-colors"
            >
              hanzel@hax.com.do
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
