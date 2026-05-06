'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Send, Check, X, FileText, ArrowRight, UserPlus, ArrowLeft,
  Trash2, ChevronDown, Download, Search, Calendar, Building2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn, openPdf } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState, DatePicker } from '@/components/ui'
import { HaxLogo } from '@/components/ui/HaxLogo'
import NewContactPage from '@/components/NewContactPage'

// ─── Types ────────────────────────────────────────────────────────────────────
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
  productId: string; description: string; code: string
  unitPrice: number; discountPct: number; taxRate: number; isExempt: boolean; quantity: number
}

const EMPTY_LINE = (): LineItem => ({ productId: '', description: '', code: '', unitPrice: 0, discountPct: 0, taxRate: 0.18, isExempt: false, quantity: 1 })

function calcLine(l: LineItem) {
  const gross = l.quantity * l.unitPrice
  const discount = gross * (l.discountPct / 100)
  const taxable = gross - discount
  const tax = l.isExempt ? 0 : taxable * l.taxRate
  return { gross, discount, taxable, tax, total: taxable + tax }
}

const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: 'Borrador', SENT: 'Enviada', ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada', EXPIRED: 'Vencida', CONVERTED: 'Convertida',
}
const STATUS_COLOR: Record<QuoteStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', SENT: 'bg-blue-50 text-blue-700 border border-blue-100',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  REJECTED: 'bg-red-50 text-red-600 border border-red-100',
  EXPIRED: 'bg-amber-50 text-amber-600 border border-amber-100',
  CONVERTED: 'bg-purple-50 text-purple-700 border border-purple-100',
}

// ─── Searchable dropdown ───────────────────────────────────────────────────────
function SearchableDropdown<T extends { id: string }>({
  items, value, onSelect, placeholder, renderItem, renderSelected, filterFn, emptyText = 'Sin resultados',
}: {
  items: T[]; value: string; onSelect: (item: T) => void
  placeholder: string; renderItem: (item: T) => React.ReactNode
  renderSelected: (item: T | undefined) => string
  filterFn: (item: T, q: string) => boolean; emptyText?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = items.find(i => i.id === value)

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
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

// ─── Tax selector ──────────────────────────────────────────────────────────────
function TaxSelector({ isExempt, taxRate, onChange }: { isExempt: boolean; taxRate: number; onChange: (v: { isExempt: boolean; taxRate: number }) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const opts = [
    { label: 'ITBIS 18%', value: '0.18', isExempt: false, taxRate: 0.18 },
    { label: 'ITBIS 16%', value: '0.16', isExempt: false, taxRate: 0.16 },
    { label: 'Sin ITBIS', value: '0',    isExempt: false, taxRate: 0 },
    { label: 'Exento',    value: 'ex',   isExempt: true,  taxRate: 0 },
  ]
  const current = isExempt ? opts[3] : opts.find(o => o.taxRate === taxRate) ?? opts[0]

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

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

// ─── Line row ─────────────────────────────────────────────────────────────────
function LineRow({ line, index, products, lineTotal, discount, showDelete, onChange, onDelete, onApplyProduct }: {
  line: LineItem; index: number; products: Product[]
  lineTotal: number; discount: number; showDelete: boolean
  onChange: (patch: Partial<LineItem>) => void
  onDelete: () => void
  onApplyProduct: (p: Product) => void
}) {
  const [showProducts, setShowProducts] = useState(false)
  const [prodSearch, setProdSearch]     = useState('')
  const descRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function h(e: MouseEvent) { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowProducts(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = prodSearch
    ? products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()))
    : products

  return (
    <div className="group grid grid-cols-[1fr_72px_120px_72px_100px_96px_32px] gap-3 items-center px-1 py-2 rounded-xl hover:bg-gray-50/80 transition-colors">

      {/* Description + product picker */}
      <div ref={dropRef} className="relative">
        <input
          ref={descRef}
          type="text"
          value={line.description}
          placeholder="Descripción del servicio o producto…"
          onChange={e => onChange({ description: e.target.value })}
          onFocus={() => { setShowProducts(true); setProdSearch('') }}
          className="w-full text-sm text-gray-800 placeholder-gray-300 bg-transparent focus:outline-none py-1"
        />
        {/* Subtle underline */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-focus-within:bg-[#293c4f] transition-colors" />

        {/* Product autocomplete dropdown */}
        {showProducts && products.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  value={prodSearch}
                  onChange={e => setProdSearch(e.target.value)}
                  placeholder="Buscar producto…"
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
      <input
        type="number" min="1" step="1" value={line.quantity}
        onChange={e => onChange({ quantity: parseInt(e.target.value) || 1 })}
        className="w-full text-sm text-center text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#293c4f] focus:ring-1 focus:ring-[#293c4f]/15 transition-colors"
      />

      {/* Unit price */}
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">RD$</span>
        <input
          type="number" min="0" step="0.01" value={line.unitPrice || ''} placeholder="0"
          onChange={e => onChange({ unitPrice: parseFloat(e.target.value) || 0 })}
          className="w-full text-sm text-right text-gray-700 bg-white border border-gray-200 rounded-lg pl-8 pr-2 py-1.5 focus:outline-none focus:border-[#293c4f] focus:ring-1 focus:ring-[#293c4f]/15 transition-colors"
        />
      </div>

      {/* Discount % */}
      <div className="relative">
        <input
          type="number" min="0" max="100" step="1" value={line.discountPct || ''} placeholder="0"
          onChange={e => onChange({ discountPct: parseFloat(e.target.value) || 0 })}
          className="w-full text-sm text-center text-gray-700 bg-white border border-gray-200 rounded-lg px-2 pr-6 py-1.5 focus:outline-none focus:border-[#293c4f] focus:ring-1 focus:ring-[#293c4f]/15 transition-colors"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none">%</span>
      </div>

      {/* Tax */}
      <div className="flex justify-center">
        <TaxSelector isExempt={line.isExempt} taxRate={line.taxRate} onChange={v => onChange(v)} />
      </div>

      {/* Total */}
      <div className="text-right">
        <p className="text-sm font-bold text-gray-800">{formatCurrency(lineTotal)}</p>
        {discount > 0 && <p className="text-[11px] text-red-400">-{formatCurrency(discount)}</p>}
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

// ─────────────────────────────────────────────────────────────
// New Quote — Full Page
// ─────────────────────────────────────────────────────────────
function NewQuotePage({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [clientId, setClientId]     = useState('')
  const [bu, setBu]                 = useState<'HAX' | 'KODER'>('HAX')
  const [issueDate, setIssueDate]   = useState(today)
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes]           = useState('')
  const [terms, setTerms]           = useState('')
  const [lines, setLines]           = useState<LineItem[]>([EMPTY_LINE()])
  const [showNewClient, setShowNewClient] = useState(false)
  const [err, setErr]               = useState<string | null>(null)

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

  const setLine = (i: number, patch: Partial<LineItem>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))

  const applyProduct = (i: number, p: Product) =>
    setLine(i, { productId: p.id, description: p.name, code: p.code ?? '', unitPrice: p.unitPrice, taxRate: p.taxRate, isExempt: p.isExempt })

  const calcs      = lines.map(calcLine)
  const subtotal   = calcs.reduce((s, c) => s + c.gross, 0)
  const totalDisc  = calcs.reduce((s, c) => s + c.discount, 0)
  const totalTax   = calcs.reduce((s, c) => s + c.tax, 0)
  const grandTotal = calcs.reduce((s, c) => s + c.total, 0)

  const save = useMutation({
    mutationFn: async () => api.post('/quotes', {
      clientId, businessUnit: bu,
      validUntil: validUntil || undefined,
      notes: notes || undefined, terms: terms || undefined,
      items: lines.map((l, idx) => ({
        description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
        taxRate: l.isExempt ? 0 : l.taxRate, isExempt: l.isExempt, sortOrder: idx,
      })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotes'] }); onClose() },
    onError: (e: any) => setErr(e?.response?.data?.error ?? 'Error al guardar'),
  })

  if (showNewClient) {
    return (
      <NewContactPage mode="cliente"
        onCreated={(contact) => { qc.invalidateQueries({ queryKey: ['clients-list'] }); setClientId(contact.id); setShowNewClient(false) }}
        onBack={() => setShowNewClient(false)} />
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#f4f6f8] px-6 pt-5 pb-3 flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <h1 className="text-base font-semibold text-gray-800">Nueva cotización</h1>
        <div className="w-16" />
      </div>

      <div className="px-6 pb-28 max-w-5xl mx-auto space-y-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* ── Document Header ── */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="flex items-start justify-between">
              {/* Logo + company */}
              <div className="flex items-center gap-4">
                <HaxLogo color="#293c4f" className="h-9 w-auto" />
                <div className="pl-4 border-l border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{company?.companyName ?? 'HAX ESTUDIO CREATIVO EIRL'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">RNC {company?.rnc ?? '133290251'}</p>
                  {company?.phone && <p className="text-xs text-gray-400">{company.phone}</p>}
                  {company?.email && <p className="text-xs text-gray-400">{company.email}</p>}
                </div>
              </div>

              {/* Right: quote label + BU toggle */}
              <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#293c4f] tracking-tight">COTIZACIÓN</p>
                  <p className="text-xs text-gray-400 mt-0.5">No. se asigna al guardar</p>
                </div>
                {/* BU pill toggle */}
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  {(['HAX', 'KODER'] as const).map(b => (
                    <button key={b} type="button" onClick={() => setBu(b)}
                      className={cn(
                        'px-4 py-1.5 text-xs font-semibold transition-colors',
                        bu === b
                          ? 'bg-[#293c4f] text-white'
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      )}>
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
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Facturar a</label>
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
              </div>

              {selectedClient && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  {selectedClient.rnc && (
                    <p className="text-xs text-gray-600"><span className="text-gray-400">RNC / Cédula:</span> {selectedClient.rnc}</p>
                  )}
                  {selectedClient.phone && (
                    <p className="text-xs text-gray-600"><span className="text-gray-400">Teléfono:</span> {selectedClient.phone}</p>
                  )}
                  {selectedClient.email && (
                    <p className="text-xs text-gray-600"><span className="text-gray-400">Email:</span> {selectedClient.email}</p>
                  )}
                </div>
              )}
            </div>

            {/* Right: dates */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Fecha de emisión <span className="text-red-400">*</span>
                </label>
                <DatePicker value={issueDate} onChange={v => setIssueDate(v)}
                  className="w-full" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Válida hasta
                </label>
                <DatePicker value={validUntil} onChange={v => setValidUntil(v)}
                  className="w-full" />
              </div>
            </div>
          </div>

          {/* ── Items ── */}
          <div className="px-8 py-5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Detalle de servicios / productos</p>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_72px_120px_72px_100px_96px_32px] gap-3 mb-2 px-1">
              <p className="text-[11px] font-semibold text-gray-400">Descripción</p>
              <p className="text-[11px] font-semibold text-gray-400 text-center">Cant.</p>
              <p className="text-[11px] font-semibold text-gray-400 text-right">Precio unit.</p>
              <p className="text-[11px] font-semibold text-gray-400 text-center">Desc. %</p>
              <p className="text-[11px] font-semibold text-gray-400 text-center">Impuesto</p>
              <p className="text-[11px] font-semibold text-gray-400 text-right">Total</p>
              <span />
            </div>

            <div className="space-y-1">
              {lines.map((line, i) => {
                const { total: lineTotal, discount } = calcLine(line)
                return (
                  <LineRow key={i}
                    line={line} index={i} products={products}
                    lineTotal={lineTotal} discount={discount}
                    showDelete={lines.length > 1}
                    onChange={patch => setLine(i, patch)}
                    onDelete={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                    onApplyProduct={p => applyProduct(i, p)}
                  />
                )
              })}
            </div>

            <button type="button" onClick={() => setLines(prev => [...prev, EMPTY_LINE()])}
              className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#293c4f] hover:opacity-70 transition-opacity">
              <Plus className="w-3.5 h-3.5" /> Agregar línea
            </button>
          </div>

          {/* ── Totals + Notes ── */}
          <div className="grid grid-cols-2 gap-8 px-8 py-6 border-b border-gray-100">
            {/* Notes + Terms */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notas</label>
                  <span className="text-xs text-gray-300">{notes.length}/290</span>
                </div>
                <textarea rows={3} maxLength={290} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Notas visibles en la cotización…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15 focus:border-[#293c4f] resize-none placeholder-gray-300 text-gray-700" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Términos y condiciones</label>
                  <span className="text-xs text-gray-300">{terms.length}/400</span>
                </div>
                <textarea rows={3} maxLength={400} value={terms} onChange={e => setTerms(e.target.value)}
                  placeholder="Condiciones de pago, entrega, etc."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15 focus:border-[#293c4f] resize-none placeholder-gray-300 text-gray-700" />
              </div>
            </div>

            {/* Totals */}
            <div className="flex flex-col justify-end">
              <div className="bg-gray-50 rounded-2xl p-5 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {totalDisc > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Descuento</span>
                    <span className="font-medium">-{formatCurrency(totalDisc)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>ITBIS</span>
                  <span className="font-medium">{formatCurrency(totalTax)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-[#293c4f]">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="px-8 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-300">Los campos marcados con <span className="text-red-400">*</span> son obligatorios</p>
            <p className="text-xs text-gray-300">{company?.companyName ?? 'HAX ESTUDIO CREATIVO EIRL'} · RNC {company?.rnc ?? '133290251'}</p>
          </div>
        </div>

        {err && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">
            <X className="w-3.5 h-3.5 shrink-0" /> {err}
          </div>
        )}
      </div>

      {/* ── Fixed action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-8 py-4 flex items-center justify-between z-40">
        <p className="text-sm text-gray-500">
          {grandTotal > 0 ? <>Total: <span className="font-bold text-[#293c4f]">{formatCurrency(grandTotal)}</span></> : 'Cotización en borrador'}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={save.isPending}
            disabled={!clientId || lines.every(l => !l.description)}
            onClick={() => { setErr(null); save.mutate() }}>
            Guardar cotización
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Quotes List Page
// ─────────────────────────────────────────────────────────────
export default function QuotesPage() {
  const [status, setStatus]     = useState('')
  const [bu, setBu]             = useState('')
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

  if (showNew) return <NewQuotePage onClose={() => setShowNew(false)} />

  const STATUS_TABS = [
    { value: '', label: 'Todas' },
    { value: 'DRAFT', label: 'Borrador' },
    { value: 'SENT', label: 'Enviadas' },
    { value: 'ACCEPTED', label: 'Aceptadas' },
    { value: 'REJECTED', label: 'Rechazadas' },
    { value: 'CONVERTED', label: 'Convertidas' },
  ]

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
      {stats?.byStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(stats.byStatus as any[]).slice(0, 4).map((s: any) => (
            <Card key={s.status} padding="sm">
              <div className="px-2 py-1">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_COLOR[s.status as QuoteStatus] ?? 'bg-gray-100 text-gray-600')}>
                    {STATUS_LABEL[s.status as QuoteStatus] ?? s.status}
                  </span>
                  <span className="text-lg font-bold text-[#293c4f]">{s._count}</span>
                </div>
                <p className="text-xs text-gray-400">{formatCurrency(s._sum?.total ?? 0)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
          {/* Status tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_TABS.map(t => (
              <button key={t.value} onClick={() => setStatus(t.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  status === t.value
                    ? 'bg-[#293c4f] text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                )}>
                {t.label}
              </button>
            ))}
          </div>
          {/* BU toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 overflow-hidden">
            {[{ value: '', label: 'Todas' }, { value: 'HAX', label: 'HAX' }, { value: 'KODER', label: 'KODER' }].map(b => (
              <button key={b.value} onClick={() => setBu(b.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  bu === b.value ? 'bg-[#293c4f] text-white' : 'text-gray-500 hover:bg-gray-50'
                )}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : quotes.length === 0 ? (
          <EmptyState icon={<FileText className="w-5 h-5" />} title="Sin cotizaciones"
            description="Crea la primera cotización para comenzar."
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
                <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-3 py-3">
                    <button onClick={() => setDetailId(q.id)} className="font-mono text-xs font-semibold text-[#293c4f] hover:underline">
                      {q.number}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-700 font-medium">{q.client?.name}</td>
                  <td className="px-3 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={q.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {q.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_COLOR[q.status as QuoteStatus] ?? 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABEL[q.status as QuoteStatus]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs font-bold text-[#293c4f]">{formatCurrency(q.total)}</td>
                  <td className="px-3 py-3 text-xs text-gray-400">
                    {q.validUntil ? (
                      <span className={cn(new Date(q.validUntil) < new Date() && q.status === 'SENT' ? 'text-red-500 font-medium' : '')}>
                        {formatDate(q.validUntil)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      {/* View detail */}
                      <button title="Ver detalle" onClick={() => setDetailId(q.id)}
                        className="px-2 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors font-medium">
                        Ver
                      </button>
                      {q.status === 'DRAFT' && (
                        <button title="Marcar como enviada" onClick={() => sendQ.mutate(q.id)}
                          className="px-2 py-1 rounded-lg text-xs text-blue-600 hover:bg-blue-50 transition-colors font-medium flex items-center gap-1">
                          <Send className="w-3 h-3" /> Enviar
                        </button>
                      )}
                      {(q.status === 'SENT' || q.status === 'DRAFT') && (
                        <button title="Marcar como aceptada" onClick={() => acceptQ.mutate(q.id)}
                          className="px-2 py-1 rounded-lg text-xs text-emerald-600 hover:bg-emerald-50 transition-colors font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Aceptar
                        </button>
                      )}
                      {(q.status === 'SENT' || q.status === 'DRAFT') && (
                        <button title="Marcar como rechazada" onClick={() => rejectQ.mutate(q.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {q.status === 'ACCEPTED' && (
                        <button title="Convertir a factura" onClick={() => convertQ.mutate(q.id)}
                          className="px-2 py-1 rounded-lg text-xs text-purple-600 hover:bg-purple-50 transition-colors font-medium flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" /> Facturar
                        </button>
                      )}
                      {q.status === 'CONVERTED' && q.invoice && (
                        <button title="Ver factura" onClick={() => router.push(`/dashboard/invoices/${q.invoice!.id}`)}
                          className="px-2 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors font-medium flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Factura
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
        <QuoteDetailModal id={detailId} onClose={() => setDetailId(null)}
          onConvert={id => { setDetailId(null); convertQ.mutate(id) }} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Quote Detail Modal
// ─────────────────────────────────────────────────────────────
function QuoteDetailModal({ id, onClose, onConvert }: { id: string; onClose: () => void; onConvert: (id: string) => void }) {
  const { data: quote, isLoading } = useQuery<Quote>({
    queryKey: ['quote', id],
    queryFn: async () => { const { data } = await api.get(`/quotes/${id}`); return data.data ?? data },
  })

  if (isLoading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-8"><div className="w-6 h-6 border-2 border-[#293c4f] border-t-transparent rounded-full animate-spin mx-auto" /></div>
    </div>
  )
  if (!quote) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900 font-mono">{quote.number}</p>
              <p className="text-xs text-gray-400 mt-0.5">{quote.client?.name}</p>
            </div>
            <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', STATUS_COLOR[quote.status])}>
              {STATUS_LABEL[quote.status]}
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 mb-0.5">Fecha de emisión</p>
              <p className="font-medium text-gray-700">{formatDate(quote.createdAt)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-gray-400 mb-0.5">Válida hasta</p>
              <p className="font-medium text-gray-700">{quote.validUntil ? formatDate(quote.validUntil) : '—'}</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ítems</p>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Descripción</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">Cant.</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">Precio</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(quote.items ?? []).map((item, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 px-3 text-gray-700">{item.description}</td>
                      <td className="py-2 px-3 text-right text-gray-500">{item.quantity}</td>
                      <td className="py-2 px-3 text-right text-gray-500">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 px-3 text-right font-semibold text-gray-800">
                        {formatCurrency(item.quantity * item.unitPrice + (item.isExempt ? 0 : item.taxAmount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span className="font-medium">{formatCurrency(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>ITBIS</span><span className="font-medium">{formatCurrency(quote.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-[#293c4f] pt-1.5 border-t border-gray-200 mt-1.5">
              <span>Total</span><span>{formatCurrency(quote.total)}</span>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="text-xs text-gray-500 border-t border-gray-100 pt-3">
              <p className="font-medium text-gray-400 mb-1">Notas</p>
              <p>{quote.notes}</p>
            </div>
          )}
          {quote.terms && (
            <div className="text-xs text-gray-500">
              <p className="font-medium text-gray-400 mb-1">Términos</p>
              <p>{quote.terms}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 border-t border-gray-100 pt-4">
            <Button variant="secondary" size="sm" className="w-full" icon={<Download className="w-3.5 h-3.5" />}
              onClick={() => openPdf(`/quotes/${quote.id}/pdf`, `cotizacion-${quote.number}.pdf`)}>
              Descargar PDF
            </Button>
            {quote.status === 'ACCEPTED' && (
              <Button variant="primary" size="sm" className="w-full" icon={<ArrowRight className="w-3.5 h-3.5" />}
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
