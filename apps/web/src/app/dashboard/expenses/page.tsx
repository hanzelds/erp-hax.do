'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, X, CheckCircle, DollarSign, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState, Badge } from '@/components/ui'

type ExpenseStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED'

interface Expense {
  id: string
  description: string
  amount: number
  category: string | null
  status: ExpenseStatus
  businessUnit: 'HAX' | 'KODER'
  issueDate: string
  ncf: string | null
  supplier?: { id: string; name: string } | null
  createdAt: string
}

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobado', PAID: 'Pagado', CANCELLED: 'Cancelado',
}
const STATUS_COLORS: Record<ExpenseStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  APPROVED: 'bg-blue-50 text-blue-700',
  PAID: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-600',
}

const EMPTY = { description: '', amount: 0, category: '', ncf: '', businessUnit: 'HAX' as const, issueDate: new Date().toISOString().slice(0, 10) }

export default function ExpensesPage() {
  const qc = useQueryClient()
  const [search, setSearch]   = useState('')
  const [statusF, setStatusF] = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [isNew, setIsNew]     = useState(false)

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['expenses', search, statusF],
    queryFn: async () => {
      const { data } = await api.get('/expenses', { params: { search: search || undefined, status: statusF || undefined } })
      return data.data ?? data
    },
  })

  const save = useMutation({
    mutationFn: async (body: any) => {
      if (isNew) await api.post('/expenses', body)
      else await api.patch(`/expenses/${body.id}`, body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setEditing(null) },
  })

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/expenses/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })

  const markPaid = useMutation({
    mutationFn: (id: string) => api.post(`/expenses/${id}/pay`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/expenses/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gastos"
        subtitle="Control de gastos empresariales"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }}>
            Nuevo gasto
          </Button>
        }
      />

      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Buscar gastos…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]" />
          </div>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f]">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </Card>

      <Card padding="sm">
        {isLoading ? (
          <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : expenses.length === 0 ? (
          <EmptyState title="No hay gastos" description="Registra gastos para llevar el control financiero." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Descripción', 'Proveedor', 'NCF', 'Categoría', 'Unidad', 'Fecha', 'Monto', 'Estado', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-3 py-3 text-xs font-medium text-gray-800 max-w-[200px] truncate">{e.description}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{e.supplier?.name ?? '—'}</td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">{e.ncf ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{e.category ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={e.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {e.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-400">{formatDate(e.issueDate)}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-gray-900">{formatCurrency(e.amount)}</td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[e.status])}>
                      {STATUS_LABELS[e.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      {e.status === 'DRAFT' && (
                        <Button variant="ghost" size="sm" title="Aprobar" onClick={() => approve.mutate(e.id)}>
                          <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                        </Button>
                      )}
                      {e.status === 'APPROVED' && (
                        <Button variant="ghost" size="sm" title="Marcar pagado" onClick={() => markPaid.mutate(e.id)}>
                          <DollarSign className="w-3.5 h-3.5 text-green-500" />
                        </Button>
                      )}
                      {(e.status === 'DRAFT' || e.status === 'APPROVED') && (
                        <Button variant="ghost" size="sm" title="Cancelar" onClick={() => cancel.mutate(e.id)}>
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        </Button>
                      )}
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
              <h2 className="font-semibold text-gray-900">{isNew ? 'Nuevo gasto' : 'Editar gasto'}</h2>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <F label="Descripción *"><input type="text" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={ic} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Monto (DOP) *"><input type="number" min="0" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: parseFloat(e.target.value) || 0 })} className={ic} /></F>
                <F label="Fecha *"><input type="date" value={editing.issueDate} onChange={(e) => setEditing({ ...editing, issueDate: e.target.value })} className={ic} /></F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="NCF"><input type="text" value={editing.ncf ?? ''} onChange={(e) => setEditing({ ...editing, ncf: e.target.value })} className={ic} /></F>
                <F label="Categoría"><input type="text" value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={ic} /></F>
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
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
