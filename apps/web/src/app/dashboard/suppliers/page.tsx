'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit2, X, Truck } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'

interface Supplier {
  id: string
  name: string
  rnc: string | null
  email: string | null
  phone: string | null
  address: string | null
  category: string | null
  businessUnit: 'HAX' | 'KODER'
  isActive: boolean
  createdAt: string
  _count?: { expenses: number }
  totalSpent?: number
}

const EMPTY: Partial<Supplier> = { name: '', rnc: '', email: '', phone: '', category: '', businessUnit: 'HAX', isActive: true }

export default function SuppliersPage() {
  const qc = useQueryClient()
  const [search, setSearch]   = useState('')
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null)
  const [isNew, setIsNew]     = useState(false)

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers', search],
    queryFn: async () => {
      const { data } = await api.get('/suppliers', { params: { search: search || undefined } })
      return data.data ?? data
    },
  })

  const save = useMutation({
    mutationFn: async (body: Partial<Supplier>) => {
      if (isNew) await api.post('/suppliers', body)
      else await api.patch(`/suppliers/${body.id}`, body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setEditing(null); setIsNew(false) },
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Proveedores"
        subtitle="Gestión de proveedores"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }}>
            Nuevo proveedor
          </Button>
        }
      />

      <Card padding="sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RNC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
          />
        </div>
      </Card>

      <Card padding="sm">
        {isLoading ? (
          <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={<Truck className="w-5 h-5" />}
            title="No hay proveedores"
            description="Agrega proveedores para gestionar tus compras y gastos."
            action={<Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }}>Nuevo proveedor</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Nombre', 'RNC', 'Categoría', 'Email', 'Unidad', 'Gastos', 'Total gastado', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className={cn('border-b border-gray-50 hover:bg-gray-50/60 transition-colors', !s.isActive && 'opacity-50')}>
                  <td className="px-3 py-3 text-xs font-medium text-gray-800">{s.name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">{s.rnc ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{s.category ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{s.email ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={s.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {s.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{s._count?.expenses ?? 0}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-gray-800">{formatCurrency(s.totalSpent ?? 0)}</td>
                  <td className="px-3 py-3">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing({ ...s }); setIsNew(false) }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
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
              <h2 className="text-gray-900 font-semibold">{isNew ? 'Nuevo proveedor' : 'Editar proveedor'}</h2>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <F label="Nombre *"><input type="text" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={ic} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="RNC"><input type="text" value={editing.rnc ?? ''} onChange={(e) => setEditing({ ...editing, rnc: e.target.value })} className={ic} /></F>
                <F label="Categoría"><input type="text" value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={ic} /></F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Email"><input type="email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={ic} /></F>
                <F label="Teléfono"><input type="text" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={ic} /></F>
              </div>
              <F label="Dirección"><input type="text" value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} className={ic} /></F>
              <F label="Unidad">
                <select value={editing.businessUnit} onChange={(e) => setEditing({ ...editing, businessUnit: e.target.value as 'HAX' | 'KODER' })} className={ic}>
                  <option value="HAX">HAX</option>
                  <option value="KODER">KODER</option>
                </select>
              </F>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate(editing)}>
                {isNew ? 'Crear' : 'Guardar'}
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
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
