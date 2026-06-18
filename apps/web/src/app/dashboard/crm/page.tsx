'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, TrendingUp, Users, Target, Award } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState, Select } from '@/components/ui'

type LeadStatus = 'LEAD' | 'CONTACT' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST'
type BuFilter = 'ALL' | 'HAX' | 'KODER'

interface Opportunity {
  id: string
  title: string
  clientId: string
  client: { id: string; name: string; email?: string }
  description?: string
  value?: number
  probability: number
  expectedDate?: string
  status: LeadStatus
  businessUnit: 'HAX' | 'KODER'
  assignedTo?: string
  leadSource?: string
  contactName?: string
  closedAt?: string
  createdAt: string
  _count?: { activities: number; quotes: number }
}

interface Analytics {
  totalPipeline: number
  weightedForecast: number
  wonThisMonth: number
  winRate: number
  byStage: { status: LeadStatus; count: number; totalValue: number }[]
}

interface Client { id: string; name: string; email?: string }

const STAGES: { status: LeadStatus; label: string; color: string; headerColor: string }[] = [
  { status: 'LEAD',        label: 'Lead',        color: 'bg-gray-100 text-gray-700 border-gray-200',       headerColor: 'bg-gray-100' },
  { status: 'CONTACT',     label: 'Contactado',  color: 'bg-blue-50 text-blue-700 border-blue-200',        headerColor: 'bg-blue-50' },
  { status: 'PROPOSAL',    label: 'Propuesta',   color: 'bg-yellow-50 text-yellow-700 border-yellow-200',  headerColor: 'bg-yellow-50' },
  { status: 'NEGOTIATION', label: 'Negociación', color: 'bg-orange-50 text-orange-700 border-orange-200',  headerColor: 'bg-orange-50' },
  { status: 'CLOSED_WON',  label: 'Ganado',      color: 'bg-green-50 text-green-700 border-green-200',     headerColor: 'bg-green-50' },
  { status: 'CLOSED_LOST', label: 'Perdido',     color: 'bg-red-50 text-red-600 border-red-200',           headerColor: 'bg-red-50' },
]

const LEAD_SOURCES = [
  { value: 'REFERRAL',      label: 'Referido' },
  { value: 'COLD_OUTREACH', label: 'Prospección' },
  { value: 'INBOUND',       label: 'Llegó solo' },
  { value: 'SOCIAL_MEDIA',  label: 'Redes sociales' },
  { value: 'EVENT',         label: 'Evento' },
  { value: 'REPEAT',        label: 'Cliente recurrente' },
]

const EMPTY = {
  title: '', clientId: '', description: '', value: 0, probability: 20,
  status: 'LEAD' as LeadStatus, businessUnit: 'HAX' as const,
  assignedTo: '', leadSource: '', contactName: '', expectedDate: '',
}

export default function CrmPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [view, setView]         = useState<'kanban' | 'list'>('kanban')
  const [buFilter, setBuFilter] = useState<BuFilter>('ALL')
  const [editing, setEditing]   = useState<any | null>(null)
  const [isNew, setIsNew]       = useState(false)
  const [clientSearch, setClientSearch] = useState('')

  const buParam = buFilter !== 'ALL' ? `?businessUnit=${buFilter}` : ''

  const { data: analyticsData } = useQuery<Analytics>({
    queryKey: ['crm-analytics', buFilter],
    queryFn: async () => {
      const { data } = await api.get(`/crm/analytics${buParam}`)
      return data.data ?? data
    },
  })

  type PipelineData = Partial<Record<LeadStatus, { items: Opportunity[]; count: number; totalValue: number }>>
  const { data: pipeline = {} as PipelineData, isLoading } = useQuery<PipelineData>({
    queryKey: ['crm-pipeline', buFilter],
    queryFn: async () => {
      const { data } = await api.get(`/crm/pipeline${buParam}`)
      return data.data ?? data
    },
  })

  const { data: allOpps = [] } = useQuery<Opportunity[]>({
    queryKey: ['crm-list', buFilter],
    queryFn: async () => {
      const { data } = await api.get(`/crm${buParam ? buParam + '&' : '?'}limit=200`)
      return data.data ?? data
    },
    enabled: view === 'list',
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-search', clientSearch],
    queryFn: async () => {
      const { data } = await api.get(`/clients?search=${clientSearch}&limit=10`)
      return data.data ?? data
    },
    enabled: !!editing && clientSearch.length > 1,
  })

  const save = useMutation({
    mutationFn: async (body: any) => {
      const payload = { ...body }
      if (!payload.value) payload.value = null
      if (!payload.expectedDate) payload.expectedDate = null
      if (!payload.leadSource) payload.leadSource = null
      if (!payload.contactName) payload.contactName = null
      if (!payload.assignedTo) payload.assignedTo = null
      if (isNew) await api.post('/crm', payload)
      else await api.patch(`/crm/${payload.id}`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm-list'] })
      qc.invalidateQueries({ queryKey: ['crm-analytics'] })
      setEditing(null)
    },
  })

  const totalPipeline = analyticsData?.totalPipeline ?? 0

  const kpis = [
    { label: 'Pipeline activo', value: formatCurrency(analyticsData?.totalPipeline ?? 0), icon: TrendingUp, sub: 'excluyendo perdidos' },
    { label: 'Pronóstico ponderado', value: formatCurrency(analyticsData?.weightedForecast ?? 0), icon: Target, sub: 'por probabilidad' },
    { label: 'Ganado este mes', value: formatCurrency(analyticsData?.wonThisMonth ?? 0), icon: Award, sub: 'deals cerrados' },
    { label: 'Win rate (90d)', value: `${analyticsData?.winRate ?? 0}%`, icon: Users, sub: 'ganados vs perdidos' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="CRM"
        subtitle={`Pipeline de ventas · ${formatCurrency(totalPipeline)} en pipeline`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Holding / BU filter */}
            <div className="flex items-center rounded-lg border border-gray-200 p-0.5 bg-white">
              {(['ALL', 'HAX', 'KODER'] as BuFilter[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setBuFilter(u)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                    buFilter === u ? 'bg-[#293c4f] text-white' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {u === 'ALL' ? 'All' : u}
                </button>
              ))}
            </div>
            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['kanban', 'list'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn('px-3 py-1.5 text-xs font-medium transition-colors',
                    view === v ? 'bg-[#293c4f] text-white' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {v === 'kanban' ? 'Kanban' : 'Lista'}
                </button>
              ))}
            </div>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); setClientSearch('') }}
            >
              Nueva oportunidad
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} padding="sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                <p className="text-lg font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#293c4f]/8 flex items-center justify-center shrink-0">
                <k.icon className="w-4 h-4 text-[#293c4f]" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Kanban / List */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-56 shrink-0 rounded-xl" />)}
        </div>
      ) : view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageData = pipeline[stage.status]
            const items: Opportunity[] = stageData?.items ?? []
            const stageValue = stageData?.totalValue ?? 0
            return (
              <div key={stage.status} className="shrink-0 w-60">
                <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-xl border', stage.color)}>
                  <span className="text-xs font-semibold">{stage.label}</span>
                  <span className="text-xs opacity-60">{items.length}</span>
                </div>
                <div className="bg-gray-50 rounded-b-xl min-h-[180px] p-2 space-y-2 border border-t-0 border-gray-100">
                  {items.map((opp) => (
                    <div
                      key={opp.id}
                      onClick={() => router.push(`/dashboard/crm/${opp.id}`)}
                      className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm cursor-pointer hover:border-[#293c4f]/30 hover:shadow-md transition-all"
                    >
                      <p className="text-xs font-semibold text-gray-800 truncate">{opp.title}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{opp.client?.name}</p>
                      {(opp.value ?? 0) > 0 && (
                        <p className="text-xs font-semibold text-[#293c4f] mt-1.5">{formatCurrency(opp.value!)}</p>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium',
                          opp.businessUnit === 'HAX' ? 'bg-[#eef1f4] text-[#293c4f]' : 'bg-slate-100 text-slate-600'
                        )}>{opp.businessUnit}</span>
                        {opp.probability > 0 && (
                          <span className="text-xs text-gray-400">{opp.probability}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {stageValue > 0 && (
                    <p className="text-xs text-gray-400 text-right px-1 pt-1">{formatCurrency(stageValue)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card padding="sm">
          {allOpps.length === 0 ? (
            <EmptyState icon={<TrendingUp className="w-5 h-5" />} title="No hay oportunidades" description="Crea la primera oportunidad en el pipeline." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Oportunidad', 'Cliente', 'Etapa', 'Valor', 'Prob.', 'Unidad', 'Creado', ''].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allOpps.map((opp) => {
                    const stage = STAGES.find((s) => s.status === opp.status)!
                    return (
                      <tr
                        key={opp.id}
                        className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/crm/${opp.id}`)}
                      >
                        <td className="px-3 py-3 text-xs font-medium text-gray-800 max-w-[200px] truncate">{opp.title}</td>
                        <td className="px-3 py-3 text-xs text-gray-500 max-w-[140px] truncate">{opp.client?.name}</td>
                        <td className="px-3 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', stage.color)}>
                            {stage.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold text-gray-800">
                          {opp.value ? formatCurrency(opp.value) : '—'}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">{opp.probability}%</td>
                        <td className="px-3 py-3">
                          <span className={cn('px-1.5 py-0.5 rounded text-xs font-medium',
                            opp.businessUnit === 'HAX' ? 'bg-[#eef1f4] text-[#293c4f]' : 'bg-slate-100 text-slate-600'
                          )}>{opp.businessUnit}</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400">{formatDate(opp.createdAt)}</td>
                        <td className="px-3 py-3 text-xs text-gray-400">→</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal nueva / editar oportunidad */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 pb-4 sticky top-0 bg-white z-10 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{isNew ? 'Nueva oportunidad' : 'Editar oportunidad'}</h2>
              <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="p-6 space-y-4">
              <F label="Título de la oportunidad *">
                <input
                  type="text"
                  placeholder="Ej: Rediseño web corporativo"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className={ic}
                />
              </F>

              <F label="Cliente *">
                {isNew ? (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar cliente por nombre..."
                      value={editing.clientId ? (clients.find(c => c.id === editing.clientId)?.name ?? clientSearch) : clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value)
                        if (editing.clientId) setEditing({ ...editing, clientId: '' })
                      }}
                      className={ic}
                    />
                    {clients.length > 0 && !editing.clientId && (
                      <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {clients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setEditing({ ...editing, clientId: c.id }); setClientSearch(c.name) }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                          >
                            <span className="font-medium">{c.name}</span>
                            {c.email && <span className="text-gray-400 text-xs ml-2">{c.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {clientSearch.length > 1 && clients.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        No encontrado.{' '}
                        <a href="/dashboard/clients" target="_blank" className="text-[#293c4f] underline">Crear cliente</a>
                      </p>
                    )}
                  </div>
                ) : (
                  <input type="text" value={editing.client?.name ?? ''} disabled className={cn(ic, 'bg-gray-50 text-gray-500')} />
                )}
              </F>

              <div className="grid grid-cols-2 gap-3">
                <F label="Valor estimado (DOP)">
                  <input type="number" min="0" value={editing.value ?? ''} placeholder="0"
                    onChange={(e) => setEditing({ ...editing, value: parseFloat(e.target.value) || 0 })}
                    className={ic} />
                </F>
                <F label="Probabilidad (%)">
                  <input type="number" min="0" max="100" value={editing.probability ?? 20}
                    onChange={(e) => setEditing({ ...editing, probability: parseInt(e.target.value) || 0 })}
                    className={ic} />
                </F>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <F label="Etapa">
                  <Select value={editing.status} onChange={(e: any) => setEditing({ ...editing, status: e.target.value })} className={ic}>
                    {STAGES.map((s) => <option key={s.status} value={s.status}>{s.label}</option>)}
                  </Select>
                </F>
                <F label="Unidad de negocio">
                  <Select value={editing.businessUnit} onChange={(e: any) => setEditing({ ...editing, businessUnit: e.target.value })} className={ic}>
                    <option value="HAX">HAX Estudio</option>
                    <option value="KODER">KODER</option>
                  </Select>
                </F>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <F label="Origen del lead">
                  <Select value={editing.leadSource ?? ''} onChange={(e: any) => setEditing({ ...editing, leadSource: e.target.value })} className={ic}>
                    <option value="">— Seleccionar —</option>
                    {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                </F>
                <F label="Cierre esperado">
                  <input type="date" value={editing.expectedDate?.substring(0, 10) ?? ''}
                    onChange={(e) => setEditing({ ...editing, expectedDate: e.target.value })}
                    className={ic} />
                </F>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <F label="Persona de contacto">
                  <input type="text" value={editing.contactName ?? ''} placeholder="Nombre del contacto"
                    onChange={(e) => setEditing({ ...editing, contactName: e.target.value })}
                    className={ic} />
                </F>
                <F label="Asignado a">
                  <input type="text" value={editing.assignedTo ?? ''} placeholder="Nombre del responsable"
                    onChange={(e) => setEditing({ ...editing, assignedTo: e.target.value })}
                    className={ic} />
                </F>
              </div>

              <F label="Descripción">
                <textarea value={editing.description ?? ''} rows={2} placeholder="Detalles de la oportunidad..."
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className={cn(ic, 'resize-none')} />
              </F>
            </div>

            <div className="flex justify-end gap-2 p-6 pt-0">
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button
                variant="primary" size="sm" loading={save.isPending}
                disabled={!editing.title || !editing.clientId}
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

const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white'

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
