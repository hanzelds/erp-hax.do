'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, X, Phone, Mail, Calendar, CheckCircle2,
  Circle, FileText, TrendingUp, Edit2, Save, ExternalLink, Trash2,
} from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button, Card, Skeleton, Select } from '@/components/ui'

type LeadStatus = 'LEAD' | 'CONTACT' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST'
type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE'

interface Activity {
  id: string
  type: ActivityType
  title: string
  description?: string
  dueDate?: string
  completedAt?: string
  createdBy: string
  createdAt: string
}

interface Opportunity {
  id: string
  title: string
  clientId: string | null
  client?: { id: string; name: string; email?: string; phone?: string; rnc?: string } | null
  description?: string
  value?: number
  probability: number
  expectedDate?: string
  status: LeadStatus
  businessUnit: 'HAX' | 'KODER' | 'ALDIA'
  assignedTo?: string
  leadSource?: string
  contactName?: string
  contactPhone?: string
  notes?: string
  closedAt?: string
  closedReason?: string
  createdAt: string
  activities: Activity[]
  quotes: any[]
}

const STAGES: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'LEAD',        label: 'Lead',        color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { status: 'CONTACT',     label: 'Contactado',  color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { status: 'PROPOSAL',    label: 'Propuesta',   color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { status: 'NEGOTIATION', label: 'Negociación', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { status: 'CLOSED_WON',  label: 'Ganado',      color: 'bg-green-50 text-green-700 border-green-200' },
  { status: 'CLOSED_LOST', label: 'Perdido',     color: 'bg-red-50 text-red-600 border-red-200' },
]

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  CALL:    <Phone className="w-3.5 h-3.5" />,
  EMAIL:   <Mail className="w-3.5 h-3.5" />,
  MEETING: <Calendar className="w-3.5 h-3.5" />,
  TASK:    <CheckCircle2 className="w-3.5 h-3.5" />,
  NOTE:    <FileText className="w-3.5 h-3.5" />,
}

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  CALL: 'Llamada', EMAIL: 'Email', MEETING: 'Reunión', TASK: 'Tarea', NOTE: 'Nota',
}

const LEAD_SOURCE_LABELS: Record<string, string> = {
  REFERRAL: 'Referido', COLD_OUTREACH: 'Prospección', INBOUND: 'Llegó solo',
  SOCIAL_MEDIA: 'Redes sociales', EVENT: 'Evento', REPEAT: 'Cliente recurrente',
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', SENT: 'Enviada', ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada', EXPIRED: 'Expirada', CONVERTED: 'Convertida',
}

const QUOTE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-50 text-blue-700',
  ACCEPTED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-600',
  EXPIRED: 'bg-yellow-50 text-yellow-700',
  CONVERTED: 'bg-purple-50 text-purple-700',
}

const NEW_ACTIVITY = { type: 'CALL' as ActivityType, title: '', description: '', dueDate: '', createdBy: '' }

export default function CrmDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const [editingFields, setEditingFields] = useState(false)
  const [fieldDraft, setFieldDraft] = useState<any>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [actDraft, setActDraft] = useState({ ...NEW_ACTIVITY })
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: opp, isLoading } = useQuery<Opportunity>({
    queryKey: ['crm-opp', id],
    queryFn: async () => {
      const { data } = await api.get(`/crm/${id}`)
      return data.data ?? data
    },
  })

  const { data: activities = [], refetch: refetchActivities } = useQuery<Activity[]>({
    queryKey: ['crm-activities', id],
    queryFn: async () => {
      const { data } = await api.get(`/crm/${id}/activities`)
      return data.data ?? data
    },
    enabled: !!opp,
  })

  const updateOpp = useMutation({
    mutationFn: (data: any) => api.patch(`/crm/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-opp', id] })
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm-analytics'] })
      setEditingFields(false)
    },
  })

  const addActivity = useMutation({
    mutationFn: (data: any) => api.post(`/crm/${id}/activities`, data),
    onSuccess: () => { refetchActivities(); setShowActivityForm(false); setActDraft({ ...NEW_ACTIVITY }) },
  })

  const toggleActivity = useMutation({
    mutationFn: ({ actId, completed }: { actId: string; completed: boolean }) =>
      api.patch(`/crm/${id}/activities/${actId}`, { completed }),
    onSuccess: () => refetchActivities(),
  })

  const deleteActivity = useMutation({
    mutationFn: (actId: string) => api.delete(`/crm/${id}/activities/${actId}`),
    onSuccess: () => refetchActivities(),
  })

  const deleteOpp = useMutation({
    mutationFn: () => api.delete(`/crm/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] })
      router.push('/dashboard/crm')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4"><Skeleton className="h-48" /><Skeleton className="h-32" /></div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!opp) return <div className="p-8 text-gray-500">Oportunidad no encontrada.</div>

  const currentStageIdx = STAGES.findIndex((s) => s.status === opp.status)
  const currentStage = STAGES[currentStageIdx]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/crm')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{opp.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {opp.client && opp.clientId ? (
                <>
                  <Link href={`/dashboard/clients/${opp.clientId}`} className="text-sm text-[#293c4f] hover:underline font-medium flex items-center gap-1">
                    {opp.client.name} <ExternalLink className="w-3 h-3" />
                  </Link>
                  <span className="text-gray-300">·</span>
                </>
              ) : null}
              <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                opp.businessUnit === 'HAX' ? 'bg-[#eef1f4] text-[#293c4f]' : 'bg-slate-100 text-slate-600'
              )}>{opp.businessUnit}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(opp.value ?? 0) > 0 && (
            <span className="text-lg font-bold text-gray-900">{formatCurrency(opp.value!)}</span>
          )}
          <span className={cn('px-3 py-1 rounded-full text-xs font-semibold border', currentStage?.color)}>
            {currentStage?.label}
          </span>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
              <span className="text-xs text-red-700 font-medium">¿Eliminar?</span>
              <button
                onClick={() => deleteOpp.mutate()}
                disabled={deleteOpp.isPending}
                className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
              >
                {deleteOpp.isPending ? '...' : 'Sí'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-red-500 hover:text-red-700 px-1"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar oportunidad"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stage progress bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STAGES.map((s, i) => (
          <button
            key={s.status}
            onClick={() => updateOpp.mutate({ status: s.status })}
            disabled={updateOpp.isPending}
            className={cn(
              'flex-1 min-w-[80px] py-2 px-2 text-xs font-medium rounded-lg border transition-all text-center',
              s.status === opp.status
                ? s.color + ' font-semibold'
                : i < currentStageIdx
                  ? 'bg-gray-100 text-gray-400 border-gray-100'
                  : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left col — details + quotes */}
        <div className="lg:col-span-2 space-y-4">
          {/* Details card */}
          <Card padding="sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Detalles</h3>
              {!editingFields ? (
                <button
                  onClick={() => { setEditingFields(true); setFieldDraft({
                    value: opp.value ?? '',
                    probability: opp.probability,
                    expectedDate: opp.expectedDate?.substring(0, 10) ?? '',
                    assignedTo: opp.assignedTo ?? '',
                    contactName: opp.contactName ?? '',
                    contactPhone: opp.contactPhone ?? '',
                    description: opp.description ?? '',
                    closedReason: opp.closedReason ?? '',
                  }) }}
                  className="text-xs text-[#293c4f] hover:underline flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditingFields(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                  <button
                    onClick={() => updateOpp.mutate(fieldDraft)}
                    className="text-xs text-[#293c4f] font-medium hover:underline flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" /> Guardar
                  </button>
                </div>
              )}
            </div>

            {!editingFields ? (
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                <Detail label="Valor" value={(opp.value ?? 0) > 0 ? formatCurrency(opp.value!) : '—'} />
                <Detail label="Probabilidad" value={`${opp.probability}%`} />
                <Detail label="Cierre esperado" value={opp.expectedDate ? formatDate(opp.expectedDate) : '—'} />
                <Detail label="Asignado a" value={opp.assignedTo || '—'} />
                <Detail label="Persona de contacto" value={opp.contactName || '—'} />
                <Detail label="Teléfono contacto" value={opp.contactPhone || '—'} />
                <Detail label="Origen" value={opp.leadSource ? LEAD_SOURCE_LABELS[opp.leadSource] : '—'} />
                <Detail label="Creado" value={formatDate(opp.createdAt)} />
                {opp.closedAt && <Detail label="Cerrado" value={formatDate(opp.closedAt)} />}
              </dl>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <F label="Valor (DOP)">
                  <input type="number" value={fieldDraft.value} onChange={(e) => setFieldDraft({ ...fieldDraft, value: parseFloat(e.target.value) || 0 })} className={ic} />
                </F>
                <F label="Probabilidad (%)">
                  <input type="number" min="0" max="100" value={fieldDraft.probability} onChange={(e) => setFieldDraft({ ...fieldDraft, probability: parseInt(e.target.value) || 0 })} className={ic} />
                </F>
                <F label="Cierre esperado">
                  <input type="date" value={fieldDraft.expectedDate} onChange={(e) => setFieldDraft({ ...fieldDraft, expectedDate: e.target.value })} className={ic} />
                </F>
                <F label="Asignado a">
                  <input type="text" value={fieldDraft.assignedTo} onChange={(e) => setFieldDraft({ ...fieldDraft, assignedTo: e.target.value })} className={ic} />
                </F>
                <F label="Persona de contacto">
                  <input type="text" value={fieldDraft.contactName} onChange={(e) => setFieldDraft({ ...fieldDraft, contactName: e.target.value })} className={ic} />
                </F>
                <F label="Teléfono contacto">
                  <input type="text" value={fieldDraft.contactPhone} onChange={(e) => setFieldDraft({ ...fieldDraft, contactPhone: e.target.value })} className={ic} />
                </F>
                <div className="col-span-2">
                  <F label="Descripción">
                    <textarea value={fieldDraft.description} rows={2} onChange={(e) => setFieldDraft({ ...fieldDraft, description: e.target.value })} className={cn(ic, 'resize-none')} />
                  </F>
                </div>
                {(opp.status === 'CLOSED_WON' || opp.status === 'CLOSED_LOST') && (
                  <div className="col-span-2">
                    <F label="Motivo de cierre">
                      <input type="text" value={fieldDraft.closedReason} onChange={(e) => setFieldDraft({ ...fieldDraft, closedReason: e.target.value })} className={ic} />
                    </F>
                  </div>
                )}
              </div>
            )}

            {opp.description && !editingFields && (
              <p className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">{opp.description}</p>
            )}
          </Card>

          {/* Notes */}
          <Card padding="sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Notas internas</h3>
              {!editingNotes ? (
                <button
                  onClick={() => { setEditingNotes(true); setNotesDraft(opp.notes ?? '') }}
                  className="text-xs text-[#293c4f] hover:underline flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditingNotes(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                  <button
                    onClick={() => { updateOpp.mutate({ notes: notesDraft }); setEditingNotes(false) }}
                    className="text-xs text-[#293c4f] font-medium hover:underline flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" /> Guardar
                  </button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={4}
                placeholder="Notas del equipo, contexto interno, acuerdos verbales…"
                className={cn(ic, 'resize-none w-full')}
              />
            ) : opp.notes ? (
              <p className="text-sm text-gray-600 whitespace-pre-line">{opp.notes}</p>
            ) : (
              <p className="text-xs text-gray-400 italic">Sin notas. Haz click en Editar para añadir.</p>
            )}
          </Card>

          {/* Quotes linked */}
          <Card padding="sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Cotizaciones vinculadas</h3>
              <Link
                href={`/dashboard/quotes?open=new&opportunityId=${opp.id}${opp.clientId ? `&clientId=${opp.clientId}` : ''}`}
                className="text-xs text-[#293c4f] hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva cotización
              </Link>
            </div>
            {opp.quotes.length === 0 ? (
              <p className="text-xs text-gray-400 py-3">Sin cotizaciones aún.</p>
            ) : (
              <div className="space-y-2">
                {opp.quotes.map((q: any) => (
                  <Link
                    key={q.id}
                    href={`/dashboard/quotes/${q.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-[#293c4f]/20 hover:bg-gray-50 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 group-hover:text-[#293c4f] transition-colors" />
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{q.number}</p>
                        <p className="text-xs text-gray-400">{formatDate(q.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-gray-800">{formatCurrency(q.total)}</span>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', QUOTE_STATUS_COLORS[q.status] ?? 'bg-gray-100 text-gray-600')}>
                        {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right col — activities */}
        <div className="space-y-4">
          <Card padding="sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Actividades</h3>
              <button
                onClick={() => setShowActivityForm(!showActivityForm)}
                className="text-xs text-[#293c4f] hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Nueva
              </button>
            </div>

            {showActivityForm && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                <F label="Tipo">
                  <Select value={actDraft.type} onChange={(e: any) => setActDraft({ ...actDraft, type: e.target.value })} className={ic}>
                    {Object.entries(ACTIVITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </F>
                <F label="Título *">
                  <input type="text" value={actDraft.title} placeholder="Ej: Llamada de seguimiento"
                    onChange={(e) => setActDraft({ ...actDraft, title: e.target.value })} className={ic} />
                </F>
                <F label="Descripción">
                  <textarea value={actDraft.description} rows={2} placeholder="Notas..."
                    onChange={(e) => setActDraft({ ...actDraft, description: e.target.value })}
                    className={cn(ic, 'resize-none')} />
                </F>
                <div className="grid grid-cols-2 gap-2">
                  <F label="Fecha límite">
                    <input type="date" value={actDraft.dueDate}
                      onChange={(e) => setActDraft({ ...actDraft, dueDate: e.target.value })} className={ic} />
                  </F>
                  <F label="Creado por">
                    <input type="text" value={actDraft.createdBy} placeholder="Tu nombre"
                      onChange={(e) => setActDraft({ ...actDraft, createdBy: e.target.value })} className={ic} />
                  </F>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setShowActivityForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                  <Button variant="primary" size="sm" loading={addActivity.isPending}
                    disabled={!actDraft.title}
                    onClick={() => addActivity.mutate(actDraft)}
                  >Guardar</Button>
                </div>
              </div>
            )}

            {activities.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">Sin actividades registradas.</p>
            ) : (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div key={act.id} className="flex gap-3 group">
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                      act.completedAt ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                    )}>
                      {act.completedAt
                        ? <CheckCircle2 className="w-4 h-4" />
                        : ACTIVITY_ICONS[act.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={cn('text-xs font-semibold', act.completedAt ? 'text-gray-400 line-through' : 'text-gray-800')}>
                            {act.title}
                          </p>
                          <p className="text-xs text-gray-400">
                            {ACTIVITY_LABELS[act.type]} · {formatDate(act.createdAt)}
                            {act.createdBy && ` · ${act.createdBy}`}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!act.completedAt && (
                            <button
                              onClick={() => toggleActivity.mutate({ actId: act.id, completed: true })}
                              className="text-green-500 hover:text-green-700 transition-colors"
                              title="Marcar completada"
                            >
                              <Circle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteActivity.mutate(act.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                            title="Eliminar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {act.description && (
                        <p className="text-xs text-gray-500 mt-1">{act.description}</p>
                      )}
                      {act.dueDate && !act.completedAt && (
                        <p className={cn('text-xs mt-1', new Date(act.dueDate) < new Date() ? 'text-red-500' : 'text-gray-400')}>
                          Límite: {formatDate(act.dueDate)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick info card */}
          <Card padding="sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Cliente</h3>
            {opp.client && opp.clientId ? (
              <>
                <dl className="space-y-2">
                  <Detail label="Empresa" value={opp.client.name} />
                  {opp.client.rnc && <Detail label="RNC" value={opp.client.rnc} />}
                  {opp.client.email && <Detail label="Email" value={opp.client.email} />}
                  {opp.client.phone && <Detail label="Teléfono" value={opp.client.phone} />}
                </dl>
                <Link href={`/dashboard/clients/${opp.clientId}`}
                  className="mt-3 flex items-center gap-1 text-xs text-[#293c4f] hover:underline font-medium"
                >
                  Ver ficha completa <ExternalLink className="w-3 h-3" />
                </Link>
              </>
            ) : (
              <p className="text-xs text-gray-400 italic">Sin cliente asociado a esta oportunidad.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm font-medium text-gray-800 mt-0.5">{value}</dd>
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
