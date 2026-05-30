'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Trash2, UserPlus, Search, ChevronDown,
  Calendar, CreditCard, Banknote, Building2, FileText,
  Check, X, Zap,
} from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Button, Select, DatePicker } from '@/components/ui'
import { HaxLogo } from '@/components/ui/HaxLogo'
import NewContactPage from '@/components/NewContactPage'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Client  { id: string; name: string; rnc: string | null; phone?: string | null; email?: string | null }
interface Product { id: string; name: string; code?: string | null; unitPrice: number; taxRate: number; isExempt: boolean }
interface LineItem {
  description: string; quantity: number; unitPrice: number
  discountPct: number; taxRate: number; isExempt: boolean
}

const EMPTY_LINE = (): LineItem => ({ description: '', quantity: 1, unitPrice: 0, discountPct: 0, taxRate: 18, isExempt: false })

function calcLine(l: LineItem, forceExempt = false) {
  const exempt  = forceExempt || l.isExempt
  const gross   = l.quantity * l.unitPrice
  const disc    = gross * (l.discountPct / 100)
  const taxable = gross - disc
  const tax     = exempt ? 0 : taxable * (l.taxRate / 100)
  return { gross, disc, taxable, tax, total: taxable + tax }
}

// NCF types
const NCF_TYPES = [
  { value: 'E31',      label: '31 — Crédito Fiscal',         exempt: false, fiscal: true },
  { value: 'E32',      label: '32 — Consumo',                exempt: false, fiscal: true },
  { value: 'E33',      label: '33 — Nota de Débito',         exempt: false, fiscal: true },
  { value: 'E34',      label: '34 — Nota de Crédito',        exempt: false, fiscal: true },
  { value: 'E41',      label: '41 — Comprobante de Compras', exempt: false, fiscal: true },
  { value: 'E43',      label: '43 — Gastos Menores',         exempt: false, fiscal: true },
  { value: 'E44',      label: '44 — Régimen Especial',       exempt: true,  fiscal: true },
  { value: 'E45',      label: '45 — Gubernamental',          exempt: true,  fiscal: true },
  { value: 'E46',      label: '46 — Exportaciones',          exempt: true,  fiscal: true },
  { value: 'E47',      label: '47 — Pagos al Exterior',      exempt: true,  fiscal: true },
  { value: 'PROFORMA', label: 'Proforma',                    exempt: true,  fiscal: false },
]

const PAY_TERMS = [
  { value: 'CONTADO',    label: 'Contado', days: 0 },
  { value: 'NET_7',      label: 'Net 7',   days: 7 },
  { value: 'NET_15',     label: 'Net 15',  days: 15 },
  { value: 'NET_30',     label: 'Net 30',  days: 30 },
  { value: 'NET_45',     label: 'Net 45',  days: 45 },
  { value: 'NET_60',     label: 'Net 60',  days: 60 },
  { value: 'NET_90',     label: 'Net 90',  days: 90 },
  { value: 'ANTICIPADO', label: 'Anticipado', days: 0 },
  { value: 'PARCIAL',    label: 'Parcial pactado', days: 0 },
]

// ─── Searchable Dropdown ──────────────────────────────────────────────────────
function SearchableDropdown<T extends { id: string }>({
  items, value, onSelect, placeholder, renderItem, renderSelected, filterFn, emptyText = 'Sin resultados',
}: {
  items: T[]; value: string; onSelect: (item: T) => void
  placeholder: string; renderItem: (item: T) => React.ReactNode
  renderSelected: (item: T | undefined) => string
  filterFn: (item: T, q: string) => boolean; emptyText?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ]       = useState('')
  const ref             = useRef<HTMLDivElement>(null)
  const selected        = items.find(i => i.id === value)

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = q ? items.filter(i => filterFn(i, q.toLowerCase())) : items

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen(o => !o); setQ('') }}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-xl border transition-all',
          open ? 'border-[#293c4f] ring-2 ring-[#293c4f]/10 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'
        )}>
        <span className={cn('truncate', !selected ? 'text-gray-400' : 'text-gray-800 font-medium')}>
          {selected ? renderSelected(selected) : placeholder}
        </span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input autoFocus type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Buscar…"
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]" />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-3 py-3 text-xs text-gray-400 text-center">{emptyText}</p>
              : filtered.map(item => (
                <button key={item.id} type="button"
                  onClick={() => { onSelect(item); setOpen(false); setQ('') }}
                  className={cn('w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors', item.id === value && 'bg-[#293c4f]/5')}>
                  {renderItem(item)}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tax Selector ─────────────────────────────────────────────────────────────
function TaxSelector({ isExempt, taxRate, onChange, disabled }: {
  isExempt: boolean; taxRate: number; onChange: (v: { isExempt: boolean; taxRate: number }) => void; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const opts = [
    { label: 'ITBIS 18%', value: '0.18', isExempt: false, taxRate: 18 },
    { label: 'ITBIS 16%', value: '0.16', isExempt: false, taxRate: 16 },
    { label: 'Sin ITBIS', value: '0',    isExempt: false, taxRate: 0  },
    { label: 'Exento',    value: 'ex',   isExempt: true,  taxRate: 0  },
  ]
  const current = isExempt ? opts[3] : opts.find(o => o.taxRate === taxRate) ?? opts[0]

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (disabled) return (
    <span className="text-xs text-amber-600 font-medium whitespace-nowrap">Exento (tipo)</span>
  )

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap">
        {current.label}
        <ChevronDown className={cn('w-3 h-3 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-32">
          {opts.map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange({ isExempt: o.isExempt, taxRate: o.taxRate }); setOpen(false) }}
              className={cn('w-full text-left px-3 py-2 text-xs hover:bg-gray-50', current.value === o.value && 'text-[#293c4f] font-semibold bg-[#293c4f]/5')}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Line Row ─────────────────────────────────────────────────────────────────
function LineRow({ line, index, products, forceExempt, showDelete, onChange, onDelete, onApplyProduct }: {
  line: LineItem; index: number; products: Product[]; forceExempt: boolean
  showDelete: boolean
  onChange: (patch: Partial<LineItem>) => void
  onDelete: () => void
  onApplyProduct: (p: Product) => void
}) {
  const [showProducts, setShowProducts] = useState(false)
  const [prodSearch, setProdSearch]     = useState('')
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowProducts(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = prodSearch
    ? products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()) || (p.code ?? '').toLowerCase().includes(prodSearch.toLowerCase()))
    : products

  const { disc, tax, total } = calcLine(line, forceExempt)

  return (
    <div className="group grid grid-cols-[1fr_64px_112px_64px_96px_88px_28px] gap-2.5 items-center px-1 py-2 rounded-xl hover:bg-gray-50/80 transition-colors">

      {/* Description + product picker */}
      <div ref={dropRef} className="relative">
        <input
          type="text" value={line.description}
          placeholder="Descripción del servicio o producto…"
          onChange={e => onChange({ description: e.target.value })}
          onFocus={() => { setShowProducts(true); setProdSearch('') }}
          className="w-full text-sm text-gray-800 placeholder-gray-300 bg-transparent focus:outline-none py-1"
        />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-focus-within:bg-[#293c4f] transition-colors" />

        {showProducts && products.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[320px]">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input autoFocus type="text" value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  placeholder="Buscar producto o código…"
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
                />
              </div>
            </div>
            <div className="max-h-44 overflow-y-auto">
              {filtered.length === 0
                ? <p className="px-3 py-2.5 text-xs text-gray-400 text-center">Sin resultados</p>
                : filtered.map(p => (
                  <button key={p.id} type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { onApplyProduct(p); setShowProducts(false); setProdSearch('') }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-gray-800">{p.name}</p>
                      {p.code && <p className="text-[11px] text-gray-400">{p.code}</p>}
                    </div>
                    <span className="text-xs font-semibold text-[#293c4f] shrink-0">{formatCurrency(p.unitPrice)}</span>
                  </button>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* Quantity */}
      <input type="number" min="1" step="1" value={line.quantity}
        onChange={e => onChange({ quantity: parseInt(e.target.value) || 1 })}
        className="w-full text-sm text-center text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#293c4f] focus:ring-1 focus:ring-[#293c4f]/15 transition-colors"
      />

      {/* Unit price */}
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">RD$</span>
        <input type="number" min="0" step="0.01" value={line.unitPrice || ''} placeholder="0"
          onChange={e => onChange({ unitPrice: parseFloat(e.target.value) || 0 })}
          className="w-full text-sm text-right text-gray-700 bg-white border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 focus:outline-none focus:border-[#293c4f] focus:ring-1 focus:ring-[#293c4f]/15 transition-colors"
        />
      </div>

      {/* Discount % */}
      <div className="relative">
        <input type="number" min="0" max="100" step="1" value={line.discountPct || ''} placeholder="0"
          onChange={e => onChange({ discountPct: parseFloat(e.target.value) || 0 })}
          className="w-full text-sm text-center text-gray-700 bg-white border border-gray-200 rounded-lg px-2 pr-5 py-1.5 focus:outline-none focus:border-[#293c4f] focus:ring-1 focus:ring-[#293c4f]/15 transition-colors"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none">%</span>
      </div>

      {/* Tax */}
      <div className="flex justify-center">
        <TaxSelector
          isExempt={forceExempt || line.isExempt} taxRate={line.taxRate}
          disabled={forceExempt}
          onChange={v => onChange({ isExempt: v.isExempt, taxRate: v.taxRate })}
        />
      </div>

      {/* Total */}
      <div className="text-right">
        <p className="text-sm font-bold text-gray-800">{formatCurrency(total)}</p>
        {disc > 0 && <p className="text-[10px] text-red-400">-{formatCurrency(disc)}</p>}
        {tax > 0 && !forceExempt && <p className="text-[10px] text-gray-400">+{formatCurrency(tax)}</p>}
      </div>

      {/* Delete */}
      <div className="flex justify-center">
        {showDelete && (
          <button type="button" onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function NewInvoicePage() {
  const router = useRouter()
  const qc     = useQueryClient()

  const today = new Date().toISOString().slice(0, 10)

  const [clientId, setClientId]         = useState('')
  const [bu, setBu]                     = useState<'HAX' | 'KODER'>('HAX')
  const [issueDate, setIssueDate]       = useState(today)
  const [dueDate, setDueDate]           = useState('')
  const [ncfType, setNcfType]           = useState('E31')
  const [paymentTerms, setPaymentTerms] = useState('NET_30')
  const [notes, setNotes]               = useState('')
  const [lines, setLines]               = useState<LineItem[]>([EMPTY_LINE()])
  const [showNewClient, setShowNewClient] = useState(false)
  const [err, setErr]                   = useState<string | null>(null)

  // Global discount
  const [globalDiscType,  setGlobalDiscType]  = useState<'pct' | 'fixed'>('pct')
  const [globalDiscValue, setGlobalDiscValue] = useState('')

  // Initial payment
  const [payEnabled, setPayEnabled] = useState(false)
  const [payAmount, setPayAmount]   = useState('')
  const [payMethod, setPayMethod]   = useState('TRANSFER')
  const [payRef, setPayRef]         = useState('')
  const [payDate, setPayDate]       = useState(today)

  // Catalog confirm
  const [catalogPrompt, setCatalogPrompt] = useState<LineItem[]>([])
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null)

  const { data: clients  = [] } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: async () => { const { data } = await api.get('/clients', { params: { limit: 200 } }); return data.data ?? data },
  })
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-list'],
    queryFn: async () => { const { data } = await api.get('/products', { params: { limit: 200, isActive: true } }); return data.data ?? data },
  })
  const { data: company } = useQuery<any>({
    queryKey: ['company-settings'],
    queryFn: async () => { const { data } = await api.get('/settings/company'); return data.data ?? data },
  })

  const selectedClient = useMemo(() => clients.find(c => c.id === clientId) ?? null, [clients, clientId])
  const ncfInfo        = NCF_TYPES.find(n => n.value === ncfType) ?? NCF_TYPES[0]
  const forceExempt    = ncfInfo.exempt

  const setLine = (i: number, patch: Partial<LineItem>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))

  const applyProduct = (i: number, p: Product) =>
    setLine(i, {
      description: p.name,
      unitPrice:   p.unitPrice,
      taxRate:     p.isExempt ? 0 : Math.round(p.taxRate * 100),
      isExempt:    p.isExempt,
    })

  const calcs         = lines.map(l => calcLine(l, forceExempt))
  const subtotal      = calcs.reduce((s, c) => s + c.gross, 0)
  const lineDisc      = calcs.reduce((s, c) => s + c.disc, 0)
  const subtotalAfter = subtotal - lineDisc                        // after per-line discounts
  const totalTax      = calcs.reduce((s, c) => s + c.tax, 0)

  // Global discount (applied after per-line discounts, before ITBIS)
  const globalDiscRaw  = parseFloat(globalDiscValue) || 0
  const globalDiscAmt  = globalDiscType === 'pct'
    ? subtotalAfter * (globalDiscRaw / 100)
    : Math.min(globalDiscRaw, subtotalAfter)

  const totalDisc  = lineDisc + globalDiscAmt
  const grandTotal = subtotalAfter - globalDiscAmt + totalTax
  const balance    = Math.max(0, grandTotal - (parseFloat(payAmount) || 0))

  // Auto-calculate due date from payment terms
  function applyTerms(terms: string, baseDate?: string) {
    setPaymentTerms(terms)
    const t   = PAY_TERMS.find(p => p.value === terms)
    const src = baseDate ?? issueDate
    if (t?.days && src) {
      const d = new Date(src)
      d.setDate(d.getDate() + t.days)
      setDueDate(d.toISOString().slice(0, 10))
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      const resolvedItems = lines.map(l => {
        const base = forceExempt ? { ...l, isExempt: true, taxRate: 0 } : l
        const sub  = base.quantity * base.unitPrice * (1 - base.discountPct / 100)
        const tax  = base.isExempt ? 0 : sub * (base.taxRate / 100)
        return { ...base, taxRate: base.taxRate / 100, subtotal: sub, taxAmount: tax, total: sub + tax }
      })
      const { data: resp } = await api.post('/invoices', {
        clientId, businessUnit: bu,
        issueDate: issueDate || undefined,
        dueDate:   dueDate   || undefined,
        ncfType, paymentTerms,
        notes: notes || undefined,
        discountAmount: globalDiscAmt > 0 ? globalDiscAmt : undefined,
        items: resolvedItems,
      })
      const invoiceId = resp.data?.id ?? resp.id
      if (payEnabled && parseFloat(payAmount) > 0) {
        await api.post(`/invoices/${invoiceId}/payments`, {
          amount:    parseFloat(payAmount),
          method:    payMethod,
          reference: payRef || undefined,
          paidAt:    payDate || undefined,
          notes:     'Pago inicial al crear factura',
        })
      }
      return { data: resp, invoiceId }
    },
    onSuccess: ({ invoiceId }) => {
      const existingNames = new Set(products.map(p => p.name.toLowerCase().trim()))
      const newItems = lines.filter(l => l.description.trim() && !existingNames.has(l.description.toLowerCase().trim()))
      if (newItems.length > 0) { setCatalogPrompt(newItems); setPendingInvoiceId(invoiceId) }
      else router.push(`/dashboard/invoices/${invoiceId}`)
    },
    onError: (e: any) => setErr(e?.response?.data?.error ?? 'Error al crear la factura'),
  })

  // ── Catalog confirm modal ────────────────────────────────────────────────
  if (catalogPrompt.length > 0 && pendingInvoiceId) {
    return <CatalogConfirmModal items={catalogPrompt} onDone={() => router.push(`/dashboard/invoices/${pendingInvoiceId}`)} />
  }

  if (showNewClient) {
    return (
      <NewContactPage mode="cliente"
        onCreated={(contact) => {
          qc.invalidateQueries({ queryKey: ['clients-list'] })
          setClientId(contact.id)
          setShowNewClient(false)
        }}
        onBack={() => setShowNewClient(false)}
      />
    )
  }

  const canSubmit = !!clientId && lines.some(l => l.description.trim())

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-10 bg-[#f4f6f8] px-6 pt-5 pb-3 flex items-center justify-between">
        <Link href="/dashboard/invoices"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a facturas
        </Link>
        <h1 className="text-base font-semibold text-gray-800">Nueva factura</h1>
        <div className="w-32" />
      </div>

      <div className="px-6 pb-28 max-w-5xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* ── Document Header ── */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <HaxLogo color="#293c4f" className="h-9 w-auto" />
                <div className="pl-4 border-l border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{company?.companyName ?? 'HAX ESTUDIO CREATIVO EIRL'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">RNC {company?.rnc ?? '133290251'}</p>
                  {company?.phone && <p className="text-xs text-gray-400">{company.phone}</p>}
                  {company?.email && <p className="text-xs text-gray-400">{company.email}</p>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#293c4f] tracking-tight">FACTURA</p>
                  <p className="text-xs text-gray-400 mt-0.5">No. se asigna al guardar</p>
                </div>
                {/* BU toggle */}
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  {(['HAX', 'KODER'] as const).map(b => (
                    <button key={b} type="button" onClick={() => setBu(b)}
                      className={cn('px-4 py-1.5 text-xs font-semibold transition-colors',
                        bu === b ? 'bg-[#293c4f] text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Client + Dates ── */}
          <div className="grid grid-cols-2 gap-x-12 px-8 py-6 border-b border-gray-100">
            {/* Left: client */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Facturar a <span className="text-red-400">*</span></label>
                  <button type="button" onClick={() => setShowNewClient(true)}
                    className="flex items-center gap-1 text-xs text-[#293c4f] hover:opacity-70 transition-opacity font-medium">
                    <UserPlus className="w-3.5 h-3.5" /> Nuevo cliente
                  </button>
                </div>
                <SearchableDropdown<Client>
                  items={clients} value={clientId}
                  onSelect={c => setClientId(c.id)}
                  placeholder="Seleccionar cliente…"
                  renderSelected={c => c?.name ?? ''}
                  renderItem={c => (
                    <div>
                      <p className="font-medium text-gray-800 text-xs">{c.name}</p>
                      {c.rnc && <p className="text-gray-400 text-xs">{c.rnc}</p>}
                    </div>
                  )}
                  filterFn={(c, q) => c.name.toLowerCase().includes(q) || (c.rnc ?? '').includes(q)}
                  emptyText="No se encontró el cliente"
                />
                {selectedClient && (
                  <div className="bg-gray-50 rounded-xl p-3 mt-3 space-y-1">
                    {selectedClient.rnc   && <p className="text-xs text-gray-600"><span className="text-gray-400">RNC:</span> {selectedClient.rnc}</p>}
                    {selectedClient.phone && <p className="text-xs text-gray-600"><span className="text-gray-400">Tel:</span> {selectedClient.phone}</p>}
                    {selectedClient.email && <p className="text-xs text-gray-600"><span className="text-gray-400">Email:</span> {selectedClient.email}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Right: meta */}
            <div className="space-y-4">
              {/* NCF type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Tipo de documento</label>
                <Select value={ncfType} onChange={e => setNcfType(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15 focus:border-[#293c4f] bg-white">
                  <optgroup label="Fiscal (e-CF DGII)">
                    {NCF_TYPES.filter(n => n.fiscal).map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </optgroup>
                  <optgroup label="No fiscal">
                    {NCF_TYPES.filter(n => !n.fiscal).map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                  </optgroup>
                </Select>
                {ncfInfo.exempt && ncfType !== 'PROFORMA' && (
                  <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                    <span>⚠</span> Tipo {ncfType.replace('E', '')} — ITBIS exento en todos los ítems
                  </p>
                )}
                {ncfType === 'PROFORMA' && (
                  <p className="text-[11px] text-purple-600 mt-1.5 flex items-center gap-1">
                    <span>ℹ</span> Proforma — sin efecto fiscal ni asientos contables
                  </p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Emisión <span className="text-red-400">*</span></label>
                  <DatePicker value={issueDate}
                    onChange={v => { setIssueDate(v); applyTerms(paymentTerms, v) }}
                    className="w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Vencimiento</label>
                  <DatePicker value={dueDate} onChange={v => setDueDate(v)}
                    className="w-full" />
                </div>
              </div>

              {/* Payment terms */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Condiciones de pago</label>
                <div className="flex flex-wrap gap-1.5">
                  {PAY_TERMS.map(t => (
                    <button key={t.value} type="button" onClick={() => applyTerms(t.value)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
                        paymentTerms === t.value
                          ? 'bg-[#293c4f] text-white border-[#293c4f]'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      )}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Items ── */}
          <div className="px-8 py-5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalle de servicios / productos</p>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_64px_112px_64px_96px_88px_28px] gap-2.5 mb-2 px-1">
              <p className="text-[11px] font-semibold text-gray-400">Descripción</p>
              <p className="text-[11px] font-semibold text-gray-400 text-center">Cant.</p>
              <p className="text-[11px] font-semibold text-gray-400 text-right">Precio unit.</p>
              <p className="text-[11px] font-semibold text-gray-400 text-center">Desc. %</p>
              <p className="text-[11px] font-semibold text-gray-400 text-center">ITBIS</p>
              <p className="text-[11px] font-semibold text-gray-400 text-right">Total</p>
              <span />
            </div>

            <div className="space-y-1">
              {lines.map((line, i) => (
                <LineRow key={i}
                  line={line} index={i} products={products}
                  forceExempt={forceExempt}
                  showDelete={lines.length > 1}
                  onChange={patch => setLine(i, patch)}
                  onDelete={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                  onApplyProduct={p => applyProduct(i, p)}
                />
              ))}
            </div>

            <button type="button" onClick={() => setLines(prev => [...prev, EMPTY_LINE()])}
              className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#293c4f] hover:opacity-70 transition-opacity">
              <Plus className="w-3.5 h-3.5" /> Agregar línea
            </button>
          </div>

          {/* ── Global Discount ── */}
          <div className="px-8 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Descuento general</span>

              {/* Type toggle */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                {(['pct', 'fixed'] as const).map(t => (
                  <button key={t} type="button" onClick={() => { setGlobalDiscType(t); setGlobalDiscValue('') }}
                    className={cn('px-3 py-1.5 text-xs font-semibold transition-colors',
                      globalDiscType === t ? 'bg-[#293c4f] text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}>
                    {t === 'pct' ? '%' : 'RD$'}
                  </button>
                ))}
              </div>

              {/* Value input */}
              <div className="relative w-36">
                {globalDiscType === 'fixed' && (
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">RD$</span>
                )}
                <input
                  type="number" min="0" max={globalDiscType === 'pct' ? 100 : undefined}
                  step={globalDiscType === 'pct' ? '1' : '0.01'}
                  value={globalDiscValue}
                  onChange={e => setGlobalDiscValue(e.target.value)}
                  placeholder="0"
                  className={cn(
                    'w-full text-sm text-right border border-gray-200 rounded-lg py-1.5 pr-3 focus:outline-none focus:border-[#293c4f] focus:ring-1 focus:ring-[#293c4f]/15 bg-white',
                    globalDiscType === 'fixed' ? 'pl-8' : 'pl-3'
                  )}
                />
                {globalDiscType === 'pct' && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">%</span>
                )}
              </div>

              {globalDiscAmt > 0 && (
                <span className="text-xs font-semibold text-red-500">
                  -{formatCurrency(globalDiscAmt)}
                </span>
              )}
              {globalDiscValue && parseFloat(globalDiscValue) > 0 && (
                <button type="button" onClick={() => setGlobalDiscValue('')}
                  className="text-gray-300 hover:text-gray-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* ── Totals + Notes + Payment ── */}
          <div className="grid grid-cols-2 gap-8 px-8 py-6 border-b border-gray-100">
            {/* Left: notes + initial payment */}
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notas</label>
                  <span className="text-xs text-gray-300">{notes.length}/400</span>
                </div>
                <textarea rows={3} maxLength={400} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Términos de pago, instrucciones, etc."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15 focus:border-[#293c4f] resize-none placeholder-gray-300 text-gray-700" />
              </div>

              {/* Initial payment toggle */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Pago inicial / abono</p>
                    <p className="text-xs text-gray-400 mt-0.5">Registra un anticipo al emitir</p>
                  </div>
                  <div onClick={() => setPayEnabled(p => !p)}
                    className={cn('relative w-9 h-5 rounded-full transition-colors cursor-pointer', payEnabled ? 'bg-[#293c4f]' : 'bg-gray-200')}>
                    <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', payEnabled && 'translate-x-4')} />
                  </div>
                </label>

                {payEnabled && (
                  <div className="space-y-3 pt-1 border-t border-gray-100">
                    {/* Quick % */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Monto</p>
                      <div className="flex gap-1.5 mb-2">
                        {[25, 50, 75, 100].map(pct => (
                          <button key={pct} type="button"
                            onClick={() => setPayAmount((grandTotal * pct / 100).toFixed(2))}
                            className={cn(
                              'px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors',
                              parseFloat(payAmount) === grandTotal * pct / 100
                                ? 'border-[#293c4f] bg-[#293c4f] text-white'
                                : 'border-gray-200 text-gray-600 hover:border-[#293c4f]'
                            )}>
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">RD$</span>
                        <input type="number" min="0" step="0.01" placeholder="0.00" value={payAmount}
                          onChange={e => setPayAmount(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15 focus:border-[#293c4f]" />
                      </div>
                      {parseFloat(payAmount) > grandTotal && (
                        <p className="text-xs text-red-500 mt-1">El monto supera el total de la factura</p>
                      )}
                    </div>

                    {/* Method pills */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Forma de pago</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { v: 'TRANSFER',    l: 'Transferencia', icon: <Building2 className="w-3 h-3" /> },
                          { v: 'CASH',        l: 'Efectivo',      icon: <Banknote className="w-3 h-3" /> },
                          { v: 'CHECK',       l: 'Cheque',        icon: <FileText className="w-3 h-3" /> },
                          { v: 'CREDIT_CARD', l: 'Tarjeta',       icon: <CreditCard className="w-3 h-3" /> },
                        ].map(m => (
                          <button key={m.v} type="button" onClick={() => setPayMethod(m.v)}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                              payMethod === m.v
                                ? 'border-[#293c4f] bg-[#293c4f]/5 text-[#293c4f]'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            )}>
                            {m.icon}{m.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fecha del pago</label>
                        <DatePicker value={payDate} onChange={v => setPayDate(v)}
                          className="w-full" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Referencia</label>
                        <input type="text" placeholder="# cheque, transf…" value={payRef}
                          onChange={e => setPayRef(e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] focus:border-[#293c4f]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: totals */}
            <div className="flex flex-col justify-end">
              <div className="bg-gray-50 rounded-2xl p-5 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {lineDisc > 0 && (
                  <div className="flex justify-between text-sm text-red-400">
                    <span>Desc. por línea</span>
                    <span className="font-medium">-{formatCurrency(lineDisc)}</span>
                  </div>
                )}
                {globalDiscAmt > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Desc. general {globalDiscType === 'pct' ? `(${globalDiscValue}%)` : ''}</span>
                    <span className="font-medium">-{formatCurrency(globalDiscAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>ITBIS</span>
                  {ncfType === 'PROFORMA'
                    ? <span className="font-medium text-purple-600">No aplica</span>
                    : forceExempt
                      ? <span className="font-medium text-amber-600">Exento</span>
                      : <span className="font-medium">{formatCurrency(totalTax)}</span>}
                </div>
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-[#293c4f]">{formatCurrency(grandTotal)}</span>
                </div>

                {payEnabled && parseFloat(payAmount) > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-emerald-600 pt-1 border-t border-dashed border-gray-200 mt-1">
                      <span>Pago inicial</span>
                      <span className="font-medium">- {formatCurrency(parseFloat(payAmount))}</span>
                    </div>
                    <div className={cn(
                      'flex justify-between font-bold text-sm rounded-xl px-3 py-2 mt-1',
                      balance <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      <span>Saldo pendiente</span>
                      <span>{balance <= 0 ? 'Pagada' : formatCurrency(balance)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="px-8 py-3">
            <p className="text-xs text-gray-300">{company?.companyName ?? 'HAX ESTUDIO CREATIVO EIRL'} · RNC {company?.rnc ?? '133290251'}</p>
          </div>
        </div>

        {err && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">
            <X className="w-3.5 h-3.5 shrink-0" /> {err}
          </div>
        )}
      </div>

      {/* ── Fixed action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-8 py-4 flex items-center justify-between z-40">
        <div className="text-sm text-gray-500">
          {grandTotal > 0
            ? <>Total: <span className="font-bold text-[#293c4f]">{formatCurrency(grandTotal)}</span>
                {totalDisc > 0 && <span className="ml-2 text-xs text-red-400">· Desc: -{formatCurrency(totalDisc)}</span>}
                {payEnabled && parseFloat(payAmount) > 0 && (
                  <span className="ml-2 text-xs text-emerald-600">· Saldo: {formatCurrency(balance)}</span>
                )}
              </>
            : 'Factura en borrador'
          }
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/invoices">
            <Button variant="secondary">Cancelar</Button>
          </Link>
          <Button variant="primary" loading={create.isPending}
            disabled={!canSubmit || (payEnabled && parseFloat(payAmount) > grandTotal)}
            onClick={() => { setErr(null); create.mutate() }}>
            {payEnabled && parseFloat(payAmount) > 0 ? 'Crear y registrar pago' : 'Emitir factura'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Catalog Confirm Modal ────────────────────────────────────────────────────
function CatalogConfirmModal({ items, onDone }: { items: LineItem[]; onDone: () => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set(items.map((_, i) => i)))
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  async function handleConfirm() {
    setSaving(true); setErr('')
    try {
      const toCreate = items.filter((_, i) => selected.has(i))
      await Promise.all(toCreate.map(item =>
        api.post('/products', {
          name: item.description, unitPrice: item.unitPrice,
          taxRate: item.isExempt ? 0 : item.taxRate / 100,
          isExempt: item.isExempt, isActive: true, type: 'SERVICE', businessUnit: 'HAX',
        })
      ))
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Error al guardar productos')
    } finally { setSaving(false); onDone() }
  }

  const toggle = (i: number) => {
    const next = new Set(selected)
    next.has(i) ? next.delete(i) : next.add(i)
    setSelected(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#293c4f] px-6 py-4">
          <h2 className="text-white font-semibold text-sm">Agregar ítems al catálogo</h2>
          <p className="text-white/70 text-xs mt-0.5">Estos ítems no están en tu catálogo. ¿Cuáles deseas guardar?</p>
        </div>
        <div className="p-5 space-y-2">
          {items.map((item, i) => (
            <label key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
              <div onClick={() => toggle(i)}
                className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors',
                  selected.has(i) ? 'border-[#293c4f] bg-[#293c4f]' : 'border-gray-300')}>
                {selected.has(i) && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.description}</p>
                <p className="text-xs text-gray-400">{item.isExempt ? 'ITBIS exento' : `ITBIS ${item.taxRate}%`} · {formatCurrency(item.unitPrice)}</p>
              </div>
            </label>
          ))}
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="secondary" size="sm" onClick={onDone}>Omitir</Button>
          <Button variant="primary" size="sm" loading={saving}
            disabled={selected.size === 0} onClick={handleConfirm}>
            Guardar {selected.size > 0 ? `${selected.size} ítem${selected.size > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
