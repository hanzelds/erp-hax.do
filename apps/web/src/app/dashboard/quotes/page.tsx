'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, Check, X, FileText, ArrowRight, UserPlus, ArrowLeft, Trash2, ChevronDown, Settings, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn, openPdf } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'
import NewContactPage from '@/components/NewContactPage'

type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED'

interface Client  { id: string; name: string; rnc?: string | null; phone?: string | null; email?: string | null }
interface Product { id: string; name: string; code: string | null; unitPrice: number; taxRate: number; isExempt: boolean }
interface QuoteItem { id?: string; description: string; quantity: number; unitPrice: number; taxRate: number; taxAmount: number; isExempt: boolean; sortOrder: number }
interface Quote {
  id: string; number: string; status: QuoteStatus; businessUnit: 'HAX' | 'KODER'
  subtotal: number; taxAmount: number; total: number; validUntil?: string
  notes?: string; terms?: string; createdAt: string
  client: Client; items?: QuoteItem[]; _count?: { items: number }
  invoice?: { id: string; number: string; status: string } | null
}

interface LineItem {
  productId:   string
  description: string
  code:        string
  unitPrice:   number
  discountPct: number
  taxRate:     number   // decimal: 0, 0.16, 0.18
  isExempt:    boolean
  quantity:    number
}

const EMPTY_LINE = (): LineItem => ({
  productId: '', description: '', code: '', unitPrice: 0,
  discountPct: 0, taxRate: 0.18, isExempt: false, quantity: 1,
})

function calcLine(l: LineItem) {
  const gross    = l.quantity * l.unitPrice
  const discount = gross * (l.discountPct / 100)
  const taxable  = gross - discount
  const tax      = l.isExempt ? 0 : taxable * l.taxRate
  return { gross, discount, taxable, tax, total: taxable + tax }
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

const ic  = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white'
const ica = 'w-full border-0 border-b border-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:border-[#293c4f] bg-transparent'

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>{children}</div>
}

// ─────────────────────────────────────────────────────────────
// New Quote — Full Page
// ─────────────────────────────────────────────────────────────
function NewQuotePage({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [clientId, setClientId]       = useState('')
  const [bu, setBu]                   = useState<'HAX' | 'KODER'>('HAX')
  const [issueDate, setIssueDate]     = useState(today)
  const [validUntil, setValidUntil]   = useState('')
  const [notes, setNotes]             = useState('')
  const [terms, setTerms]             = useState('')
  const [lines, setLines]             = useState<LineItem[]>([EMPTY_LINE()])
  const [showNewClient, setShowNewClient] = useState(false)
  const [err, setErr]                 = useState<string | null>(null)

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: async () => { const { data } = await api.get('/clients', { params: { limit: 200 } }); return data.data?.data ?? data.data ?? [] },
  })
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-list'],
    queryFn: async () => { const { data } = await api.get('/products', { params: { limit: 200, isActive: true } }); return data.data ?? [] },
  })
  const { data: company } = useQuery<any>({
    queryKey: ['company-settings'],
    queryFn: async () => { const { data } = await api.get('/settings/company'); return data.data ?? data },
  })

  const selectedClient = useMemo(() => clients.find(c => c.id === clientId) ?? null, [clients, clientId])

  // Line helpers
  const setLine = (i: number, patch: Partial<LineItem>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))

  const applyProduct = (i: number, p: Product) =>
    setLine(i, {
      productId:   p.id,
      description: p.name,
      code:        p.code ?? '',
      unitPrice:   p.unitPrice,
      taxRate:     p.taxRate,
      isExempt:    p.isExempt,
    })

  const addLine    = () => setLines(prev => [...prev, EMPTY_LINE()])
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))

  // Totals
  const calcs       = lines.map(calcLine)
  const subtotal    = calcs.reduce((s, c) => s + c.gross, 0)
  const totalDisc   = calcs.reduce((s, c) => s + c.discount, 0)
  const totalTax    = calcs.reduce((s, c) => s + c.tax, 0)
  const grandTotal  = calcs.reduce((s, c) => s + c.total, 0)

  const save = useMutation({
    mutationFn: async () => api.post('/quotes', {
      clientId, businessUnit: bu,
      validUntil: validUntil || undefined,
      notes: notes || undefined,
      terms: terms || undefined,
      items: lines.map((l, idx) => ({
        description: l.description,
        quantity:    l.quantity,
        unitPrice:   l.unitPrice,
        taxRate:     l.isExempt ? 0 : l.taxRate,
        isExempt:    l.isExempt,
        sortOrder:   idx,
      })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); onClose() },
    onError: (e: any) => setErr(e?.response?.data?.error ?? 'Error al guardar'),
  })

  // Early return — new client
  if (showNewClient) {
    return (
      <NewContactPage
        mode="cliente"
        onCreated={(contact) => {
          qc.invalidateQueries({ queryKey: ['clients-list'] })
          setClientId(contact.id)
          setShowNewClient(false)
        }}
        onBack={() => setShowNewClient(false)}
      />
    )
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Back */}
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      {/* ── Document card ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* ── Header: company info + quote number ── */}
        <div className="grid grid-cols-3 gap-6 px-8 py-6 border-b border-gray-100">
          {/* Logo placeholder */}
          <div className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl h-14 text-xs text-gray-300 cursor-not-allowed select-none">
            178 × 51 px
          </div>
          {/* Company info */}
          <div className="flex flex-col items-center justify-center text-center">
            <p className="font-semibold text-gray-800 text-sm">{company?.companyName ?? 'HAX ESTUDIO CREATIVO EIRL'}</p>
            <p className="text-xs text-gray-400 mt-0.5">RNC: {company?.rnc ?? '133290251'}</p>
            <p className="text-xs text-gray-400">{company?.email ?? 'info@hax.com.do'}</p>
          </div>
          {/* Quote number + BU */}
          <div className="flex flex-col items-end justify-center gap-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Numeración cotizaciones</span>
              <Settings className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium">No.</span>
              <span className="text-sm font-bold text-gray-700">—</span>
            </div>
            <div className="relative">
              <select value={bu} onChange={e => setBu(e.target.value as 'HAX' | 'KODER')}
                className="text-xs border border-gray-200 rounded-lg pl-2 pr-6 py-1 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white appearance-none">
                <option value="HAX">HAX</option>
                <option value="KODER">KODER</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            </div>
          </div>
        </div>

        {/* ── Client + Dates ── */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-3 px-8 py-5 border-b border-gray-100">
          {/* Left: client */}
          <div className="space-y-3">
            <F label="Cliente *">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select value={clientId} onChange={e => setClientId(e.target.value)}
                    className={ic + ' pr-8 appearance-none'}>
                    <option value="">Buscar...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                </div>
                <button type="button" onClick={() => setShowNewClient(true)}
                  className="shrink-0 flex items-center gap-1 text-xs text-[#293c4f] hover:underline whitespace-nowrap">
                  <UserPlus className="w-3.5 h-3.5" /> Nuevo contacto
                </button>
              </div>
            </F>
            <div className="grid grid-cols-2 gap-3">
              <F label="RNC o Cédula">
                <input readOnly value={selectedClient?.rnc ?? ''} placeholder="—"
                  className={ic + ' bg-gray-50 text-gray-500'} />
              </F>
              <F label="Teléfono">
                <input readOnly value={selectedClient?.phone ?? ''} placeholder="—"
                  className={ic + ' bg-gray-50 text-gray-500'} />
              </F>
            </div>
          </div>
          {/* Right: dates */}
          <div className="space-y-3">
            <F label="Creación *">
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={ic} />
            </F>
            <F label="Vencimiento">
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={ic} />
            </F>
          </div>
        </div>

        {/* ── Items table ── */}
        <div className="px-8 py-4 border-b border-gray-100 overflow-x-auto">
          <table className="w-full text-xs min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100">
                {['Producto / servicio', 'Referencia', 'Precio', 'Desc %', 'Impuesto', 'Descripción', 'Cantidad', 'Total', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 pb-2 px-1 last:w-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map((line, i) => {
                const { total: lineTotal } = calcLine(line)
                return (
                  <tr key={i} className="group">
                    {/* Product select */}
                    <td className="px-1 py-2 min-w-[160px]">
                      <div className="relative">
                        <select value={line.productId}
                          onChange={e => {
                            const p = products.find(pr => pr.id === e.target.value)
                            if (p) applyProduct(i, p)
                            else setLine(i, { productId: '' })
                          }}
                          className={ica + ' pr-5 appearance-none'}>
                          <option value="">Buscar producto o servicio...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300" />
                      </div>
                    </td>
                    {/* Reference */}
                    <td className="px-1 py-2 w-24">
                      <input type="text" value={line.code} placeholder="Ref."
                        onChange={e => setLine(i, { code: e.target.value })} className={ica} />
                    </td>
                    {/* Price */}
                    <td className="px-1 py-2 w-24">
                      <input type="number" min="0" step="0.01" value={line.unitPrice || ''}
                        onChange={e => setLine(i, { unitPrice: parseFloat(e.target.value) || 0 })}
                        className={ica} placeholder="0.00" />
                    </td>
                    {/* Discount % */}
                    <td className="px-1 py-2 w-16">
                      <input type="number" min="0" max="100" step="0.1" value={line.discountPct || ''}
                        onChange={e => setLine(i, { discountPct: parseFloat(e.target.value) || 0 })}
                        className={ica} placeholder="%" />
                    </td>
                    {/* Tax */}
                    <td className="px-1 py-2 w-28">
                      <div className="relative">
                        <select value={line.isExempt ? 'exempt' : String(line.taxRate)}
                          onChange={e => {
                            if (e.target.value === 'exempt') setLine(i, { isExempt: true, taxRate: 0 })
                            else setLine(i, { isExempt: false, taxRate: parseFloat(e.target.value) })
                          }}
                          className={ica + ' pr-5 appearance-none'}>
                          <option value="0.18">ITBIS 18%</option>
                          <option value="0.16">ITBIS 16%</option>
                          <option value="0">Sin ITBIS</option>
                          <option value="exempt">Exento</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-300" />
                      </div>
                    </td>
                    {/* Description */}
                    <td className="px-1 py-2 min-w-[120px]">
                      <input type="text" value={line.description} placeholder="Descripción"
                        onChange={e => setLine(i, { description: e.target.value })} className={ica} />
                    </td>
                    {/* Quantity */}
                    <td className="px-1 py-2 w-16">
                      <input type="number" min="0.01" step="0.01" value={line.quantity}
                        onChange={e => setLine(i, { quantity: parseFloat(e.target.value) || 1 })}
                        className={ica + ' text-right'} />
                    </td>
                    {/* Total */}
                    <td className="px-1 py-2 w-24 text-right">
                      <span className="text-gray-700 font-medium">RD$ {lineTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                    </td>
                    {/* Delete */}
                    <td className="px-1 py-2 w-6">
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(i)} className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <button type="button" onClick={addLine}
            className="mt-3 flex items-center gap-1.5 text-xs text-[#293c4f] hover:opacity-70 transition-opacity font-medium">
            <Plus className="w-3.5 h-3.5" /> Agregar línea
          </button>
        </div>

        {/* ── Totals + Signature ── */}
        <div className="grid grid-cols-2 gap-6 px-8 py-5 border-b border-gray-100">
          {/* Signature placeholder */}
          <div className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl h-14 text-xs text-gray-300 cursor-not-allowed select-none self-end">
            178 × 51 px
          </div>
          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
            </div>
            {totalDisc > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Descuento</span>
                <span className="text-red-500">-RD$ {totalDisc.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>ITBIS</span>
              <span>RD$ {totalTax.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2">
              <span>Total</span>
              <span>RD$ {grandTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* ── Terms + Notes ── */}
        <div className="grid grid-cols-2 gap-6 px-8 py-5 border-b border-gray-100">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Términos y condiciones</label>
              <span className="text-xs text-gray-300">{terms.length}/400</span>
            </div>
            <textarea rows={3} maxLength={400} value={terms} onChange={e => setTerms(e.target.value)}
              placeholder="Visible en la impresión del documento"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] resize-none placeholder-gray-300" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Notas</label>
              <span className="text-xs text-gray-300">{notes.length}/290</span>
            </div>
            <textarea rows={3} maxLength={290} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Visible en la impresión del documento"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] resize-none placeholder-gray-300" />
          </div>
        </div>

        {/* Required fields note */}
        <div className="px-8 py-3">
          <p className="text-xs text-gray-400">Los campos marcados con <span className="text-red-400">*</span> son obligatorios</p>
        </div>
      </div>

      {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">{err}</p>}

      {/* ── Fixed action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-3.5 flex items-center justify-end gap-3 z-40 shadow-lg">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          loading={save.isPending}
          disabled={!clientId || lines.every(l => !l.description)}
          onClick={() => { setErr(null); save.mutate() }}
        >
          Guardar
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Quotes List Page
// ─────────────────────────────────────────────────────────────
export default function QuotesPage() {
  const [status, setStatus] = useState('')
  const [bu, setBu]         = useState('')
  const [showNew, setShowNew]   = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const router = useRouter()
  const qc     = useQueryClient()

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

  const sendQ    = useMutation({ mutationFn: (id: string) => api.post(`/quotes/${id}/send`),   onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }) })
  const acceptQ  = useMutation({ mutationFn: (id: string) => api.post(`/quotes/${id}/accept`), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }) })
  const rejectQ  = useMutation({ mutationFn: (id: string) => api.post(`/quotes/${id}/reject`), onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }) })
  const convertQ = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/convert`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      const invoiceId = res.data?.data?.id ?? res.data?.id
      if (invoiceId) router.push(`/dashboard/invoices/${invoiceId}`)
    },
  })

  const quotes = data?.data ?? (Array.isArray(data) ? data : [])

  // ── Full-page new quote ───────────────────────────────────
  if (showNew) return <NewQuotePage onClose={() => setShowNew(false)} />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cotizaciones"
        subtitle="Propuestas comerciales · Conversión a facturas"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowNew(true)}>
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
          <select value={bu} onChange={e => setBu(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700">
            <option value="">Ambas BU</option>
            <option value="HAX">HAX</option>
            <option value="KODER">KODER</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700">
            <option value="">Todos los estados</option>
            {(Object.keys(STATUS_LABEL) as QuoteStatus[]).map(s => (
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
            action={<Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowNew(true)}>Nueva cotización</Button>} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Número', 'Cliente', 'BU', 'Estado', 'Total', 'Válida hasta', 'Acciones'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map(q => (
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
                          onClick={() => convertQ.mutate(q.id)}>
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

      {detailId && (
        <QuoteDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onConvert={id => { setDetailId(null); convertQ.mutate(id) }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Quote Detail Modal (unchanged)
// ─────────────────────────────────────────────────────────────
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
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <Button variant="secondary" size="sm" className="w-full" icon={<Download className="w-3.5 h-3.5" />}
              onClick={() => openPdf(`/quotes/${quote.id}/pdf`, `cotizacion-${quote.number}.pdf`)}>
              Descargar PDF
            </Button>
            {quote.status === 'ACCEPTED' && (
              <Button variant="primary" className="w-full" icon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => { onClose(); onConvert(id) }}>
                Convertir a factura
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
