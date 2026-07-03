'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, TrendingUp, Users, Target, Award,
  Search, X, SlidersHorizontal, Download, ChevronDown,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDroppable,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'

type LeadStatus = 'LEAD' | 'CONTACT' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST'
type BuFilter = 'ALL' | 'HAX' | 'KODER' | 'ALDIA'

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
  businessUnit: 'HAX' | 'KODER' | 'ALDIA'
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
  COLD_OUTREACH: 'Prospección fría', REFERRAL: 'Referido', INBOUND: 'Inbound',
  SOCIAL_MEDIA: 'Redes sociales', EVENT: 'Evento', REPEAT: 'Recurrente',
}

const PROB_RANGES = [
  { label: 'Alta (≥15%)', value: 'high' },
  { label: 'Media (10%)', value: 'medium' },
  { label: 'Baja (≤5%)',  value: 'low' },
]

const VALUE_RANGES = [
  { label: '< DOP 60k',       value: 'xs' },
  { label: 'DOP 60k – 100k',  value: 'sm' },
  { label: 'DOP 100k – 180k', value: 'md' },
  { label: '> DOP 180k',      value: 'lg' },
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

const selectCls = 'h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#293c4f] cursor-pointer'

// ── Draggable card ──────────────────────────────────────────────────────────
function KanbanCard({ opp, onNavigate }: { opp: Opportunity; onNavigate: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opp.id })
  const style = transform ? { transform: `translate(${transform.x}px,${transform.y}px)`, zIndex: 50 } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onNavigate(opp.id)}
      className={cn(
        'bg-white rounded-lg border border-gray-100 p-3 shadow-sm cursor-grab active:cursor-grabbing',
        'hover:border-[#293c4f]/30 hover:shadow-md transition-all select-none',
        isDragging && 'opacity-40',
      )}
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
  )
}

// ── Droppable column ────────────────────────────────────────────────────────
function KanbanColumn({ stage, items, onNavigate, activeId }: {
  stage: typeof STAGES[number]
  items: Opportunity[]
  onNavigate: (id: string) => void
  activeId: string | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.status })
  const stageValue = items.reduce((s, o) => s + (o.value ?? 0), 0)

  return (
    <div className="shrink-0 w-60">
      <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-xl border', stage.color)}>
        <span className="text-xs font-semibold">{stage.label}</span>
        <span className="text-xs opacity-60">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-b-xl min-h-[180px] p-2 space-y-2 border border-t-0 transition-colors',
          isOver ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100',
        )}
      >
        {items.map((opp) => (
          <KanbanCard key={opp.id} opp={opp} onNavigate={onNavigate} />
        ))}
        {items.length === 0 && activeId && (
          <div className="h-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-300">Soltar aquí</span>
          </div>
        )}
        {stageValue > 0 && (
          <p className="text-xs text-gray-400 text-right px-1 pt-1">{formatCurrency(stageValue)}</p>
        )}
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function CrmPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [view, setView]         = useState<'kanban' | 'list'>('kanban')
  const [buFilter, setBuFilter] = useState<BuFilter>('ALL')
  const [activeId, setActiveId] = useState<string | null>(null)

  // Filters
  const [search,    setSearch]    = useState('')
  const [fStage,    setFStage]    = useState('')
  const [fProb,     setFProb]     = useState('')
  const [fSource,   setFSource]   = useState('')
  const [fValue,    setFValue]    = useState('')
  const [fAssigned, setFAssigned] = useState('')

  // Multi-select (list view)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkAssignName, setBulkAssignName] = useState('')

  const activeCount = [search, fStage, fProb, fSource, fValue, fAssigned].filter(Boolean).length
  function clearFilters() {
    setSearch(''); setFStage(''); setFProb(''); setFSource(''); setFValue(''); setFAssigned('')
    setSelected(new Set())
  }

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

  // Mutations
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      api.patch(`/crm/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-pipeline', buFilter] })
      qc.invalidateQueries({ queryKey: ['crm-analytics', buFilter] })
    },
  })

  const bulkStatus = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: LeadStatus }) =>
      api.patch('/crm/bulk/status', { ids, status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm-list'] })
      qc.invalidateQueries({ queryKey: ['crm-analytics'] })
      setSelected(new Set())
      setBulkStatusOpen(false)
    },
  })

  const bulkAssign = useMutation({
    mutationFn: ({ ids, assignedTo }: { ids: string[]; assignedTo: string }) =>
      api.patch('/crm/bulk/assign', { ids, assignedTo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-list'] })
      setSelected(new Set())
      setBulkAssignOpen(false)
      setBulkAssignName('')
    },
  })

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as string) }
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over || active.id === over.id) return
    const newStatus = over.id as LeadStatus
    if (!STAGES.find((s) => s.status === newStatus)) return
    updateStatus.mutate({ id: active.id as string, status: newStatus })
  }

  // Active opp for drag overlay
  const activeOpp = useMemo(() => {
    if (!activeId) return null
    for (const stage of STAGES) {
      const items = pipeline[stage.status]?.items ?? []
      const found = items.find((o) => o.id === activeId)
      if (found) return found
    }
    return null
  }, [activeId, pipeline])

  // Filter function
  function applyFilters(items: Opportunity[]): Opportunity[] {
    return items.filter((o) => {
      if (search) {
        const q = search.toLowerCase()
        if (!o.title.toLowerCase().includes(q) && !o.client?.name.toLowerCase().includes(q) && !(o.contactName ?? '').toLowerCase().includes(q)) return false
      }
      if (fStage   && o.status !== fStage)          return false
      if (fProb    && !matchProb(o.probability, fProb)) return false
      if (fSource  && o.leadSource !== fSource)     return false
      if (fValue   && !matchValue(o.value, fValue)) return false
      if (fAssigned && !(o.assignedTo ?? '').toLowerCase().includes(fAssigned.toLowerCase())) return false
      return true
    })
  }

  const assignees = useMemo(() => [...new Set(rawList.map((o) => o.assignedTo).filter(Boolean) as string[])].sort(), [rawList])
  const sources   = useMemo(() => [...new Set(rawList.map((o) => o.leadSource).filter(Boolean) as string[])], [rawList])
  const filteredList = useMemo(() => applyFilters(rawList), [rawList, search, fStage, fProb, fSource, fValue, fAssigned])

  // Selection helpers
  function toggleRow(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected(selected.size === filteredList.length ? new Set() : new Set(filteredList.map((o) => o.id)))
  }

  // Export
  function handleExport() {
    const q = [buParam, fStage ? `status=${fStage}` : '', fSource ? `leadSource=${fSource}` : ''].filter(Boolean).join('&')
    window.open(`/api/crm/export/csv${q ? '?' + q : ''}`, '_blank')
  }

  const kpis = [
    { label: 'Pipeline activo',      value: formatCurrency(analyticsData?.totalPipeline    ?? 0), icon: TrendingUp, sub: 'excluyendo perdidos' },
    { label: 'Pronóstico ponderado', value: formatCurrency(analyticsData?.weightedForecast ?? 0), icon: Target,     sub: 'por probabilidad' },
    { label: 'Ganado este mes',       value: formatCurrency(analyticsData?.wonThisMonth     ?? 0), icon: Award,      sub: 'deals cerrados' },
    { label: 'Win rate (90d)',         value: `${analyticsData?.winRate ?? 0}%`,                   icon: Users,      sub: 'ganados vs perdidos' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="CRM"
        subtitle={`Pipeline · ${formatCurrency(analyticsData?.totalPipeline ?? 0)} activo`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-lg border border-gray-200 p-0.5 bg-white">
              {(['ALL', 'HAX', 'KODER', 'ALDIA'] as BuFilter[]).map((u) => (
                <button key={u} onClick={() => setBuFilter(u)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                    buFilter === u ? 'bg-[#293c4f] text-white' : 'text-gray-500 hover:text-gray-700'
                  )}
                >{u === 'ALL' ? 'All' : u}</button>
              ))}
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['kanban', 'list'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cn('px-3 py-1.5 text-xs font-medium transition-colors',
                    view === v ? 'bg-[#293c4f] text-white' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >{v === 'kanban' ? 'Kanban' : 'Lista'}</button>
              ))}
            </div>
            <Button variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
              CSV
            </Button>
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

      {/* Filter bar */}
      <Card padding="sm">
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input type="text" placeholder="Buscar oportunidad o cliente…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-7 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f] placeholder-gray-400"
            />
          </div>
          <select value={fStage} onChange={(e) => setFStage(e.target.value)} className={selectCls}>
            <option value="">Todas las etapas</option>
            {STAGES.map((s) => <option key={s.status} value={s.status}>{s.label}</option>)}
          </select>
          <select value={fProb} onChange={(e) => setFProb(e.target.value)} className={selectCls}>
            <option value="">Todas las prob.</option>
            {PROB_RANGES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={fValue} onChange={(e) => setFValue(e.target.value)} className={selectCls}>
            <option value="">Todos los valores</option>
            {VALUE_RANGES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
          {sources.length > 0 && (
            <select value={fSource} onChange={(e) => setFSource(e.target.value)} className={selectCls}>
              <option value="">Todos los orígenes</option>
              {sources.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABELS[s] ?? s}</option>)}
            </select>
          )}
          {assignees.length > 0 && (
            <select value={fAssigned} onChange={(e) => setFAssigned(e.target.value)} className={selectCls}>
              <option value="">Todos los asignados</option>
              {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          {activeCount > 0 && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 h-8 px-2.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <X className="w-3 h-3" /> Limpiar ({activeCount})
            </button>
          )}
        </div>
      </Card>

      {/* Kanban / List */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-56 shrink-0 rounded-xl" />)}
        </div>
      ) : view === 'kanban' ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const raw: Opportunity[] = pipeline[stage.status]?.items ?? []
              const items = applyFilters(raw)
              return <KanbanColumn key={stage.status} stage={stage} items={items} onNavigate={(id) => router.push(`/dashboard/crm/${id}`)} activeId={activeId} />
            })}
          </div>
          <DragOverlay>
            {activeOpp && (
              <div className="bg-white rounded-lg border border-[#293c4f]/30 p-3 shadow-xl w-56 opacity-95">
                <p className="text-xs font-semibold text-gray-800 truncate">{activeOpp.title}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{activeOpp.client?.name}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <>
          <Card padding="sm">
            {filteredList.length === 0 ? (
              <EmptyState icon={<TrendingUp className="w-5 h-5" />}
                title={activeCount > 0 ? 'Sin resultados' : 'No hay oportunidades'}
                description={activeCount > 0 ? 'Intenta cambiar los filtros.' : 'Crea la primera oportunidad.'}
                action={activeCount > 0 ? <Button variant="secondary" size="sm" onClick={clearFilters}>Limpiar filtros</Button> : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[750px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-3 py-2.5 w-8">
                        <input type="checkbox" checked={selected.size === filteredList.length && filteredList.length > 0}
                          onChange={toggleAll}
                          className="rounded border-gray-300 text-[#293c4f] focus:ring-[#293c4f]"
                        />
                      </th>
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
                          className={cn('border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer',
                            selected.has(opp.id) && 'bg-blue-50/40'
                          )}
                          onClick={() => router.push(`/dashboard/crm/${opp.id}`)}
                        >
                          <td className="px-3 py-3 w-8" onClick={(e) => { e.stopPropagation(); toggleRow(opp.id) }}>
                            <input type="checkbox" checked={selected.has(opp.id)} onChange={() => toggleRow(opp.id)}
                              className="rounded border-gray-300 text-[#293c4f] focus:ring-[#293c4f]"
                            />
                          </td>
                          <td className="px-3 py-3 text-xs font-medium text-gray-800 max-w-[180px] truncate">{opp.title}</td>
                          <td className="px-3 py-3 text-xs text-gray-500 max-w-[130px] truncate">{opp.client?.name}</td>
                          <td className="px-3 py-3">
                            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', stage.color)}>{stage.label}</span>
                          </td>
                          <td className="px-3 py-3 text-xs font-semibold text-gray-800">{opp.value ? formatCurrency(opp.value) : '—'}</td>
                          <td className="px-3 py-3 text-xs text-gray-500">{opp.probability}%</td>
                          <td className="px-3 py-3 text-xs text-gray-400">{opp.leadSource ? (LEAD_SOURCE_LABELS[opp.leadSource] ?? opp.leadSource) : '—'}</td>
                          <td className="px-3 py-3 text-xs text-gray-400 max-w-[100px] truncate">{opp.assignedTo ?? '—'}</td>
                          <td className="px-3 py-3 text-xs text-gray-400">{formatDate(opp.createdAt)}</td>
                          <td className="px-3 py-3 text-xs text-gray-400">→</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 px-3 py-2 border-t border-gray-50">
                  {filteredList.length} resultado{filteredList.length !== 1 ? 's' : ''}
                  {activeCount > 0 && ` · ${activeCount} filtro${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''}`}
                </p>
              </div>
            )}
          </Card>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#293c4f] text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium">{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</span>
              <div className="w-px h-4 bg-white/20" />

              {/* Bulk status */}
              <div className="relative">
                <button onClick={() => { setBulkStatusOpen(!bulkStatusOpen); setBulkAssignOpen(false) }}
                  className="flex items-center gap-1.5 text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Cambiar etapa <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {bulkStatusOpen && (
                  <div className="absolute bottom-full mb-2 left-0 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px]">
                    {STAGES.map((s) => (
                      <button key={s.status}
                        onClick={() => bulkStatus.mutate({ ids: [...selected], status: s.status })}
                        className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 transition-colors"
                      >{s.label}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bulk assign */}
              <div className="relative">
                <button onClick={() => { setBulkAssignOpen(!bulkAssignOpen); setBulkStatusOpen(false) }}
                  className="flex items-center gap-1.5 text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Asignar a <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {bulkAssignOpen && (
                  <div className="absolute bottom-full mb-2 left-0 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 p-3 min-w-[200px]">
                    <input type="text" value={bulkAssignName} onChange={(e) => setBulkAssignName(e.target.value)}
                      placeholder="Nombre del responsable"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
                    />
                    {assignees.length > 0 && assignees.map((a) => (
                      <button key={a} onClick={() => setBulkAssignName(a)}
                        className="block w-full text-left px-2 py-1 text-xs hover:bg-gray-50 rounded transition-colors"
                      >{a}</button>
                    ))}
                    <button
                      disabled={!bulkAssignName.trim() || bulkAssign.isPending}
                      onClick={() => bulkAssign.mutate({ ids: [...selected], assignedTo: bulkAssignName.trim() })}
                      className="mt-2 w-full bg-[#293c4f] text-white text-xs rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-[#1e2d3b] transition-colors"
                    >Asignar</button>
                  </div>
                )}
              </div>

              <button onClick={() => setSelected(new Set())}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
