'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, TrendingUp, Users, Target, Award } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'

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

const STAGES: { status: LeadStatus; label: string; color: string; headerColor: string }[] = [
  { status: 'LEAD',        label: 'Lead',        color: 'bg-gray-100 text-gray-700 border-gray-200',       headerColor: 'bg-gray-100' },
  { status: 'CONTACT',     label: 'Contactado',  color: 'bg-blue-50 text-blue-700 border-blue-200',        headerColor: 'bg-blue-50' },
  { status: 'PROPOSAL',    label: 'Propuesta',   color: 'bg-yellow-50 text-yellow-700 border-yellow-200',  headerColor: 'bg-yellow-50' },
  { status: 'NEGOTIATION', label: 'Negociación', color: 'bg-orange-50 text-orange-700 border-orange-200',  headerColor: 'bg-orange-50' },
  { status: 'CLOSED_WON',  label: 'Ganado',      color: 'bg-green-50 text-green-700 border-green-200',     headerColor: 'bg-green-50' },
  { status: 'CLOSED_LOST', label: 'Perdido',     color: 'bg-red-50 text-red-600 border-red-200',           headerColor: 'bg-red-50' },
]

export default function CrmPage() {
  const router = useRouter()
  const [view, setView]         = useState<'kanban' | 'list'>('kanban')
  const [buFilter, setBuFilter] = useState<BuFilter>('ALL')

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
              onClick={() => router.push('/dashboard/crm/new')}
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

    </div>
  )
}
