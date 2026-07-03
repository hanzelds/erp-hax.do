'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, AlertCircle, Trash2, X } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { Button, Select } from '@/components/ui'

interface Supplier { id: string; name: string; rnc?: string | null }
interface FormItem { description: string; quantity: string; unitPrice: string }

const ic = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15 focus:border-[#293c4f] bg-white transition-colors'

function F({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-50 rounded-t-2xl">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  )
}

function ItemRow({ item, idx, onChange, onRemove, canRemove }: {
  item: FormItem; idx: number; canRemove: boolean
  onChange: (i: number, f: keyof FormItem, v: string) => void
  onRemove: (i: number) => void
}) {
  const sub   = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)
  const itbis = sub * 0.18
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-2">
        <input value={item.description} onChange={e => onChange(idx, 'description', e.target.value)}
          placeholder="Descripción del ítem"
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]" />
      </td>
      <td className="py-2 pr-2 w-20">
        <input value={item.quantity} onChange={e => onChange(idx, 'quantity', e.target.value)}
          type="number" min="1" placeholder="1"
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f] text-right" />
      </td>
      <td className="py-2 pr-2 w-32">
        <input value={item.unitPrice} onChange={e => onChange(idx, 'unitPrice', e.target.value)}
          type="number" min="0" step="0.01" placeholder="0.00"
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f] text-right" />
      </td>
      <td className="py-2 pr-2 w-24 text-right text-sm text-gray-500">{formatCurrency(itbis)}</td>
      <td className="py-2 w-28 text-right text-sm font-semibold text-gray-800">{formatCurrency(sub + itbis)}</td>
      <td className="py-2 pl-2 w-8">
        {canRemove && (
          <button type="button" onClick={() => onRemove(idx)} className="text-gray-300 hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  )
}

export default function NewPurchaseOrderPage() {
  const router = useRouter()
  const qc     = useQueryClient()

  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplier,       setSupplier]       = useState<Supplier | null>(null)
  const [dropOpen,       setDropOpen]       = useState(false)
  const [businessUnit,   setBU]             = useState<'HAX' | 'KODER' | 'ALDIA'>('HAX')
  const [notes,          setNotes]          = useState('')
  const [isCredit,       setIsCredit]       = useState(false)
  const [paymentTerms,   setPT]             = useState('30')
  const [items,          setItems]          = useState<FormItem[]>([{ description: '', quantity: '1', unitPrice: '' }])
  const [errors,         setErrors]         = useState<{ supplier?: string; items?: string }>({})

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers-search', supplierSearch],
    queryFn: async () => {
      if (!supplierSearch || supplier) return []
      const { data } = await api.get('/suppliers', { params: { search: supplierSearch, limit: 8 } })
      return data.data ?? data
    },
    enabled: !!supplierSearch && !supplier,
  })

  const subtotal   = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0)
  const taxTotal   = subtotal * 0.18
  const grandTotal = subtotal + taxTotal

  function updateItem(idx: number, field: keyof FormItem, val: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }
  function addItem()          { setItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '' }]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  function selectSupplier(s: Supplier) {
    setSupplier(s)
    setSupplierSearch(s.name)
    setDropOpen(false)
    setErrors(e => ({ ...e, supplier: undefined }))
  }

  function validate(): boolean {
    const e: { supplier?: string; items?: string } = {}
    if (!supplier) e.supplier = 'Selecciona un proveedor'
    const validItems = items.filter(i => i.description.trim() && parseFloat(i.unitPrice) > 0)
    if (validItems.length === 0) e.items = 'Agrega al menos un ítem con descripción y precio'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const createMut = useMutation({
    mutationFn: async () => {
      const validItems = items.filter(i => i.description.trim() && parseFloat(i.unitPrice) > 0)
      const payload = {
        supplierId:   supplier!.id,
        businessUnit,
        notes:        notes.trim() || undefined,
        isCredit,
        paymentTerms: isCredit ? parseInt(paymentTerms) : undefined,
        items: validItems.map(i => {
          const qty   = parseFloat(i.quantity) || 1
          const price = parseFloat(i.unitPrice) || 0
          const sub   = qty * price
          const tax   = sub * 0.18
          return { description: i.description.trim(), quantity: qty, unitPrice: price, subtotal: sub, taxAmount: tax, total: sub + tax }
        }),
      }
      const { data } = await api.post('/purchase-orders', payload)
      return data.data ?? data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      router.push('/dashboard/purchase-orders')
    },
  })

  function handleSubmit() {
    if (!validate()) return
    createMut.mutate()
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#f4f6f8]/95 backdrop-blur-sm border-b border-gray-200/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/purchase-orders')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Órdenes de Compra</span>
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-sm font-semibold text-gray-800">Nueva orden</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/purchase-orders')}>Cancelar</Button>
          <Button variant="primary" size="sm" loading={createMut.isPending} onClick={handleSubmit}>
            Crear orden
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {createMut.isError && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {(createMut.error as any)?.response?.data?.error ?? 'Error al crear la orden de compra'}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4 pb-24">

        {/* Sección 1 — Proveedor */}
        <Section title="Proveedor" subtitle="Selecciona el proveedor al que se emitirá la orden">
          <F label="Proveedor" required error={errors.supplier}>
            {supplier ? (
              <div className="flex items-center justify-between px-4 py-3 border border-[#293c4f] rounded-xl bg-[#f8f9fb]">
                <div>
                  <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
                  {supplier.rnc && <p className="text-xs text-gray-500">RNC {supplier.rnc}</p>}
                </div>
                <button type="button" onClick={() => { setSupplier(null); setSupplierSearch('') }} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className={cn(
                  'w-full flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white transition-colors',
                  errors.supplier ? 'border-red-300' : dropOpen ? 'border-[#293c4f] ring-2 ring-[#293c4f]/10' : 'border-gray-200'
                )}>
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={supplierSearch}
                    onChange={e => { setSupplierSearch(e.target.value); setDropOpen(true) }}
                    onFocus={() => supplierSearch && setDropOpen(true)}
                    placeholder="Buscar por nombre o RNC…"
                    className="flex-1 text-sm bg-transparent focus:outline-none placeholder-gray-400"
                    autoComplete="off"
                  />
                </div>
                {dropOpen && suppliers.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {suppliers.map(s => (
                      <button key={s.id} type="button" onClick={() => selectSupplier(s)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                        <p className="text-sm font-medium text-gray-800">{s.name}</p>
                        {s.rnc && <p className="text-xs text-gray-400">RNC {s.rnc}</p>}
                      </button>
                    ))}
                  </div>
                )}
                {dropOpen && supplierSearch.length >= 2 && suppliers.length === 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
                    <p className="text-xs text-gray-500">No se encontraron proveedores.</p>
                    <a href="/dashboard/suppliers" target="_blank" className="text-xs text-[#293c4f] underline font-medium">Crear proveedor →</a>
                  </div>
                )}
              </div>
            )}
          </F>
        </Section>

        {/* Sección 2 — General */}
        <Section title="Detalles" subtitle="Unidad de negocio y observaciones de la orden">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Unidad de negocio" required>
              <Select value={businessUnit} onChange={e => setBU(e.target.value as any)} className={ic}>
                <option value="HAX">HAX Estudio Creativo</option>
                <option value="KODER">KODER</option>
                <option value="ALDIA">Al Dia ERP</option>
              </Select>
            </F>
            <F label="Notas internas">
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Referencia, instrucciones, etc."
                className={ic} />
            </F>
          </div>
        </Section>

        {/* Sección 3 — Crédito */}
        <Section title="Condiciones de pago" subtitle="Indica si la compra es a crédito y el plazo de pago">
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setIsCredit(!isCredit)}
                className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0', isCredit ? 'bg-[#293c4f]' : 'bg-gray-200')}
              >
                <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', isCredit ? 'translate-x-4.5' : 'translate-x-0.5')} />
              </button>
              <div>
                <p className="text-sm font-medium text-gray-900">Compra a crédito</p>
                <p className="text-xs text-gray-500">Genera una Cuenta por Pagar automáticamente al marcar la orden como recibida</p>
              </div>
            </label>

            {isCredit && (
              <F label="Plazo de pago">
                <Select value={paymentTerms} onChange={e => setPT(e.target.value)} className={ic}>
                  {[15, 30, 45, 60, 90].map(d => <option key={d} value={String(d)}>{d} días</option>)}
                </Select>
              </F>
            )}
          </div>
        </Section>

        {/* Sección 4 — Ítems */}
        <Section title="Ítems" subtitle="Productos o servicios incluidos en la orden">
          <F label="" error={errors.items}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-400 pb-2">Descripción</th>
                    <th className="text-right text-xs font-medium text-gray-400 pb-2 w-20">Cant.</th>
                    <th className="text-right text-xs font-medium text-gray-400 pb-2 w-32">Precio unit.</th>
                    <th className="text-right text-xs font-medium text-gray-400 pb-2 w-24">ITBIS</th>
                    <th className="text-right text-xs font-medium text-gray-400 pb-2 w-28">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <ItemRow
                      key={idx}
                      item={item}
                      idx={idx}
                      onChange={updateItem}
                      onRemove={removeItem}
                      canRemove={items.length > 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addItem}
              className="mt-3 text-sm text-[#293c4f] hover:underline font-medium">
              + Agregar ítem
            </button>
          </F>

          {/* Totals */}
          <div className="border-t border-gray-100 pt-4 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>ITBIS (18%)</span>
              <span>{formatCurrency(taxTotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-gray-900 pt-1 border-t border-gray-100">
              <span>Total</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </Section>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/purchase-orders')}>Cancelar</Button>
        <Button variant="primary" size="sm" loading={createMut.isPending} onClick={handleSubmit}>
          Crear orden
        </Button>
      </div>
    </div>
  )
}
