'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, TrendingUp, Users, Target, Award, Search, X, SlidersHorizontal } from 'lucide-react'
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

const STAGES: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'LEAD',        label: 'Lead',        color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { status: 'CONTACT',     label: 'Contactado',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { status: 'PROPOSAL',    label: 'Propuesta',   color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { status: 'NEGOTIATION', label: 'Negociación', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { status: 'CLOSED_WON',  label: 'Ganado',      color: 'bg-green-50 text-green-700 border-green-200' },
  { status: 'CLOSED_LOST', label: 'Perdido',     color: 'bg-red-50 text-red-600 border-red-200' },
]

const LEAD_SOURCE_LABELS: Record<string, string> = {
  COLD_OUTREACH: 'Prospección fría',
  REFERRAL:      'Referido',
  INBOUND:       'Inbound',
  SOCIAL_MEDIA:  'Redes sociales',
  EVENT:         'Evento',
  REPEAT:        'Cliente recurrente',
}

const PROB_RANGES = [
  { label: 'Alta (≥15%)',   value: 'high'   },
  { label: 'Media (10%)',   value: 'medium' },
  { label: 'Baja (≤5%)',    value: 'low'    },
]

const VALUE_RANGES = [
  { label: '< DOP 60k',          value: 'xs'  },
  { label: 'DOP 60k – 100k',     value: 'sm'  },
  { label: 'DOP 100k – 180k',    value: 'md'  },
  { label: '> DOP 180k',         value: 'lg'  },
]

function matchProb(prob: number, range: string) {
  if (range === 'high')   return prob >= 15
  if (range === 'medium') return prob === 10
  if (range === 'low')    return prob <= 5
  return true
}

function matchValue(val: number | undefined, range: string) {
  const v = val ?? 0
  if (range === 'xs') return v < 60000
  if (range === 'sm') return v >= 60000 && v < 100000
  if (range === 'md') return v >= 100000 && v < 180000
  if (range === 'lg') return v >= 180000
  return true
}

const selectCls = 'h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#293c4f] appearance-none pr-7 bg-no-repeat bg-[right_0.5rem_center] bg-[length:12px] cursor-pointer'

export default function CrmPage() {
  const router = useRouter()
  const [view, setView]         = useState<'kanban' | 'list'>('kanban')
  const [buFilter, setBuFilter] = useState<BuFilter>('ALL')

  // ── Filters ─────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('')
  const [fStage,      setFStage]      = useState('')
  const [fProb,       setFProb]       = useState('')
  const [fSource,     setFSource]     = useState('')
  const [fValue,      setFValue]      = useState('')
  const [fAssigned,   setFAssigned]   = useState('')

  const activeCount = [search, fStage, fProb, fSource, fValue, fAssigned].filter(Boolean).length

  function clearFilters() {
    setSearch(''); setFStage(''); setFProb('')
    setFSource(''); setFValue(''); setFAssigned('')
  }

  // ── Queries ──────────────────────────────────────────────────────
  const buParam = buFilter !== 'ALL' ? `businessUnit=${buFilter}` : ''

  const { data: analyticsData } = useQuery<Analytics>({
    queryKey: ['crm-analytics', buFilter],
    queryFn: async () => {
      const { data } = await api.get(`/crm/analytics${buParam ? '?' + buParam : ''}`)
      return data.data ?? data
    },
  })

  type PipelineData = Partial<Record<LeadStatus, { items: Opportunity[]; count: number; totalValue: number }>>
  const { data: pipeline = {} as PipelineData, isLoading } = useQuery<PipelineData>({
    queryKey: ['crm-pipeline', buFilter],
    queryFn: async () => {
      const { data } = await api.get(`/crm/pipeline${buParam ? '?' + buParam : ''}`)
      return data.data ?? data
    },
  })

  const { data: rawList = [] } = useQuery<Opportunity[]>({
    queryKey: ['crm-list', buFilter],
    queryFn: async () => {
      const q = [buParam, 'limit=500'].filter(Boolean).join('&')
      const { data } = await api.get(`/crm?${q}`)
      return data.data ?? data
    },
  })

  // ── Filter function ───────────────────────────────────────────
  function applyFilters(items: Opportunity[]): Opportunity[] {
    return items.filter((o) => {
      if (search) {
        const q = search.toLowerCase()
        if (!o.title.toLowerCase().includes(q) && !o.client?.name.toLowerCase().includes(q) && !(o.contactName ?? '').toLowerCase().includes(q)) return false
      }
      if (fStage   && o.status      !== fStage)  return false
      if (fProb    && !matchProb(o.probability, fProb)) return false
      if (fSource  && o.leadSource  !== fSource) return false
      if (fValue   && !matchValue(o.value, fValue)) return false
      if (fAssigned) {
        if (!(o.assignedTo ?? '').toLowerCase().includes(fAssigned.toLowerCase())) return false
      }
      return true
    })
  }

  // All unique assignees for dropdown
  const assignees = useMemo(() => {
    const all = rawList.map((o) => o.assignedTo).filter(Boolean) as string[]
    return [...new Set(all)].sort()
  }, [rawList])

  // All unique lead sources present in data
  const sources = useMemo(() => {
    const all = rawList.map((o) => o.leadSource).filter(Boolean) as string[]
    return [...new Set(all)]
  }, [rawList])

  const filteredList = useMemo(() => applyFilters(rawList), [rawList, search, fStage, fProb, fSource, fValue, fAssigned])

  const totalPipeline = analyticsData?.totalPipeline ?? 0

  const kpis = [
    { label: 'Pipeline activo',     value: formatCurrency(analyticsData?.totalPipeline    ?? 0), icon: TrendingUp, sub: 'excluyendo perdidos' },
    { label: 'Pronóstico ponderado', value: formatCurrency(analyticsData?.weightedForecast ?? 0), icon: Target,     sub: 'por probabilidad' },
    { label: 'Ganado este mes',      value: formatCurrency(analyticsData?.wonThisMonth     ?? 0), icon: Award,      sub: 'deals cerrados' },
    { label: 'Win rate (90d)',        value: `${analyticsData?.winRate ?? 0}%`,                    icon: Users,      sub: 'ganados vs perdidos' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="CRM"
        subtitle={`Pipeline de ventas · ${formatCurrency(totalPipeline)} en pipeline`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* BU filter */}
            <div className="flex items-center rounded-lg border border-gray-200 p-0.5 bg-white">
              {(['ALL', 'HAX', 'KODER'] as BuFilter[]).map((u) => (
                <button key={u} onClick={() => setBuFilter(u)}
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
                <button key={v} onClick={() => setView(v)}
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

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <Card padding="sm">
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 shrink-0" />

          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar oportunidad o cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-7 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white placeholder-gray-400"
            />
          </div>

          {/* Stage */}
          <div className="relative">
            <select value={fStage} onChange={(e) => setFStage(e.target.value)} className={selectCls}>
              <option value="">Todas las etapas</option>
              {STAGES.map((s) => <option key={s.status} value={s.status}>{s.label}</option>)}
            </select>
          </div>

          {/* Probability */}
          <div className="relative">
            <select value={fProb} onChange={(e) => setFProb(e.target.value)} className={selectCls}>
              <option value="">Todas las prob.</option>
              {PROB_RANGES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {/* Value range */}
          <div className="relative">
            <select value={fValue} onChange={(e) => setFValue(e.target.value)} className={selectCls}>
              <option value="">Todos los valores</option>
              {VALUE_RANGES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>

          {/* Lead source */}
          {sources.length > 0 && (
            <div className="relative">
              <select value={fSource} onChange={(e) => setFSource(e.target.value)} className={selectCls}>
                <option value="">Todos los orígenes</option>
                {sources.map((s) => (
                  <option key={s} value={s}>{LEAD_SOURCE_LABELS[s] ?? s}</option>
                ))}
              </select>
            </div>
          )}

          {/* Assigned to */}
          {assignees.length > 0 && (
            <div className="relative">
              <select value={fAssigned} onChange={(e) => setFAssigned(e.target.value)} className={selectCls}>
                <option value="">Todos los asignados</option>
                {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          {/* Clear */}
          {activeCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 h-8 px-2.5 text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
              Limpiar ({activeCount})
            </button>
          )}
        </div>
      </Card>

      {/* ── Kanban / List ──────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-56 shrink-0 rounded-xl" />)}
        </div>
      ) : view === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const raw: Opportunity[] = pipeline[stage.status]?.items ?? []
            const items = applyFilters(raw)
            const stageValue = items.reduce((s, o) => s + (o.value ?? 0), 0)
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
                  {items.length === 0 && activeCount > 0 && (
                    <p className="text-xs text-gray-300 text-center py-4">Sin resultados</p>
                  )}
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
          {filteredList.length === 0 ? (
            <EmptyState icon={<TrendingUp className="w-5 h-5" />}
              title={activeCount > 0 ? 'Sin resultados' : 'No hay oportunidades'}
              description={activeCount > 0 ? 'Intenta cambiar los filtros activos.' : 'Crea la primera oportunidad en el pipeline.'}
              action={activeCount > 0
                ? <Button variant="secondary" size="sm" onClick={clearFilters}>Limpiar filtros</Button>
                : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Oportunidad', 'Cliente', 'Etapa', 'Valor', 'Prob.', 'Origen', 'Asignado', 'Creado', ''].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((opp) => {
                    const stage = STAGES.find((s) => s.status === opp.status)!
                    return (
                      <tr key={opp.id}
                        className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/crm/${opp.id}`)}
                      >
                        <td className="px-3 py-3 text-xs font-medium text-gray-800 max-w-[180px] truncate">{opp.title}</td>
                        <td className="px-3 py-3 text-xs text-gray-500 max-w-[130px] truncate">{opp.client?.name}</td>
                        <td className="px-3 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', stage.color)}>
                            {stage.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold text-gray-800">
                          {opp.value ? formatCurrency(opp.value) : '—'}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">{opp.probability}%</td>
                        <td className="px-3 py-3 text-xs text-gray-400">
                          {opp.leadSource ? (LEAD_SOURCE_LABELS[opp.leadSource] ?? opp.leadSource) : '—'}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400 max-w-[100px] truncate">
                          {opp.assignedTo ?? '—'}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-400">{formatDate(opp.createdAt)}</td>
                        <td className="px-3 py-3 text-xs text-gray-400">→</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 px-3 py-2 border-t border-gray-50">
                {filteredList.length} resultado{filteredList.length !== 1 ? 's' : ''}
                {activeCount > 0 ? ` · ${activeCount} filtro${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''}` : ''}
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
