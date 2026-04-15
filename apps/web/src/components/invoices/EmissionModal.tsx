'use client'

/**
 * EmissionModal — 4-phase real-time e-CF emission popup
 *
 * Phase 1 (SENDING)    — "Enviando al DGII..."    spinner
 * Phase 2 (IN_PROCESS) — "Validando con DGII..."  spinner
 * Phase 3 (APPROVED)   — Success screen with NCF
 * Phase 4 (REJECTED)   — Error screen with reason + optional retry
 *
 * The modal is non-closeable while the invoice is in SENDING or IN_PROCESS state.
 */

import { useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, X, FileText, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'
import api from '@/lib/api'

type EmissionStatus = 'SENDING' | 'IN_PROCESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

interface InvoiceStatusData {
  id: string
  status: EmissionStatus
  ncf: string | null
  rejectionReason: string | null
  alanubeStatus: string | null
  alanubeRequests: { attempt: number; status: string | null; errorMessage: string | null; sentAt: string }[]
}

interface EmissionModalProps {
  invoiceId: string
  invoiceNumber: string
  onClose: () => void
  onRetry?: () => void
  isAdmin?: boolean
}

export function EmissionModal({ invoiceId, invoiceNumber, onClose, onRetry, isAdmin }: EmissionModalProps) {
  const isPending = (status: string) => status === 'SENDING' || status === 'IN_PROCESS'

  const { data, isLoading } = useQuery<InvoiceStatusData>({
    queryKey: ['invoice-emission', invoiceId],
    queryFn: async () => {
      const { data } = await api.get(`/invoices/${invoiceId}`)
      return data
    },
    // Poll every 3s while pending, stop when resolved
    refetchInterval: (q) => {
      const s = (q.state.data as InvoiceStatusData | undefined)?.status
      return s && isPending(s) ? 3000 : false
    },
    staleTime: 0,
  })

  const status = data?.status
  const resolved = status === 'APPROVED' || status === 'REJECTED' || status === 'CANCELLED'
  const canClose = resolved || (!isLoading && !status)

  // Keyboard escape only works when closeable
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && canClose) onClose()
  }, [canClose, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="font-mono text-sm text-gray-500">{invoiceNumber}</span>
          </div>
          {canClose ? (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-4 h-4" /> // spacer to keep layout balanced
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-8 text-center">
          {(isLoading || status === 'SENDING') && (
            <Phase
              icon={<Loader2 className="w-10 h-10 text-[#293c4f] animate-spin" />}
              title="Enviando al DGII"
              subtitle="Transmitiendo el e-CF a la DGII a través de Alanube…"
              color="text-[#293c4f]"
            />
          )}

          {status === 'IN_PROCESS' && (
            <Phase
              icon={<Loader2 className="w-10 h-10 text-blue-500 animate-spin" />}
              title="Validando con DGII"
              subtitle="El documento fue recibido y está siendo validado. Esto puede demorar unos minutos."
              color="text-blue-600"
            />
          )}

          {status === 'APPROVED' && (
            <Phase
              icon={<CheckCircle2 className="w-10 h-10 text-green-500" />}
              title="¡Factura aprobada!"
              subtitle={data?.ncf ? `NCF asignado: ${data.ncf}` : 'El e-CF fue aceptado por la DGII.'}
              color="text-green-600"
            />
          )}

          {(status === 'REJECTED' || status === 'CANCELLED') && (
            <Phase
              icon={<XCircle className="w-10 h-10 text-red-500" />}
              title="Factura rechazada"
              subtitle={data?.rejectionReason ?? 'La DGII rechazó el documento. Verifica los datos e intenta nuevamente.'}
              color="text-red-600"
            />
          )}
        </div>

        {/* Progress indicator */}
        {(status === 'SENDING' || status === 'IN_PROCESS') && (
          <div className="mx-5 mb-5">
            <StepBar step={status === 'SENDING' ? 1 : 2} />
          </div>
        )}

        {/* Footer actions */}
        {resolved && (
          <div className="border-t border-gray-100 px-5 py-4 flex items-center justify-end gap-2">
            {status === 'REJECTED' && isAdmin && onRetry && (
              <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => { onRetry(); onClose() }}>
                Reintentar emisión
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onClose}>
              {status === 'APPROVED' ? 'Cerrar' : 'Entendido'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Phase({ icon, title, subtitle, color }: {
  icon: React.ReactNode
  title: string
  subtitle: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {icon}
      <p className={cn('font-semibold text-base', color)}>{title}</p>
      <p className="text-gray-500 text-xs max-w-xs leading-relaxed">{subtitle}</p>
    </div>
  )
}

function StepBar({ step }: { step: 1 | 2 }) {
  const steps = ['Enviando', 'Validando', 'Resultado']
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum === step
        const isDone = stepNum < step
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium shrink-0',
              isDone ? 'bg-green-500 text-white' : isActive ? 'bg-[#293c4f] text-white' : 'bg-gray-100 text-gray-400'
            )}>
              {isDone ? '✓' : stepNum}
            </div>
            <span className={cn('text-xs ml-1', isActive ? 'text-[#293c4f] font-medium' : 'text-gray-400')}>{label}</span>
            {i < steps.length - 1 && (
              <div className={cn('h-px flex-1 mx-2', isDone ? 'bg-green-500' : 'bg-gray-100')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
