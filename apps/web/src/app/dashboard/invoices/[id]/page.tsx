'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, DollarSign, X, XCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button, Card, CardHeader, InvoiceStatusBadge, Skeleton } from '@/components/ui'

interface InvoiceDetail {
  id: string
  number: string
  sequence: number
  businessUnit: 'HAX' | 'KODER'
  status: string
  ncf: string | null
  issueDate: string
  dueDate: string | null
  client: { id: string; name: string; rnc: string | null; email: string | null }
  items: { id: string; description: string; quantity: number; unitPrice: number; taxRate: number; subtotal: number; taxAmount: number; total: number }[]
  subtotal: number
  taxAmount: number
  total: number
  amountPaid: number
  amountDue: number
  notes: string | null
  payments: { id: string; amount: number; method: string; reference: string | null; paidAt: string }[]
  createdAt: string
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const qc      = useQueryClient()

  const [payModal, setPayModal] = useState(false)
  const [payForm, setPayForm]   = useState({ amount: 0, method: 'TRANSFER', reference: '' })

  const { data: invoice, isLoading } = useQuery<InvoiceDetail>({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data } = await api.get(`/invoices/${id}`)
      return data
    },
    refetchInterval: (q) => {
      const inv = q.state.data as InvoiceDetail | undefined
      return inv?.status === 'SENDING' ? 5000 : false
    },
  })

  const addPayment = useMutation({
    mutationFn: async (body: typeof payForm) => {
      await api.post(`/invoices/${id}/payments`, body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); setPayModal(false) },
  })

  const cancel = useMutation({
    mutationFn: async () => api.post(`/invoices/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice', id] }),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!invoice) return <p className="text-gray-500 text-sm">Factura no encontrada.</p>

  const canCancel = invoice.status !== 'PAID' && invoice.status !== 'CANCELLED'
  const canPay    = invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && invoice.amountDue > 0

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/invoices">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Facturas
          </Button>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-600 text-sm font-mono">{invoice.number}</span>
        <InvoiceStatusBadge status={invoice.status} />
        {invoice.status === 'SENDING' && (
          <span className="flex items-center gap-1.5 text-xs text-yellow-600">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Procesando e-CF…
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="xl:col-span-2 space-y-4">
          {/* Header card */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-mono text-lg font-bold text-gray-900">{invoice.number}</p>
                {invoice.ncf && <p className="font-mono text-sm text-gray-500">NCF: {invoice.ncf}</p>}
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-medium" style={invoice.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                {invoice.businessUnit}
              </span>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-gray-400">Cliente</p><p className="font-medium text-gray-800">{invoice.client.name}</p>{invoice.client.rnc && <p className="text-xs text-gray-400">{invoice.client.rnc}</p>}</div>
              <div><p className="text-xs text-gray-400">Fecha emisión</p><p className="text-gray-700">{formatDate(invoice.issueDate)}</p></div>
              <div><p className="text-xs text-gray-400">Vencimiento</p><p className="text-gray-700">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</p></div>
              <div><p className="text-xs text-gray-400">Creada</p><p className="text-gray-700">{formatDate(invoice.createdAt)}</p></div>
            </div>
          </Card>

          {/* Items */}
          <Card padding="sm">
            <div className="px-1 pt-1 pb-3"><h3 className="font-semibold text-gray-900 text-sm">Ítems</h3></div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Descripción', 'Cant.', 'Precio unit.', 'ITBIS', 'Total'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="px-3 py-2.5 text-xs text-gray-700">{item.description}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">{formatCurrency(item.taxAmount)}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 mt-2 pt-3 px-3 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
              <div className="flex justify-between text-xs text-gray-500"><span>ITBIS</span><span>{formatCurrency(invoice.taxAmount)}</span></div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100"><span>Total</span><span>{formatCurrency(invoice.total)}</span></div>
            </div>
          </Card>

          {/* Payment history */}
          {invoice.payments.length > 0 && (
            <Card padding="sm">
              <div className="px-1 pt-1 pb-3"><h3 className="font-semibold text-gray-900 text-sm">Historial de cobros</h3></div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Fecha', 'Método', 'Referencia', 'Monto'].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50">
                      <td className="px-3 py-2.5 text-xs text-gray-500">{formatDate(p.paidAt)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{p.method}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{p.reference ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Amounts */}
          <Card>
            <CardHeader title="Resumen de cobro" />
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Total factura</span><span className="font-semibold text-gray-900">{formatCurrency(invoice.total)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Cobrado</span><span className="font-semibold text-green-600">{formatCurrency(invoice.amountPaid)}</span></div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2"><span className="font-medium text-gray-800">Por cobrar</span><span className={cn('font-bold text-base', invoice.amountDue > 0 ? 'text-amber-500' : 'text-green-600')}>{formatCurrency(invoice.amountDue)}</span></div>
            </div>
            <div className="mt-4 space-y-2">
              {canPay && (
                <Button variant="primary" size="sm" className="w-full" icon={<DollarSign className="w-3.5 h-3.5" />} onClick={() => { setPayForm({ amount: invoice.amountDue, method: 'TRANSFER', reference: '' }); setPayModal(true) }}>
                  Registrar cobro
                </Button>
              )}
              {canCancel && (
                <Button variant="danger" size="sm" className="w-full" icon={<XCircle className="w-3.5 h-3.5" />} loading={cancel.isPending} onClick={() => cancel.mutate()}>
                  Cancelar factura
                </Button>
              )}
            </div>
          </Card>

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <CardHeader title="Notas" />
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">Registrar cobro</h2>
              <button onClick={() => setPayModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <F label="Monto a cobrar (DOP)">
                <input type="number" min="0.01" max={invoice.amountDue} step="0.01"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || 0 })}
                  className={ic} />
              </F>
              <F label="Método de pago">
                <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} className={ic}>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="CASH">Efectivo</option>
                  <option value="CHECK">Cheque</option>
                  <option value="CARD">Tarjeta</option>
                </select>
              </F>
              <F label="Referencia">
                <input type="text" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} className={ic} placeholder="Número de transacción…" />
              </F>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setPayModal(false)}>Cancelar</Button>
              <Button variant="primary" size="sm" loading={addPayment.isPending} onClick={() => addPayment.mutate(payForm)}>
                Confirmar cobro
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f]'
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}
