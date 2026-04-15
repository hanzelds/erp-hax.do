'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, X, RefreshCcw, AlertTriangle, DollarSign } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'

type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

interface RecurringPayment {
  id: string
  description: string
  amount: number
  frequency: Frequency
  nextDueDate: string
  category: string | null
  businessUnit: 'HAX' | 'KODER'
  isActive: boolean
  autoGenerate: boolean
}

const FREQ_LABELS: Record<Frequency, string> = {
  WEEKLY: 'Semanal', BIWEEKLY: 'Quincenal', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', YEARLY: 'Anual',
}

const EMPTY = { description: '', amount: 0, frequency: 'MONTHLY' as Frequency, nextDueDate: new Date().toISOString().slice(0, 10), category: '', businessUnit: 'HAX' as const, autoGenerate: true }

export default function RecurringPaymentsPage() {
  const qc = useQueryClient()
  const [search, setSearch]   = useState('')
  const [editing, setEditing] = useState<any | null>(null)
  const [isNew, setIsNew]     = useState(false)

  const { data: payments = [], isLoading } = useQuery<RecurringPayment[]>({
    queryKey: ['recurring-payments', search],
    queryFn: async () => {
      const { data } = await api.get('/recurring-payments', { params: { search: search || undefined } })
      return data.data ?? data
    },
  })

  const save = useMutation({
    mutationFn: async (body: any) => {
      if (isNew) await api.post('/recurring-payments', body)
      else await api.patch(`/recurring-payments/${body.id}`, body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recurring-payments'] }); setEditing(null) },
  })

  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/recurring-payments/${id}/pay`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring-payments'] }),
  })

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pagos Recurrentes"
        subtitle="Suscripciones y pagos periódicos"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }}>
            Nuevo recurrente
          </Button>
        }
      />

      <Card padding="sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Buscar pagos recurrentes…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]" />
        </div>
      </Card>

      <Card padding="sm">
        {isLoading ? (
          <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : payments.length === 0 ? (
          <EmptyState icon={<RefreshCcw className="w-5 h-5" />} title="No hay pagos recurrentes" description="Registra tus suscripciones y pagos periódicos." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Descripción', 'Categoría', 'Frecuencia', 'Próximo vence', 'Monto', 'Unidad', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const isOverdue = p.nextDueDate <= today && p.isActive
                return (
                  <tr key={p.id} className={cn('border-b border-gray-50 hover:bg-gray-50/60 transition-colors', !p.isActive && 'opacity-50')}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                        <span className="text-xs font-medium text-gray-800">{p.description}</span>
                      </div>
                      {p.autoGenerate && <p className="text-xs text-gray-400 ml-5">Auto-genera gasto</p>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">{p.category ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                        {FREQ_LABELS[p.frequency]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-xs font-medium', isOverdue ? 'text-red-500' : 'text-gray-700')}>
                        {formatDate(p.nextDueDate)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                    <td className="px-3 py-3">
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={p.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                        {p.businessUnit}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" title="Registrar pago" onClick={() => pay.mutate(p.id)} disabled={pay.isPending}>
                          <DollarSign className="w-3.5 h-3.5 text-green-500" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing({ ...p }); setIsNew(false) }}>
                          <span className="text-xs">Editar</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">{isNew ? 'Nuevo pago recurrente' : 'Editar pago recurrente'}</h2>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <F label="Descripción *"><input type="text" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={ic} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Monto (DOP) *"><input type="number" min="0" step="0.01" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: parseFloat(e.target.value) || 0 })} className={ic} /></F>
                <F label="Frecuencia">
                  <select value={editing.frequency} onChange={(e) => setEditing({ ...editing, frequency: e.target.value })} className={ic}>
                    {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Próximo vence"><input type="date" value={editing.nextDueDate} onChange={(e) => setEditing({ ...editing, nextDueDate: e.target.value })} className={ic} /></F>
                <F label="Categoría"><input type="text" value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={ic} /></F>
              </div>
              <F label="Unidad">
                <select value={editing.businessUnit} onChange={(e) => setEditing({ ...editing, businessUnit: e.target.value })} className={ic}>
                  <option value="HAX">HAX</option>
                  <option value="KODER">KODER</option>
                </select>
              </F>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={editing.autoGenerate} onChange={(e) => setEditing({ ...editing, autoGenerate: e.target.checked })} className="rounded" />
                Auto-generar gasto al pagar
              </label>
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
