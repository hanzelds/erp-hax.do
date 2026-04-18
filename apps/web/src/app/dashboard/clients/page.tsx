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
  isActive: boolean
  createdAt: string
}

interface ClientForm {
  id?: string
  name: string
  rnc: string
  email: string
  phone: string
  address: string
}

const EMPTY: ClientForm = {
  name: '', rnc: '', email: '', phone: '', address: '',
}

/** Convert empty strings to null for nullable DB fields */
function sanitize(f: ClientForm) {
  return {
    name:    f.name.trim(),
    rnc:     f.rnc.trim()     || null,
    email:   f.email.trim()   || null,
    phone:   f.phone.trim()   || null,
    address: f.address.trim() || null,
  }
}

export default function ClientsPage() {
  const qc = useQueryClient()
  const [search, setSearch]   = useState('')
  const [editing, setEditing] = useState<ClientForm | null>(null)
  const [isNew, setIsNew]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', search],
    queryFn: async () => {
      const { data } = await api.get('/clients', { params: { search: search || undefined } })
      return data.data ?? data
    },
  })

  const save = useMutation({
    mutationFn: async (form: ClientForm) => {
      const body = sanitize(form)
      if (isNew) {
        await api.post('/clients', body)
      } else {
        await api.patch(`/clients/${form.id}`, body)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      setEditing(null)
      setIsNew(false)
      setError(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Error al guardar el cliente'
      setError(msg)
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
    setError(null)
  }
  function openEdit(c: Client) {
    setEditing({
      id:      c.id,
      name:    c.name,
      rnc:     c.rnc    ?? '',
      email:   c.email  ?? '',
      phone:   c.phone  ?? '',
      address: c.address ?? '',
    })
    setIsNew(false)
    setError(null)
  }

  function handleChange(field: keyof ClientForm, value: string) {
    setEditing((f) => f ? { ...f, [field]: value } : f)
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
                {['Nombre', 'RNC / Cédula', 'Email', 'Teléfono', 'Creado', ''].map((h) => (
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
              <button onClick={() => { setEditing(null); setError(null) }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <Field label="Nombre *">
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={inputCls}
                  placeholder="Nombre o razón social"
                  autoFocus
                />
              </Field>
              <Field label="RNC / Cédula">
                <input
                  type="text"
                  value={editing.rnc}
                  onChange={(e) => handleChange('rnc', e.target.value)}
                  className={inputCls}
                  placeholder="Opcional"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <input
                    type="email"
                    value={editing.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={inputCls}
                    placeholder="Opcional"
                  />
                </Field>
                <Field label="Teléfono">
                  <input
                    type="text"
                    value={editing.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className={inputCls}
                    placeholder="Opcional"
                  />
                </Field>
              </div>
              <Field label="Dirección">
                <input
                  type="text"
                  value={editing.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className={inputCls}
                  placeholder="Opcional"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => { setEditing(null); setError(null) }}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={save.isPending}
                disabled={!editing.name.trim()}
                onClick={() => save.mutate(editing)}
              >
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
