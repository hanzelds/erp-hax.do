'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, Check, X, FileText, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState, Badge } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'

interface Client { id: string; name: string; rnc?: string; email?: string }
interface QuoteItem { id?: string; description: string; quantity: number; unitPrice: number; taxRate: number; taxAmount: number; isExempt: boolean; sortOrder: number }
interface Quote {
  id: string; number: string; status: QuoteStatus; businessUnit: 'HAX' | 'KODER'
  subtotal: number; taxAmount: number; total: number; validUntil?: string
  notes?: string; terms?: string; createdAt: string; sentAt?: string; acceptedAt?: string
  client: Client; items?: QuoteItem[]; _count?: { items: number }
  invoice?: { id: string; number: string; status: string } | null
}

const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: 'Borrador', SENT: 'Enviada', ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada', EXPIRED: 'Vencida', CONVERTED: 'Convertida',
}
const STATUS_COLOR: Record<QuoteStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-yellow-100 text-yellow-700', CONVERTED: 'bg-purple-100 text-purple-700',
}
const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] disabled:bg-gray-50'
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}

export default function QuotesPage() {
  const [status, setStatus] = useState('')
  const [bu, setBu] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const router = useRouter()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ data: Quote[] }>({
    queryKey: ['quotes', status, bu],
    queryFn: async () => {
      const { data } = await api.get('/quotes', { params: { status: status || undefined, businessUnit: bu || undefined, limit: 100 } })
      return data.data ?? data
    },
  })

  const { data: stats } = useQuery<any>({
    queryKey: ['quotes-stats'],
    queryFn: async () => { const { data } = await api.get('/quotes/stats'); return data.data ?? data },
  })

  const sendQ = useMutation({ mutationFn: (id: string) => api.post(`/quotes/${id}/send`), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }) })
  const acceptQ = useMutation({ mutationFn: (id: string) => api.post(`/quotes/${id}/accept`), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }) })
  const rejectQ = useMutation({ mutationFn: (id: string) => api.post(`/quotes/${id}/reject`), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }) })
  const convertQ = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/convert`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      const invoiceId = res.data?.data?.id ?? res.data?.id
      if (invoiceId) router.push(`/dashboard/invoices/${invoiceId}`)
    },
  })

  const quotes = data?.data ?? (Array.isArray(data) ? data : [])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cotizaciones"
        subtitle="Propuestas comerciales · Conversión a facturas"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>
            Nueva cotización
          </Button>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(stats.byStatus ?? []).slice(0, 4).map((s: any) => (
            <Card key={s.status}>
              <p className="text-xs text-gray-400">{STATUS_LABEL[s.status as QuoteStatus] ?? s.status}</p>
              <p className="text-xl font-bold text-[#293c4f] mt-1">{s._count}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(s._sum?.total ?? 0)}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3 px-1 py-1">
          <select value={bu} onChange={(e) => setBu(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700">
            <option value="">Ambas BU</option>
            <option value="HAX">HAX</option>
            <option value="KODER">KODER</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700">
            <option value="">Todos los estados</option>
            {(Object.keys(STATUS_LABEL) as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : quotes.length === 0 ? (
          <EmptyState icon={<FileText className="w-5 h-5" />} title="Sin cotizaciones" description="Crea la primera cotización para comenzar."
            action={<Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>Nueva cotización</Button>} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Número', 'Cliente', 'BU', 'Estado', 'Total', 'Válida hasta', 'Acciones'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-3">
                    <button onClick={() => setDetailId(q.id)} className="font-mono text-xs font-semibold text-[#293c4f] hover:underline">{q.number}</button>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-700">{q.client?.name}</td>
                  <td className="px-3 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={q.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {q.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[q.status as QuoteStatus])}>
                      {STATUS_LABEL[q.status as QuoteStatus]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs font-semibold text-[#293c4f]">{formatCurrency(q.total)}</td>
                  <td className="px-3 py-3 text-xs text-gray-400">{q.validUntil ? formatDate(q.validUntil) : '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      {q.status === 'DRAFT' && (
                        <button title="Enviar" className="p-1 text-blue-500 hover:text-blue-700" onClick={() => sendQ.mutate(q.id)}>
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(q.status === 'SENT' || q.status === 'DRAFT') && (
                        <button title="Aceptar" className="p-1 text-green-500 hover:text-green-700" onClick={() => acceptQ.mutate(q.id)}>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(q.status === 'SENT' || q.status === 'DRAFT') && (
                        <button title="Rechazar" className="p-1 text-red-400 hover:text-red-600" onClick={() => rejectQ.mutate(q.id)}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {q.status === 'ACCEPTED' && (
                        <button title="Convertir a factura" className="p-1 text-purple-500 hover:text-purple-700"
                          onClick={() => confirm(`¿Convertir cotización ${q.number} a factura?`) && convertQ.mutate(q.id)}>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {q.status === 'CONVERTED' && q.invoice && (
                        <button title="Ver factura" className="p-1 text-gray-400 hover:text-[#293c4f]"
                          onClick={() => router.push(`/dashboard/invoices/${q.invoice!.id}`)}>
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showModal && <NewQuoteModal onClose={() => setShowModal(false)} />}
      {detailId && <QuoteDetailModal id={detailId} onClose={() => setDetailId(null)} onConvert={(id) => { setDetailId(null); convertQ.mutate(id) }} />}
    </div>
  )
}

// ── New Quote Modal ───────────────────────────────────────────

function NewQuoteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [clientId, setClientId] = useState('')
  const [bu, setBu] = useState('HAX')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: 0, taxRate: 0.18, isExempt: false }])

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: async () => { const { data } = await api.get('/clients', { params: { limit: 200 } }); return data.data?.data ?? data.data ?? [] },
  })

  const addItem = () => setItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0, taxRate: 0.18, isExempt: false }])
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i))
  const setItem = (i: number, key: string, value: any) => setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [key]: value } : item))

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const tax = items.reduce((s, i) => s + (i.isExempt ? 0 : i.quantity * i.unitPrice * i.taxRate), 0)

  const save = useMutation({
    mutationFn: async () => api.post('/quotes', {
      clientId, businessUnit: bu, validUntil: validUntil || undefined,
      notes: notes || undefined, terms: terms || undefined,
      items: items.map((item, idx) => ({ ...item, sortOrder: idx })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">Nueva Cotización</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <F label="Cliente *">
              <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className={ic}>
                <option value="">Seleccionar</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </F>
            <F label="Unidad *">
              <select required value={bu} onChange={(e) => setBu(e.target.value)} className={ic}>
                <option value="HAX">HAX</option>
                <option value="KODER">KODER</option>
              </select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Válida hasta">
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={ic} />
            </F>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600">Ítems</p>
              <button type="button" onClick={addItem} className="text-xs text-[#293c4f] hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Agregar línea
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <input type="text" placeholder="Descripción" required value={item.description}
                      onChange={(e) => setItem(i, 'description', e.target.value)} className={ic} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" placeholder="Cant." min="0.01" step="0.01" required value={item.quantity}
                      onChange={(e) => setItem(i, 'quantity', parseFloat(e.target.value))} className={ic} />
                  </div>
                  <div className="col-span-3">
                    <input type="number" placeholder="Precio" min="0" step="0.01" required value={item.unitPrice}
                      onChange={(e) => setItem(i, 'unitPrice', parseFloat(e.target.value))} className={ic} />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <input type="checkbox" checked={item.isExempt} onChange={(e) => setItem(i, 'isExempt', e.target.checked)}
                      title="Exento de ITBIS" className="w-4 h-4 rounded text-[#293c4f]" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 space-y-1 text-xs text-gray-500">
              <div className="text-right space-y-1">
                <p>Subtotal: <span className="font-medium text-gray-700">{formatCurrency(subtotal)}</span></p>
                <p>ITBIS: <span className="font-medium text-gray-700">{formatCurrency(tax)}</span></p>
                <p className="text-sm font-bold text-[#293c4f]">Total: {formatCurrency(subtotal + tax)}</p>
              </div>
            </div>
          </div>

          <F label="Notas">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${ic} resize-none`} placeholder="Condiciones, observaciones..." />
          </F>
          <F label="Términos y condiciones">
            <textarea rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} className={`${ic} resize-none`} />
          </F>

          {save.isError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {(save.error as any)?.response?.data?.error ?? 'Error al guardar'}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={save.isPending} disabled={!clientId || items.some((i) => !i.description)}>
              Crear cotización
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Quote Detail Modal ────────────────────────────────────────

function QuoteDetailModal({ id, onClose, onConvert }: { id: string; onClose: () => void; onConvert: (id: string) => void }) {
  const { data: quote, isLoading } = useQuery<Quote>({
    queryKey: ['quote', id],
    queryFn: async () => { const { data } = await api.get(`/quotes/${id}`); return data.data ?? data },
  })

  if (isLoading || !quote) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{quote.number}</h2>
            <p className="text-xs text-gray-400">{quote.client?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[quote.status])}>
              {STATUS_LABEL[quote.status]}
            </span>
            <span className="text-xs text-gray-400">{formatDate(quote.createdAt)}</span>
          </div>

          {/* Items */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-1.5 text-gray-400 font-medium">Descripción</th>
                <th className="text-right py-1.5 text-gray-400 font-medium">Cant.</th>
                <th className="text-right py-1.5 text-gray-400 font-medium">Precio</th>
                <th className="text-right py-1.5 text-gray-400 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {(quote.items ?? []).map((item, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-1.5 text-gray-700">{item.description}</td>
                  <td className="py-1.5 text-right text-gray-500">{item.quantity}</td>
                  <td className="py-1.5 text-right text-gray-500">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-1.5 text-right font-medium text-gray-800">
                    {formatCurrency(item.quantity * item.unitPrice + (item.isExempt ? 0 : item.taxAmount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-right space-y-1 text-xs text-gray-500">
            <p>Subtotal: <span className="font-medium">{formatCurrency(quote.subtotal)}</span></p>
            <p>ITBIS: <span className="font-medium">{formatCurrency(quote.taxAmount)}</span></p>
            <p className="text-base font-bold text-[#293c4f]">Total: {formatCurrency(quote.total)}</p>
          </div>

          {quote.notes && <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">{quote.notes}</p>}

          {quote.status === 'ACCEPTED' && (
            <div className="pt-2">
              <Button variant="primary" className="w-full" icon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => { onClose(); onConvert(id) }}>
                Convertir a factura
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
