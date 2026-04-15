'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, X, ToggleLeft, ToggleRight, Package } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'

interface Product {
  id: string
  name: string
  description: string | null
  sku: string | null
  price: number
  taxRate: number
  isExempt: boolean
  type: 'SERVICE' | 'PRODUCT'
  businessUnit: 'HAX' | 'KODER'
  isActive: boolean
  category?: { id: string; name: string } | null
}

const EMPTY = { name: '', description: '', sku: '', price: 0, taxRate: 18, isExempt: false, type: 'SERVICE' as const, businessUnit: 'HAX' as const }

export default function ProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch]   = useState('')
  const [typeF, setTypeF]     = useState('')
  const [bu, setBu]           = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [isNew, setIsNew]     = useState(false)

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', search, typeF, bu],
    queryFn: async () => {
      const { data } = await api.get('/products', { params: { search: search || undefined, type: typeF || undefined, businessUnit: bu || undefined } })
      return data.data ?? data
    },
  })

  const save = useMutation({
    mutationFn: async (body: any) => {
      if (isNew) await api.post('/products', body)
      else await api.patch(`/products/${body.id}`, body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setEditing(null) },
  })

  const toggle = useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Productos y Servicios"
        subtitle="Catálogo de productos y servicios"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }}>
            Nuevo producto
          </Button>
        }
      />

      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Buscar por nombre, SKU…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]" />
          </div>
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f]">
            <option value="">Todos los tipos</option>
            <option value="SERVICE">Servicios</option>
            <option value="PRODUCT">Productos</option>
          </select>
          <select value={bu} onChange={(e) => setBu(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f]">
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
          <EmptyState icon={<Package className="w-5 h-5" />} title="No hay productos" description="Agrega productos o servicios para usar en tus facturas." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Nombre', 'SKU', 'Tipo', 'Categoría', 'Precio', 'ITBIS', 'Unidad', 'Estado', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={cn('border-b border-gray-50 hover:bg-gray-50/60 transition-colors', !p.isActive && 'opacity-50')}>
                  <td className="px-3 py-3">
                    <p className="text-xs font-medium text-gray-800">{p.name}</p>
                    {p.description && <p className="text-xs text-gray-400 truncate max-w-[160px]">{p.description}</p>}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">{p.sku ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium', p.type === 'SERVICE' ? 'bg-purple-50 text-purple-700' : 'bg-orange-50 text-orange-700')}>
                      {p.type === 'SERVICE' ? 'Servicio' : 'Producto'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{p.category?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-gray-900">{formatCurrency(p.price)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{p.isExempt ? 'Exento' : `${p.taxRate}%`}</td>
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
                      <Button variant="ghost" size="sm" onClick={() => { setEditing({ ...p }); setIsNew(false) }}>
                        <span className="text-xs">Editar</span>
                      </Button>
                      <Button variant="ghost" size="sm" title={p.isActive ? 'Desactivar' : 'Activar'} onClick={() => toggle.mutate(p.id)}>
                        {p.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">{isNew ? 'Nuevo producto' : 'Editar producto'}</h2>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <F label="Nombre *"><input type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={ic} /></F>
              <F label="Descripción"><textarea rows={2} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={ic} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="SKU"><input type="text" value={editing.sku ?? ''} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} className={ic} /></F>
                <F label="Tipo">
                  <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })} className={ic}>
                    <option value="SERVICE">Servicio</option>
                    <option value="PRODUCT">Producto</option>
                  </select>
                </F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Precio (DOP)"><input type="number" min="0" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) || 0 })} className={ic} /></F>
                <F label="Tasa ITBIS %">
                  <select value={editing.isExempt ? 'exempt' : editing.taxRate} onChange={(e) => {
                    if (e.target.value === 'exempt') setEditing({ ...editing, isExempt: true, taxRate: 0 })
                    else setEditing({ ...editing, isExempt: false, taxRate: parseInt(e.target.value) })
                  }} className={ic}>
                    <option value="exempt">Exento</option>
                    <option value="18">18%</option>
                    <option value="16">16%</option>
                    <option value="0">0%</option>
                  </select>
                </F>
              </div>
              <F label="Unidad">
                <select value={editing.businessUnit} onChange={(e) => setEditing({ ...editing, businessUnit: e.target.value })} className={ic}>
                  <option value="HAX">HAX</option>
                  <option value="KODER">KODER</option>
                </select>
              </F>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate(editing)}>{isNew ? 'Crear' : 'Guardar'}</Button>
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
