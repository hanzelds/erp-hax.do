'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle, Info, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ConfirmOptions {
  title:          string
  message?:       string
  confirmLabel?:  string
  cancelLabel?:   string
  variant?:       'danger' | 'warning' | 'info'
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

// ─── Context ──────────────────────────────────────────────────────────────────
const ConfirmCtx = createContext<ConfirmFn>(() => Promise.resolve(false))

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null)
  const resolveRef        = useRef<(v: boolean) => void>(() => {})

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setState({ ...opts, open: true })
    })
  }, [])

  function answer(v: boolean) {
    setState(null)
    resolveRef.current(v)
  }

  const VARIANT_STYLES = {
    danger:  { icon: <Trash2 className="w-5 h-5 text-red-500" />,    btn: 'bg-red-600 hover:bg-red-700 text-white', ring: 'bg-red-50'    },
    warning: { icon: <AlertTriangle className="w-5 h-5 text-amber-500" />, btn: 'bg-amber-500 hover:bg-amber-600 text-white', ring: 'bg-amber-50' },
    info:    { icon: <Info className="w-5 h-5 text-blue-500" />,      btn: 'bg-[#293c4f] hover:opacity-90 text-white',    ring: 'bg-blue-50'   },
  }

  const v = state?.variant ?? 'info'
  const vs = VARIANT_STYLES[v]

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}

      {state?.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            {/* Icon header */}
            <div className={cn('flex justify-center pt-7 pb-3', vs.ring)}>
              <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
                {vs.icon}
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 text-center">
              <p className="text-base font-bold text-gray-900">{state.title}</p>
              {state.message && (
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{state.message}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={() => answer(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {state.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => answer(true)}
                className={cn('flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all', vs.btn)}
              >
                {state.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useConfirm() {
  return useContext(ConfirmCtx)
}
