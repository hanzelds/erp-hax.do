'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, X, ToggleLeft, ToggleRight, Package, ArrowLeft, Check, Info, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'
import ConfirmModal from '@/components/ConfirmModal'

interface Product {
  id: string
  name: string
  description: string | null
  code: string | null
  unitPrice: number
  taxRate: number
  isExempt: boolean
  type: 'SERVICE' | 'PRODUCT'
  businessUnit: 'HAX' | 'KODER'
  isActive: boolean
  category?: { id: string; name: string } | null
}

// ── Shared field styles ───────────────────────────────────────
const ic  = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f] placeholder-gray-300 transition-colors'
const sel = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f] bg-white text-gray-700 appearance-none transition-colors'

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>{children}</div>
}

// ─────────────────────────────────────────────────────────────
// New Product Full Page
// ─────────────────────────────────────────────────────────────
function NewProductPage({ onCreated, onBack }: { onCreated: () => void; onBack: () => void }) {
  const qc = useQueryClient()
  const [type, setType]               = useState<'PRODUCT' | 'SERVICE'>('SERVICE')
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [code, setCode]               = useState('')
  const [businessUnit, setBusinessUnit] = useState<'HAX' | 'KODER'>('HAX')
  const [unitPrice, setUnitPrice]     = useState('')
  const [taxKey, setTaxKey]           = useState<'18' | '16' | '0' | 'exempt'>('18')
  const [err, setErr]                 = useState<string | null>(null)

  const taxRate    = taxKey === 'exempt' ? 0 : parseInt(taxKey) / 100
  const isExempt   = taxKey === 'exempt'
  const baseNum    = parseFloat(unitPrice) || 0
  const totalPrice = baseNum * (1 + taxRate)

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/products', {
        type,
        name:         name.trim(),
        description:  description.trim() || null,
        code:         code.trim() || null,
        businessUnit,
        unitPrice:    baseNum,
        taxRate,
        isExempt,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-list'] })
      onCreated()
    },
    onError: (e: any) => setErr(e?.response?.data?.error ?? 'Error al crear el producto'),
  })

  const TYPE_OPTIONS = [
    { value: 'PRODUCT', label: 'Producto' },
    { value: 'SERVICE', label: 'Servicio' },
  ] as const

  const TAX_OPTIONS = [
    { value: '18',    label: 'ITBIS 18%' },
    { value: '16',    label: 'ITBIS 16%' },
    { value: '0',     label: 'Ninguno (0%)' },
    { value: 'exempt', label: 'Exento' },
  ] as const

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <PageHeader title="Nuevo producto / servicio" subtitle="Completa los datos del artículo" />

      {/* ── Tipo ── */}
      <Card>
        <div className="p-1 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-3">
              Tipo de producto <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-3">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                    type === opt.value
                      ? 'border-[#293c4f] bg-[#293c4f] text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  )}
                >
                  {type === opt.value && <Check className="w-3.5 h-3.5" />}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
            <Info className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-500">
              Ten en cuenta que, una vez creado, no podrás cambiar el tipo de artículo.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Información general ── */}
      <Card>
        <div className="p-1 space-y-4">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Información general</p>
          <F label="Nombre *">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'SERVICE' ? 'Ej. Gestión de Redes Sociales' : 'Ej. Laptop Dell XPS'}
              className={ic}
              autoFocus
            />
          </F>
          <F label="Descripción">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el producto o servicio…"
              className={ic + ' resize-none'}
            />
          </F>
          <div className="grid grid-cols-2 gap-4">
            <F label="Código / SKU">
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Opcional" className={ic} />
            </F>
            <F label="Unidad de negocio">
              <div className="relative">
                <select value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value as 'HAX' | 'KODER')} className={sel}>
                  <option value="HAX">HAX</option>
                  <option value="KODER">KODER</option>
                </select>
                <Chevron />
              </div>
            </F>
          </div>
        </div>
      </Card>

      {/* ── Precio ── */}
      <Card>
        <div className="p-1 space-y-4">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Precio</p>

          {/* Price formula row */}
          <div className="flex items-end gap-3">
            {/* Precio base */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Precio base <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">RD$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.00"
                  className={ic + ' pl-10'}
                />
              </div>
            </div>

            {/* + */}
            <div className="pb-2.5 text-gray-400 font-semibold text-lg">+</div>

            {/* Impuesto */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Impuesto</label>
              <div className="relative">
                <select value={taxKey} onChange={(e) => setTaxKey(e.target.value as typeof taxKey)} className={sel}>
                  {TAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <Chevron />
              </div>
            </div>

            {/* = */}
            <div className="pb-2.5 text-gray-400 font-semibold text-lg">=</div>

            {/* Precio total (read-only) */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Precio total <span className="text-red-400">*</span>
              </label>
              <div className={cn(
                'w-full border rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-700 font-semibold',
                baseNum > 0 ? 'border-[#293c4f]/30 text-[#293c4f]' : 'border-gray-200'
              )}>
                {baseNum > 0 ? `RD$ ${totalPrice.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'RD$ 0.000'}
              </div>
            </div>
          </div>

          {/* Tax breakdown hint */}
          {baseNum > 0 && !isExempt && taxRate > 0 && (
            <p className="text-xs text-gray-400">
              Precio base RD$ {baseNum.toLocaleString('es-DO', { minimumFractionDigits: 2 })} + ITBIS {taxKey}% RD$ {(baseNum * taxRate).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
      </Card>

      {err && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2.5 rounded-xl border border-red-100">{err}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-4">
        <Button variant="secondary" onClick={onBack}>Cancelar</Button>
        <Button
          variant="primary"
          loading={create.isPending}
          disabled={!name.trim() || baseNum <= 0}
          onClick={() => { setErr(null); create.mutate() }}
        >
          Crear {type === 'SERVICE' ? 'servicio' : 'producto'}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch]       = useState('')
  const [typeF, setTypeF]         = useState('')
  const [bu, setBu]               = useState('')
  const [editing, setEditing]         = useState<any | null>(null)
  const [showNew, setShowNew]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', search, typeF, bu],
    queryFn: async () => {
      const { data } = await api.get('/products', {
        params: { search: search || undefined, type: typeF || undefined, businessUnit: bu || undefined },
      })
      return data.data ?? data
    },
  })

  const save = useMutation({
    mutationFn: async (body: any) => api.patch(`/products/${body.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-list'] })
      setEditing(null)
    },
  })

  const toggle = useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/toggle`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-list'] })
    },
  })

  const destroy = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-list'] })
      setConfirmDelete(null)
    },
    onError: (err: any) => {
      setConfirmDelete(null)
      alert(err?.response?.data?.error ?? 'No se pudo eliminar el producto')
    },
  })

  // ── Full-page new product ─────────────────────────────────
  if (showNew) {
    return (
      <NewProductPage
        onCreated={() => setShowNew(false)}
        onBack={() => setShowNew(false)}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Productos y Servicios"
        subtitle="Catálogo de productos y servicios"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowNew(true)}>
            Nuevo producto
          </Button>
        }
      />

      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Buscar por nombre, código…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]" />
          </div>
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white">
            <option value="">Todos los tipos</option>
            <option value="SERVICE">Servicios</option>
            <option value="PRODUCT">Productos</option>
          </select>
          <select value={bu} onChange={(e) => setBu(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white">
            <option value="">Ambas unidades</option>
            <option value="HAX">HAX</option>
            <option value="KODER">KODER</option>
          </select>
        </div>
      </Card>

      <Card padding="sm">
        {isLoading ? (
          <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Package className="w-5 h-5" />}
            title="No hay productos"
            description="Agrega productos o servicios para usar en tus facturas."
            action={<Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowNew(true)}>Nuevo producto</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Nombre', 'Código', 'Tipo', 'Categoría', 'Precio base', 'ITBIS', 'Unidad', 'Estado', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={cn('border-b border-gray-50 hover:bg-gray-50/60 transition-colors', !p.isActive && 'opacity-50')}>
                  <td className="px-3 py-3">
                    <p className="text-xs font-medium text-gray-800">{p.name}</p>
                    {p.description && <p className="text-xs text-gray-400 truncate max-w-[180px]">{p.description}</p>}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">{p.code ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', p.type === 'SERVICE' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700')}>
                      {p.type === 'SERVICE' ? 'Servicio' : 'Producto'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{p.category?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-gray-900">{formatCurrency(p.unitPrice)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{p.isExempt ? 'Exento' : `${(p.taxRate * 100).toFixed(0)}%`}</td>
                  <td className="px-3 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={p.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {p.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', p.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {p.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing({ ...p })}>
                        <span className="text-xs">Editar</span>
                      </Button>
                      <Button variant="ghost" size="sm" title={p.isActive ? 'Desactivar' : 'Activar'} onClick={() => toggle.mutate(p.id)}>
                        {p.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      </Button>
                      <Button variant="ghost" size="sm" title="Eliminar producto" onClick={() => setConfirmDelete(p)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <ConfirmModal
          title="Eliminar producto"
          message={`¿Estás seguro que deseas eliminar "${confirmDelete.name}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          loading={destroy.isPending}
          onConfirm={() => destroy.mutate(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ── Edit modal ── */}
      {editing && (
        <EditProductModal
          product={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Edit Product Modal
// ─────────────────────────────────────────────────────────────
function EditProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name:         product.name,
    description:  product.description ?? '',
    code:         product.code ?? '',
    unitPrice:    product.unitPrice,
    taxKey:       product.isExempt ? 'exempt' : String(Math.round(product.taxRate * 100)) as '18' | '16' | '0' | 'exempt',
    businessUnit: product.businessUnit,
  })
  const [err, setErr] = useState<string | null>(null)

  const taxRate  = form.taxKey === 'exempt' ? 0 : parseInt(form.taxKey) / 100
  const isExempt = form.taxKey === 'exempt'
  const total    = form.unitPrice * (1 + taxRate)

  const save = useMutation({
    mutationFn: async () => api.patch(`/products/${product.id}`, {
      name:        form.name.trim(),
      description: form.description.trim() || null,
      code:        form.code.trim() || null,
      unitPrice:   form.unitPrice,
      taxRate,
      isExempt,
      businessUnit: form.businessUnit,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products-list'] })
      onClose()
    },
    onError: (e: any) => setErr(e?.response?.data?.error ?? 'Error al guardar'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Editar producto</h2>
            <p className="text-xs text-gray-400 mt-0.5">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <F label="Nombre *">
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={ic} />
          </F>
          <F label="Descripción">
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={ic + ' resize-none'} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="Código / SKU">
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={ic} placeholder="Opcional" />
            </F>
            <F label="Unidad">
              <div className="relative">
                <select value={form.businessUnit} onChange={(e) => setForm({ ...form, businessUnit: e.target.value as 'HAX' | 'KODER' })} className={sel}>
                  <option value="HAX">HAX</option>
                  <option value="KODER">KODER</option>
                </select>
                <Chevron />
              </div>
            </F>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Precio base *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">RD$</span>
                <input type="number" min="0" step="0.01" value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: parseFloat(e.target.value) || 0 })}
                  className={ic + ' pl-10'} />
              </div>
            </div>
            <div className="pb-2.5 text-gray-400 font-semibold">+</div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Impuesto</label>
              <div className="relative">
                <select value={form.taxKey} onChange={(e) => setForm({ ...form, taxKey: e.target.value as typeof form.taxKey })} className={sel}>
                  <option value="18">ITBIS 18%</option>
                  <option value="16">ITBIS 16%</option>
                  <option value="0">Ninguno (0%)</option>
                  <option value="exempt">Exento</option>
                </select>
                <Chevron />
              </div>
            </div>
            <div className="pb-2.5 text-gray-400 font-semibold">=</div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Total</label>
              <div className="w-full border border-[#293c4f]/20 rounded-xl px-3 py-2.5 text-sm bg-gray-50 font-semibold text-[#293c4f]">
                RD$ {total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={save.isPending} disabled={!form.name.trim()} onClick={() => { setErr(null); save.mutate() }}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────
function Chevron() {
  return (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}
