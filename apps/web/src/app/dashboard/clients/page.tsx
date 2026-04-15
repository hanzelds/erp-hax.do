'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, X, Edit2, UserX, UserCheck } from 'lucide-react'
import api from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import {
  PageHeader, Button, Card, Skeleton, EmptyState,
} from '@/components/ui'

interface Client {
  id: string
  name: string
  rnc: string | null
  email: string | null
  phone: string | null
  address: string | null
  businessUnit: 'HAX' | 'KODER'
  isActive: boolean
  createdAt: string
}

const EMPTY: Partial<Client> = {
  name: '', rnc: '', email: '', phone: '', address: '', businessUnit: 'HAX', isActive: true,
}

export default function ClientsPage() {
  const qc = useQueryClient()
  const [search, setSearch]     = useState('')
  const [editing, setEditing]   = useState<Partial<Client> | null>(null)
  const [isNew, setIsNew]       = useState(false)

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', search],
    queryFn: async () => {
      const { data } = await api.get('/clients', { params: { search: search || undefined } })
      return data.data ?? data
    },
  })

  const save = useMutation({
    mutationFn: async (body: Partial<Client>) => {
      if (isNew) {
        await api.post('/clients', body)
      } else {
        await api.patch(`/clients/${body.id}`, body)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setEditing(null)
      setIsNew(false)
    },
  })

  const toggle = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/clients/${id}`, { isActive: !isActive })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  function openNew() {
    setEditing({ ...EMPTY })
    setIsNew(true)
  }
  function openEdit(c: Client) {
    setEditing({ ...c })
    setIsNew(false)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        subtitle="Gestión de clientes"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openNew}>
            Nuevo cliente
          </Button>
        }
      />

      {/* Search */}
      <Card padding="sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RNC, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white placeholder-gray-400"
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        {isLoading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : clients.length === 0 ? (
          <EmptyState
            title="No hay clientes"
            description="Agrega tu primer cliente para comenzar a facturar."
            action={<Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openNew}>Nuevo cliente</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Nombre', 'RNC', 'Email', 'Teléfono', 'Unidad', 'Creado', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className={cn('border-b border-gray-50 hover:bg-gray-50/60 transition-colors', !c.isActive && 'opacity-50')}>
                  <td className="px-3 py-3">
                    <span className="text-gray-800 font-medium text-xs">{c.name}</span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">{c.rnc ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{c.email ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{c.phone ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={c.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}
                    >
                      {c.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-400">{formatDate(c.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggle.mutate({ id: c.id, isActive: c.isActive })}
                        title={c.isActive ? 'Desactivar' : 'Activar'}
                      >
                        {c.isActive ? <UserX className="w-3.5 h-3.5 text-red-400" /> : <UserCheck className="w-3.5 h-3.5 text-green-500" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-gray-900 font-semibold">{isNew ? 'Nuevo cliente' : 'Editar cliente'}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Nombre *">
                <input type="text" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} />
              </Field>
              <Field label="RNC / Cédula">
                <input type="text" value={editing.rnc ?? ''} onChange={(e) => setEditing({ ...editing, rnc: e.target.value })} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input type="email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={inputCls} />
                </Field>
                <Field label="Teléfono">
                  <input type="text" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={inputCls} />
                </Field>
              </div>
              <Field label="Dirección">
                <input type="text" value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Unidad de negocio">
                <select value={editing.businessUnit} onChange={(e) => setEditing({ ...editing, businessUnit: e.target.value as 'HAX' | 'KODER' })} className={inputCls}>
                  <option value="HAX">HAX</option>
                  <option value="KODER">KODER</option>
                </select>
              </Field>
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

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f]'
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
