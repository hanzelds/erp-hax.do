'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, DollarSign, X, XCircle, Send, RefreshCw, FileText, Copy } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn, openPdf } from '@/lib/utils'
import { Button, Card, CardHeader, InvoiceStatusBadge, Skeleton } from '@/components/ui'
import { EmissionModal } from '@/components/invoices/EmissionModal'
import { useAuthStore } from '@/lib/auth-store'

interface InvoiceDetail {
  id: string
  number: string
  businessUnit: 'HAX' | 'KODER'
  type: string
  status: string
  paymentStatus: string
  ncf: string | null
  xml: string | null
  alanubeId: string | null
  alanubeStatus: string | null
  rejectionReason: string | null
  retryCount: number
  sentAt: string | null
  issueDate: string
  dueDate: string | null
  paymentTerms: string | null
  approvedAt: string | null
  rejectedAt: string | null
  paidAt: string | null
  cancelledAt: string | null
  client: { id: string; name: string; rnc: string | null; email: string | null }
  originalInvoiceId: string | null
  creditNotes: { id: string; number: string; total: number; status: string }[]
  items: { id: string; description: string; quantity: number; unitPrice: number; taxRate: number; subtotal: number; taxAmount: number; total: number }[]
  subtotal: number
  taxAmount: number
  total: number
  amountPaid: number
  amountDue: number
  notes: string | null
  payments: { id: string; amount: number; method: string; reference: string | null; paidAt: string }[]
  alanubeRequests: { id: string; attempt: number; status: string | null; errorMessage: string | null; sentAt: string }[]
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  CREDITO_FISCAL:   'Crédito Fiscal',
  CONSUMO:          'Consumidor Final',
  NOTA_DEBITO:      'Nota de Débito',
  NOTA_CREDITO:     'Nota de Crédito',
  REGIMEN_ESPECIAL: 'Régimen Especial (B14)',
  PROFORMA:         'Proforma',
}

const METHOD_LABELS: Record<string, string> = {
  TRANSFER: 'Transferencia',
  CASH:     'Efectivo',
  CHECK:    'Cheque',
  CARD:     'Tarjeta',
}

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  CONTADO:    'Contado (pago inmediato)',
  NET_7:      'Net 7 — 7 días',
  NET_15:     'Net 15 — 15 días',
  NET_30:     'Net 30 — 30 días',
  NET_45:     'Net 45 — 45 días',
  NET_60:     'Net 60 — 60 días',
  NET_90:     'Net 90 — 90 días',
  ANTICIPADO: 'Pago anticipado',
  PARCIAL:    'Pago parcial acordado',
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router   = useRouter()
  const qc       = useQueryClient()
  const user     = useAuthStore((s) => s.user)
  const isAdmin  = user?.role === 'ADMIN'

  const [payModal, setPayModal]         = useState(false)
  const [emitModal, setEmitModal]       = useState(false)
  const [convertModal, setConvertModal] = useState(false)
  const [convertNcf, setConvertNcf]     = useState('E31')
  const [payForm, setPayForm]           = useState({ amount: 0, method: 'TRANSFER', reference: '' })

  const { data: invoice, isLoading } = useQuery<InvoiceDetail>({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data } = await api.get(`/invoices/${id}`)
      return data.data ?? data
    },
    refetchInterval: (q) => {
      const s = (q.state.data as InvoiceDetail | undefined)?.status
      return (s === 'SENDING' || s === 'IN_PROCESS') ? 4000 : false
    },
  })

  const addPayment = useMutation({
    mutationFn: async (body: typeof payForm) => api.post(`/invoices/${id}/payments`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); setPayModal(false) },
  })

  const cancel = useMutation({
    mutationFn: async () => api.patch(`/invoices/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice', id] }),
  })

  const emit = useMutation({
    mutationFn: async () => api.post(`/invoices/${id}/emit`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); setEmitModal(true) },
  })

  const regeneratePdf = useMutation({
    mutationFn: async () => api.post(`/invoices/${id}/pdf/regenerate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice', id] }),
  })

  const retry = useMutation({
    mutationFn: async () => api.post(`/invoices/${id}/retry`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); setEmitModal(true) },
  })

  const createCreditNote = useMutation({
    mutationFn: async () => api.post(`/invoices/${id}/credit-note`, {}),
    onSuccess: (res) => {
      const noteId = res.data?.data?.id ?? res.data?.id
      if (noteId) router.push(`/dashboard/invoices/${noteId}`)
      else qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  const convertProforma = useMutation({
    mutationFn: async () => api.post(`/invoices/${id}/convert-proforma`, { ncfType: convertNcf }),
    onSuccess: (res) => {
      const newId = res.data?.data?.id ?? res.data?.id
      setConvertModal(false)
      if (newId) router.push(`/dashboard/invoices/${newId}`)
      else qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-48 rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )

  if (!invoice) return <p className="text-gray-500 text-sm">Factura no encontrada.</p>

  const isProforma = invoice.type === 'PROFORMA'
  const isPending  = invoice.status === 'SENDING' || invoice.status === 'IN_PROCESS'
  const canEmit    = invoice.status === 'DRAFT' && !isProforma
  const canApproveProforma = isProforma && invoice.status === 'DRAFT'
  const canConvertProforma = isProforma && (invoice.status === 'DRAFT' || invoice.status === 'APPROVED')
  const canRetry   = invoice.status === 'REJECTED' && isAdmin && !isProforma
  const canPay     = invoice.status === 'APPROVED' && invoice.amountDue > 0 && !isProforma
  const canCancel  = invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && !isPending
  const canCreditNote = (invoice.status === 'APPROVED' || invoice.status === 'PAID') && invoice.type !== 'NOTA_CREDITO' && !isProforma

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
          <Link href="/dashboard/invoices">Facturas</Link>
        </Button>
        <span className="text-gray-300">/</span>
        <span className="text-gray-600 text-sm font-mono">{invoice.number}</span>
        <InvoiceStatusBadge status={invoice.status} />
        {isPending && (
          <span className="flex items-center gap-1.5 text-xs text-blue-600">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {invoice.status === 'SENDING' ? 'Enviando e-CF…' : 'Validando con DGII…'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Main */}
        <div className="xl:col-span-2 space-y-4">
          {/* Header */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-mono text-lg font-bold text-gray-900">{invoice.number}</p>
                  <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-50 rounded border border-gray-100">
                    {TYPE_LABELS[invoice.type] ?? invoice.type}
                  </span>
                </div>
                {invoice.ncf && (
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-sm text-[#293c4f]">NCF: {invoice.ncf}</p>
                    <button
                      onClick={() => navigator.clipboard.writeText(invoice.ncf!)}
                      className="text-gray-300 hover:text-gray-500 transition-colors"
                      title="Copiar NCF"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {invoice.rejectionReason && (
                  <p className="text-xs text-red-500 mt-1">Rechazo: {invoice.rejectionReason}</p>
                )}
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-medium shrink-0"
                style={invoice.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                {invoice.businessUnit}
              </span>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-400">Cliente</p>
                <p className="font-medium text-gray-800">{invoice.client.name}</p>
                {invoice.client.rnc && <p className="text-xs text-gray-400">{invoice.client.rnc}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400">Fecha emisión</p>
                <p className="text-gray-700">{formatDate(invoice.issueDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Condiciones de pago</p>
                <p className="text-gray-700 font-medium">{PAYMENT_TERMS_LABELS[invoice.paymentTerms ?? ''] ?? invoice.paymentTerms ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Vencimiento</p>
                <p className="text-gray-700">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Aprobada</p>
                <p className="text-gray-700">{invoice.approvedAt ? formatDate(invoice.approvedAt) : '—'}</p>
              </div>
            </div>
          </Card>

          {/* Proforma notice */}
          {isProforma && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-xs text-purple-700 flex items-start gap-2">
              <span className="text-purple-400 text-base leading-none">ℹ</span>
              <div>
                <p className="font-semibold mb-0.5">Proforma — documento no fiscal</p>
                <p className="text-purple-600">Este documento no genera NCF, no incluye ITBIS y no reporta a DGII. Para convertirlo en una factura fiscal, usa el botón <strong>Convertir a factura</strong>.</p>
              </div>
            </div>
          )}

          {/* Credit note notice */}
          {invoice.originalInvoiceId && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 text-xs text-orange-700">
              Esta es una nota de crédito.{' '}
              <Link href={`/dashboard/invoices/${invoice.originalInvoiceId}`} className="underline font-medium">
                Ver factura original →
              </Link>
            </div>
          )}

          {/* Credit notes list */}
          {invoice.creditNotes.length > 0 && (
            <Card padding="sm">
              <div className="px-1 pt-1 pb-3"><h3 className="font-semibold text-gray-900 text-sm">Notas de crédito</h3></div>
              {invoice.creditNotes.map((cn) => (
                <Link key={cn.id} href={`/dashboard/invoices/${cn.id}`} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-orange-400" />
                    <span className="font-mono text-xs text-gray-700">{cn.number}</span>
                    <InvoiceStatusBadge status={cn.status} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{formatCurrency(cn.total)}</span>
                </Link>
              ))}
            </Card>
          )}

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
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {invoice.type === 'PROFORMA'
                        ? <span className="text-purple-500 font-medium">N/A</span>
                        : invoice.type === 'REGIMEN_ESPECIAL'
                          ? <span className="text-amber-600 font-medium">Exento</span>
                          : item.taxAmount === 0
                            ? <span className="text-gray-400">Exento</span>
                            : formatCurrency(item.taxAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-gray-100 mt-2 pt-3 px-3 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>ITBIS</span>
                {invoice.type === 'PROFORMA'
                  ? <span className="text-purple-500 font-medium">No aplica</span>
                  : invoice.type === 'REGIMEN_ESPECIAL'
                    ? <span className="text-amber-600 font-medium">Exento (B14)</span>
                    : <span>{formatCurrency(invoice.taxAmount)}</span>}
              </div>
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
                      <td className="px-3 py-2.5 text-xs text-gray-600">{METHOD_LABELS[p.method] ?? p.method}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{p.reference ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Alanube trace (admin only) */}
          {isAdmin && invoice.alanubeRequests.length > 0 && (
            <Card padding="sm">
              <div className="px-1 pt-1 pb-3">
                <h3 className="font-semibold text-gray-900 text-sm">Trazabilidad Alanube</h3>
                <p className="text-xs text-gray-400">Historial de intentos de emisión e-CF</p>
              </div>
              <div className="space-y-2 px-1">
                {invoice.alanubeRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs">
                    <div>
                      <span className="font-medium text-gray-700">Intento #{r.attempt}</span>
                      {r.errorMessage && <p className="text-red-500 mt-0.5">{r.errorMessage}</p>}
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full font-medium',
                        r.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        r.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                        r.status === 'IN_PROCESS' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      )}>{r.status ?? 'PENDIENTE'}</span>
                      <p className="text-gray-400 mt-0.5">{formatDate(r.sentAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Amounts + actions */}
          <Card>
            <CardHeader title="Resumen de cobro" />
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total factura</span>
                <span className="font-semibold text-gray-900">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Cobrado</span>
                <span className="font-semibold text-green-600">{formatCurrency(invoice.amountPaid)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                <span className="font-medium text-gray-800">Por cobrar</span>
                <span className={cn('font-bold text-base', invoice.amountDue > 0 ? 'text-amber-500' : 'text-green-600')}>
                  {formatCurrency(invoice.amountDue)}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {canApproveProforma && (
                <Button
                  variant="primary" size="sm" className="w-full"
                  icon={<Send className="w-3.5 h-3.5" />}
                  loading={emit.isPending}
                  onClick={() => emit.mutate()}
                >
                  Aprobar proforma
                </Button>
              )}
              {canConvertProforma && (
                <Button
                  variant="secondary" size="sm" className="w-full"
                  icon={<FileText className="w-3.5 h-3.5" />}
                  onClick={() => setConvertModal(true)}
                >
                  Convertir a factura
                </Button>
              )}
              {canEmit && (
                <Button
                  variant="primary" size="sm" className="w-full"
                  icon={<Send className="w-3.5 h-3.5" />}
                  loading={emit.isPending}
                  onClick={() => emit.mutate()}
                >
                  Emitir e-CF
                </Button>
              )}
              {canRetry && (
                <Button
                  variant="secondary" size="sm" className="w-full"
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  loading={retry.isPending}
                  onClick={() => retry.mutate()}
                >
                  Reintentar emisión
                </Button>
              )}
              {canPay && (
                <Button
                  variant="primary" size="sm" className="w-full"
                  icon={<DollarSign className="w-3.5 h-3.5" />}
                  onClick={() => { setPayForm({ amount: invoice.amountDue, method: 'TRANSFER', reference: '' }); setPayModal(true) }}
                >
                  Registrar cobro
                </Button>
              )}
              {canCreditNote && (
                <Button
                  variant="secondary" size="sm" className="w-full"
                  icon={<FileText className="w-3.5 h-3.5" />}
                  loading={createCreditNote.isPending}
                  onClick={() => createCreditNote.mutate()}
                >
                  Crear nota de crédito
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="danger" size="sm" className="w-full"
                  icon={<XCircle className="w-3.5 h-3.5" />}
                  loading={cancel.isPending}
                  onClick={() => cancel.mutate()}
                >
                  Cancelar factura
                </Button>
              )}
            </div>
          </Card>

          {/* PDF + XML download */}
          <Card padding="sm">
            <div className="px-1 py-2 space-y-3">
              <div>
                <p className="text-xs font-semibold text-white/90">Documentos</p>
                <p className="text-xs text-white/35 mt-0.5">PDF para el cliente · XML fiscal</p>
              </div>
              {(invoice as any).pdfStatus === 'GENERATING' && (
                <span className="text-xs text-amber-400 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Generando PDF…
                </span>
              )}
              <div className="flex flex-col gap-2">
                {(invoice as any).pdfStatus === 'ERROR' && isAdmin && (
                  <Button
                    variant="secondary" size="sm" className="w-full"
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => regeneratePdf.mutate()}
                    loading={regeneratePdf.isPending}
                  >
                    Regenerar PDF
                  </Button>
                )}
                <Button
                  variant="secondary" size="sm" className="w-full"
                  icon={<FileText className="w-3.5 h-3.5" />}
                  onClick={() => openPdf(`/invoices/${invoice.id}/pdf`, `factura-${invoice.number}.pdf`)}
                >
                  Descargar PDF
                </Button>
                {invoice.xml && (
                  <Button
                    variant="secondary" size="sm" className="w-full"
                    icon={<FileText className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const blob = new Blob([invoice.xml!], { type: 'application/xml' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = `${invoice.ncf ?? invoice.number}.xml`
                      a.click(); URL.revokeObjectURL(url)
                    }}
                  >
                    Descargar XML
                  </Button>
                )}
              </div>
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
                <input type="text" value={payForm.reference}
                  onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                  className={ic} placeholder="Número de transacción…" />
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

      {/* Convert proforma modal */}
      {convertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Convertir proforma a factura</h2>
              <button onClick={() => setConvertModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Selecciona el tipo de comprobante fiscal. Se creará una nueva factura en estado DRAFT con los mismos ítems.</p>
            <F label="Tipo e-CF destino">
              <select value={convertNcf} onChange={(e) => setConvertNcf(e.target.value)} className={ic}>
                <option value="E31">31 — Crédito Fiscal</option>
                <option value="E32">32 — Consumidor Final</option>
                <option value="E33">33 — Nota de Débito</option>
                <option value="E44">44 — Régimen Especial (exento)</option>
                <option value="E45">45 — Gubernamental (exento)</option>
                <option value="E46">46 — Exportaciones (exento)</option>
                <option value="E47">47 — Pagos al Exterior (exento)</option>
              </select>
            </F>
            {convertProforma.isError && (
              <p className="text-xs text-red-600 mt-3">
                {(convertProforma.error as any)?.response?.data?.error ?? 'Error al convertir'}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="secondary" size="sm" onClick={() => setConvertModal(false)}>Cancelar</Button>
              <Button variant="primary" size="sm" loading={convertProforma.isPending} onClick={() => convertProforma.mutate()}>
                Convertir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Emission modal */}
      {emitModal && (
        <EmissionModal
          invoiceId={id}
          invoiceNumber={invoice.number}
          isAdmin={isAdmin}
          onClose={() => { setEmitModal(false); qc.invalidateQueries({ queryKey: ['invoice', id] }) }}
          onRetry={() => retry.mutate()}
        />
      )}
    </div>
  )
}

const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f]'
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}
