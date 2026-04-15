'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'

type LeadStatus = 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'

interface Lead {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  status: LeadStatus
  value: number | null
  businessUnit: 'HAX' | 'KODER'
  assignedTo?: { id: string; name: string } | null
  closedAt: string | null
  createdAt: string
}

const STAGES: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'LEAD',        label: 'Lead',        color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { status: 'QUALIFIED',   label: 'Calificado',  color: 'bg-blue-50 text-blue-700 border-blue-100'  },
  { status: 'PROPOSAL',    label: 'Propuesta',   color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  { status: 'NEGOTIATION', label: 'Negociación', color: 'bg-orange-50 text-orange-700 border-orange-100' },
  { status: 'WON',         label: 'Ganado',      color: 'bg-green-50 text-green-700 border-green-100'  },
  { status: 'LOST',        label: 'Perdido',     color: 'bg-red-50 text-red-600 border-red-100'  },
]

const STATUS_MAP: Record<LeadStatus, string> = Object.fromEntries(STAGES.map((s) => [s.status, s.label])) as Record<LeadStatus, string>

const EMPTY = { name: '', company: '', email: '', phone: '', status: 'LEAD' as LeadStatus, value: 0, businessUnit: 'HAX' as const }

export default function CrmPage() {
  const qc = useQueryClient()
  const [view, setView]       = useState<'kanban' | 'list'>('kanban')
  const [editing, setEditing] = useState<any | null>(null)
  const [isNew, setIsNew]     = useState(false)

  const { data: pipeline, isLoading } = useQuery<Record<LeadStatus, Lead[]>>({
    queryKey: ['crm-pipeline'],
    queryFn: async () => {
      const { data } = await api.get('/crm/pipeline')
      return data
    },
  })

  const { data: allLeads = [] } = useQuery<Lead[]>({
    queryKey: ['crm-leads'],
    queryFn: async () => {
      const { data } = await api.get('/crm')
      return data.data ?? data
    },
    enabled: view === 'list',
  })

  const save = useMutation({
    mutationFn: async (body: any) => {
      if (isNew) await api.post('/crm', body)
      else await api.patch(`/crm/${body.id}`, body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-pipeline'] }); qc.invalidateQueries({ queryKey: ['crm-leads'] }); setEditing(null) },
  })

  const totalValue = pipeline
    ? STAGES
        .filter((s) => s.status !== 'LOST')
        .reduce((sum: number, s) => sum + (pipeline[s.status] ?? []).reduce((a: number, l: Lead) => a + (l.value ?? 0), 0), 0)
    : 0

  return (
    <div className="space-y-5">
      <PageHeader
        title="CRM"
        subtitle={`Pipeline de ventas · ${formatCurrency(totalValue)} en pipeline`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['kanban', 'list'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn('px-3 py-1.5 text-xs font-medium transition-colors', view === v ? 'bg-[#293c4f] text-white' : 'text-gray-600 hover:bg-gray-50')}
                >
                  {v === 'kanban' ? 'Kanban' : 'Lista'}
                </button>
              ))}
            </div>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setEditing({ ...EMPTY }); setIsNew(true) }}>
              Nuevo lead
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-56 shrink-0 rounded-xl" />)}
        </div>
      ) : view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const leads: Lead[] = pipeline?.[stage.status] ?? []
            const stageValue = leads.reduce((s: number, l: Lead) => s + (l.value ?? 0), 0)
            return (
              <div key={stage.status} className="shrink-0 w-56">
                <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-xl border', stage.color)}>
                  <span className="text-xs font-semibold">{stage.label}</span>
                  <span className="text-xs opacity-70">{leads.length}</span>
                </div>
                <div className="bg-gray-50 rounded-b-xl min-h-[200px] p-2 space-y-2 border border-t-0 border-gray-100">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => { setEditing({ ...lead }); setIsNew(false) }}
                      className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm cursor-pointer hover:border-[#293c4f]/30 hover:shadow-md transition-all"
                    >
                      <p className="text-xs font-semibold text-gray-800 truncate">{lead.name}</p>
                      {lead.company && <p className="text-xs text-gray-500 truncate">{lead.company}</p>}
                      {lead.value != null && lead.value > 0 && (
                        <p className="text-xs font-medium text-[#293c4f] mt-1">{formatCurrency(lead.value)}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{lead.businessUnit}</p>
                    </div>
                  ))}
                  {stageValue > 0 && (
                    <p className="text-xs text-gray-400 text-right px-1">{formatCurrency(stageValue)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card padding="sm">
          {allLeads.length === 0 ? (
            <EmptyState icon={<TrendingUp className="w-5 h-5" />} title="No hay leads" description="Agrega el primer lead al pipeline." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Nombre', 'Empresa', 'Email', 'Estado', 'Valor', 'Unidad', 'Creado', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allLeads.map((l) => {
                  const stage = STAGES.find((s) => s.status === l.status)!
                  return (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer" onClick={() => { setEditing({ ...l }); setIsNew(false) }}>
                      <td className="px-3 py-3 text-xs font-medium text-gray-800">{l.name}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{l.company ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{l.email ?? '—'}</td>
                      <td className="px-3 py-3"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', stage.color)}>{stage.label}</span></td>
                      <td className="px-3 py-3 text-xs font-semibold text-gray-800">{l.value ? formatCurrency(l.value) : '—'}</td>
                      <td className="px-3 py-3"><span className="px-1.5 py-0.5 rounded text-xs font-medium" style={l.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>{l.businessUnit}</span></td>
                      <td className="px-3 py-3 text-xs text-gray-400">{formatDate(l.createdAt)}</td>
                      <td className="px-3 py-3 text-xs text-gray-400">→</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">{isNew ? 'Nuevo lead' : 'Editar lead'}</h2>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <F label="Nombre *"><input type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={ic} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Empresa"><input type="text" value={editing.company ?? ''} onChange={(e) => setEditing({ ...editing, company: e.target.value })} className={ic} /></F>
                <F label="Valor estimado (DOP)"><input type="number" min="0" value={editing.value ?? 0} onChange={(e) => setEditing({ ...editing, value: parseFloat(e.target.value) || 0 })} className={ic} /></F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Email"><input type="email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={ic} /></F>
                <F label="Teléfono"><input type="text" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={ic} /></F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Estado">
                  <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className={ic}>
                    {STAGES.map((s) => <option key={s.status} value={s.status}>{s.label}</option>)}
                  </select>
                </F>
                <F label="Unidad">
                  <select value={editing.businessUnit} onChange={(e) => setEditing({ ...editing, businessUnit: e.target.value })} className={ic}>
                    <option value="HAX">HAX</option>
                    <option value="KODER">KODER</option>
                  </select>
                </F>
              </div>
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
