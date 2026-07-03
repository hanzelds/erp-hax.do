'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, CreditCard, CheckCircle2, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn, openPdf } from '@/lib/utils'
import { Button, Card, Skeleton } from '@/components/ui'

type POStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED'

interface PODetail {
  id: string
  number: string
  status: POStatus
  businessUnit: 'HAX' | 'KODER' | 'ALDIA'
  supplier: { id: string; name: string; rnc?: string | null; email?: string | null; phone?: string | null } | null
  subtotal: number
  taxAmount: number
  total: number
  notes: string | null
  isCredit: boolean
  paymentTerms: number | null
  dueDate: string | null
  expenseId: string | null
  createdAt: string
  sentAt: string | null
  confirmedAt: string | null
  receivedAt: string | null
  cancelledAt: string | null
  items: { id: string; description: string; quantity: number; unitPrice: number; taxAmount: number; total: number }[]
  expense?: { id: string; status: string; paidAt: string | null; total: number } | null
}

interface BankAccount { id: string; name: string; balance: number }

const STATUS_LABELS: Record<POStatus, string> = {
  DRAFT: 'Borrador', SENT: 'Enviada', CONFIRMED: 'Confirmada', RECEIVED: 'Recibida', CANCELLED: 'Cancelada',
}
const STATUS_COLORS: Record<POStatus, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SENT:      'bg-blue-50 text-blue-700',
  CONFIRMED: 'bg-yellow-50 text-yellow-700',
  RECEIVED:  'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-600',
}
const NEXT_LABEL: Partial<Record<POStatus, string>> = {
  DRAFT: 'Enviar a proveedor', SENT: 'Confirmar recepción', CONFIRMED: 'Marcar como recibida',
}

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

function DueBadge({ dueDate }: { dueDate: string | null }) {
  const days = daysUntil(dueDate)
  if (days === null) return null
  if (days < 0)   return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Vencida hace {Math.abs(days)}d</span>
  if (days <= 15) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Vence en {days}d</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Vence en {days}d</span>
}

function PaymentModal({ po, onClose, onPaid }: { po: PODetail; onClose: () => void; onPaid: () => void }) {
  const [bankAccountId, setBankId] = useState('')
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts-po', po.businessUnit],
    queryFn: async () => {
      const { data } = await api.get('/bank-accounts', { params: { businessUnit: po.businessUnit } })
      return data.data ?? data
    },
  })

  const payMut = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${po.id}/pay`, { bankAccountId: bankAccountId || undefined, reference: reference || undefined }),
    onSuccess: () => { onPaid(); onClose() },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Error al registrar pago'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="border-b border-gray-100 px-6 py-4">
          <p className="font-semibold text-gray-900">Registrar pago</p>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">OC {po.number}</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(po.total)}</p>
            <DueBadge dueDate={po.dueDate} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Cuenta bancaria</label>
            <select value={bankAccountId} onChange={e => setBankId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15">
              <option value="">Primera cuenta activa (por defecto)</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Referencia (opcional)</label>
            <input value={reference} onChange={e => setReference(e.target.value)}
              placeholder="No. de transferencia, cheque, etc."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15" />
          </div>
        </div>
        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" loading={payMut.isPending} onClick={() => payMut.mutate()}>Confirmar pago</Button>
        </div>
      </div>
    </div>
  )
}

export default function PurchaseOrderDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const qc       = useQueryClient()
  const [showPayment, setShowPayment] = useState(false)
  const [pdfLoading, setPdfLoading]  = useState(false)

  const { data: po, isLoading } = useQuery<PODetail>({
    queryKey: ['purchase-order', id],
    queryFn: async () => {
      const { data } = await api.get(`/purchase-orders/${id}`)
      return data.data ?? data
    },
  })

  const advance = useMutation({
    mutationFn: () => api.patch(`/purchase-orders/${id}/advance`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-order', id] }),
  })

  const cancelMut = useMutation({
    mutationFn: () => api.patch(`/purchase-orders/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-order', id] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })

  async function handlePdf() {
    if (!po) return
    setPdfLoading(true)
    try { await openPdf(`/purchase-orders/${id}/pdf`, `oc-${po.number}.pdf`) }
    catch (e: any) { alert(e.message ?? 'Error al generar PDF') }
    finally { setPdfLoading(false) }
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!po) return <p className="text-gray-500 text-sm">Orden no encontrada.</p>

  const isPaid = po.expense?.status === 'PAID'

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/purchase-orders')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Órdenes de Compra</span>
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-sm font-semibold text-gray-800 font-mono">{po.number}</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" loading={pdfLoading}
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={handlePdf}>
            Descargar PDF
          </Button>
          {NEXT_LABEL[po.status] && (
            <Button variant="primary" size="sm" loading={advance.isPending}
              onClick={() => advance.mutate()}>
              {NEXT_LABEL[po.status]}
            </Button>
          )}
          {(po.status === 'DRAFT' || po.status === 'SENT') && (
            <Button variant="danger" size="sm" loading={cancelMut.isPending}
              onClick={() => cancelMut.mutate()}>
              Cancelar OC
            </Button>
          )}
        </div>
      </div>

      {/* Status + type */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', STATUS_COLORS[po.status])}>
          {STATUS_LABELS[po.status]}
        </span>
        {po.isCredit ? (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
            Crédito {po.paymentTerms}d
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Contado</span>
        )}
        <span className="px-2 py-0.5 rounded text-xs font-medium" style={po.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
          {po.businessUnit}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Supplier */}
          <Card>
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Proveedor</h2>
            </div>
            <div className="px-6 py-4">
              <p className="font-semibold text-gray-900 text-base">{po.supplier?.name ?? '—'}</p>
              {po.supplier?.rnc   && <p className="text-sm text-gray-500 mt-0.5">RNC {po.supplier.rnc}</p>}
              {po.supplier?.email && <p className="text-sm text-gray-500">{po.supplier.email}</p>}
              {po.supplier?.phone && <p className="text-sm text-gray-500">{po.supplier.phone}</p>}
            </div>
          </Card>

          {/* Items */}
          <Card>
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Ítems</h2>
            </div>
            <div className="px-6 py-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Descripción', 'Cant.', 'Precio Unit.', 'ITBIS', 'Total'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 pb-2.5 pr-4 last:pr-0 last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {po.items.map(item => (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-4 text-gray-800">{item.description}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{item.quantity}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{formatCurrency(item.taxAmount)}</td>
                      <td className="py-2.5 text-right font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span><span>{formatCurrency(po.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>ITBIS (18%)</span><span>{formatCurrency(po.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-gray-900 pt-2 border-t border-gray-100">
                  <span>Total</span><span>{formatCurrency(po.total)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {po.notes && (
            <Card>
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">Notas</h2>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-gray-600">{po.notes}</p>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">

          {/* Dates */}
          <Card>
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Fechas</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <p className="text-xs text-gray-400">Creada</p>
                <p className="text-sm font-medium text-gray-800">{formatDate(po.createdAt)}</p>
              </div>
              {po.sentAt && (
                <div>
                  <p className="text-xs text-gray-400">Enviada</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(po.sentAt)}</p>
                </div>
              )}
              {po.confirmedAt && (
                <div>
                  <p className="text-xs text-gray-400">Confirmada</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(po.confirmedAt)}</p>
                </div>
              )}
              {po.receivedAt && (
                <div>
                  <p className="text-xs text-gray-400">Recibida</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(po.receivedAt)}</p>
                </div>
              )}
              {po.cancelledAt && (
                <div>
                  <p className="text-xs text-gray-400">Cancelada</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(po.cancelledAt)}</p>
                </div>
              )}
            </div>
          </Card>

          {/* CxP panel — only for credit POs that have been received */}
          {po.isCredit && po.status === 'RECEIVED' && (
            <Card>
              <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-700">Cuenta por Pagar</h2>
              </div>
              <div className={cn('px-6 py-4', isPaid ? 'bg-green-50/50' : 'bg-amber-50/50')}>
                <p className="text-xl font-bold text-gray-900 mb-1">{formatCurrency(po.total)}</p>
                {isPaid ? (
                  <div className="flex items-center gap-1.5 text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Pagada</span>
                    {po.expense?.paidAt && <span className="text-xs text-green-600">{formatDate(po.expense.paidAt)}</span>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {po.dueDate && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Fecha de vencimiento</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-800">{formatDate(po.dueDate)}</p>
                          <DueBadge dueDate={po.dueDate} />
                        </div>
                      </div>
                    )}
                    <Button variant="primary" size="sm" className="w-full"
                      onClick={() => setShowPayment(true)}>
                      Registrar pago
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Actions card for non-credit received */}
          {po.status !== 'CANCELLED' && po.status !== 'RECEIVED' && (
            <Card>
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">Acciones</h2>
              </div>
              <div className="px-6 py-4 space-y-2">
                {NEXT_LABEL[po.status] && (
                  <Button variant="primary" size="sm" loading={advance.isPending}
                    className="w-full" onClick={() => advance.mutate()}>
                    {NEXT_LABEL[po.status]}
                  </Button>
                )}
                {(po.status === 'DRAFT' || po.status === 'SENT') && (
                  <Button variant="danger" size="sm" loading={cancelMut.isPending}
                    className="w-full" onClick={() => cancelMut.mutate()}>
                    <XCircle className="w-3.5 h-3.5 mr-1.5" /> Cancelar OC
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {showPayment && (
        <PaymentModal po={po} onClose={() => setShowPayment(false)}
          onPaid={() => qc.invalidateQueries({ queryKey: ['purchase-order', id] })} />
      )}
    </div>
  )
}
