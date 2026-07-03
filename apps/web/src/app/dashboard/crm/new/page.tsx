'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Select } from '@/components/ui'

type LeadStatus = 'LEAD' | 'CONTACT' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST'

interface ClientResult { id: string; name: string; email?: string | null; rnc?: string | null }

interface OppForm {
  title:        string
  clientId:     string
  clientName:   string
  contactName:  string
  contactPhone: string
  description:  string
  value:        string
  probability:  string
  status:       LeadStatus
  businessUnit: 'HAX' | 'KODER' | 'ALDIA'
  leadSource:   string
  expectedDate: string
  assignedTo:   string
  notes:        string
}

function emptyForm(): OppForm {
  return {
    title: '', clientId: '', clientName: '',
    contactName: '', contactPhone: '', description: '',
    value: '', probability: '20',
    status: 'LEAD', businessUnit: 'HAX',
    leadSource: '', expectedDate: '', assignedTo: '', notes: '',
  }
}

const STAGES: { value: LeadStatus; label: string }[] = [
  { value: 'LEAD',        label: 'Lead' },
  { value: 'CONTACT',     label: 'Contactado' },
  { value: 'PROPOSAL',    label: 'Propuesta' },
  { value: 'NEGOTIATION', label: 'Negociación' },
  { value: 'CLOSED_WON',  label: 'Ganado' },
  { value: 'CLOSED_LOST', label: 'Perdido' },
]

const LEAD_SOURCES = [
  { value: 'REFERRAL',      label: 'Referido' },
  { value: 'COLD_OUTREACH', label: 'Prospección activa' },
  { value: 'INBOUND',       label: 'Llegó por iniciativa propia' },
  { value: 'SOCIAL_MEDIA',  label: 'Redes sociales' },
  { value: 'EVENT',         label: 'Evento / feria' },
  { value: 'REPEAT',        label: 'Cliente recurrente' },
]

const ic = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15 focus:border-[#293c4f] bg-white transition-colors'
const icErr = 'border-red-300 focus:ring-red-200 focus:border-red-400'

function F({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function toPayload(form: OppForm) {
  return {
    clientId:     form.clientId || null,
    title:        form.title.trim(),
    description:  form.description.trim() || null,
    value:        form.value ? parseFloat(form.value) : null,
    probability:  parseInt(form.probability) || 0,
    status:       form.status,
    businessUnit: form.businessUnit,
    leadSource:   form.leadSource || null,
    expectedDate: form.expectedDate || null,
    assignedTo:   form.assignedTo.trim() || null,
    contactName:  form.contactName.trim() || null,
    contactPhone: form.contactPhone.trim() || null,
    notes:        form.notes.trim() || null,
  }
}

function validateForm(form: OppForm): Partial<Record<keyof OppForm, string>> {
  const e: Partial<Record<keyof OppForm, string>> = {}
  if (!form.title.trim() || form.title.trim().length < 3) e.title = 'El título debe tener al menos 3 caracteres'
  if (form.value && isNaN(parseFloat(form.value))) e.value = 'Valor inválido'
  const prob = parseInt(form.probability)
  if (isNaN(prob) || prob < 0 || prob > 100) e.probability = 'Debe ser entre 0 y 100'
  return e
}

/** Client search/autocomplete — reused by the single form and each row in bulk mode */
function ClientPicker({
  clientId, clientName, onSelect, onClear, error,
}: {
  clientId: string
  clientName: string
  onSelect: (c: ClientResult) => void
  onClear: () => void
  error?: string
}) {
  const [clients, setClients]     = useState<ClientResult[]>([])
  const [searchQ, setSearchQ]     = useState(clientName)
  const [dropOpen, setDropOpen]   = useState(false)
  const [searching, setSearching] = useState(false)
  const dropRef                   = useRef<HTMLDivElement>(null)
  const searchTimer               = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (searchQ.length < 2 || clientId) { setClients([]); return }
    clearTimeout(searchTimer.current)
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/clients', { params: { search: searchQ, limit: 8 } })
        setClients(data.data ?? data)
        setDropOpen(true)
      } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [searchQ, clientId])

  function pick(c: ClientResult) {
    onSelect(c)
    setSearchQ(c.name)
    setDropOpen(false)
    setClients([])
  }

  function clear() {
    onClear()
    setSearchQ('')
    setClients([])
  }

  const selected = clientId ? { id: clientId, name: clientName } : null

  return (
    <F label="Cliente" error={error}>
      <div ref={dropRef} className="relative">
        <div className={cn(
          'w-full flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white transition-colors',
          error ? 'border-red-300' : dropOpen ? 'border-[#293c4f] ring-2 ring-[#293c4f]/10' : 'border-gray-200'
        )}>
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          {selected ? (
            <div className="flex items-center justify-between flex-1 gap-2">
              <span className="text-sm font-medium text-gray-800">{selected.name}</span>
              <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600 transition-colors text-xs underline">
                Cambiar
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); setDropOpen(true) }}
              placeholder="Buscar por nombre, RNC o email..."
              className="flex-1 text-sm bg-transparent focus:outline-none placeholder-gray-400"
              autoComplete="off"
            />
          )}
          {searching && <div className="w-4 h-4 border-2 border-[#293c4f] border-t-transparent rounded-full animate-spin shrink-0" />}
        </div>
        {dropOpen && clients.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {clients.map((c) => (
              <button key={c.id} type="button" onClick={() => pick(c)}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                <p className="text-sm font-medium text-gray-800">{c.name}</p>
                <p className="text-xs text-gray-400">{[c.rnc, c.email].filter(Boolean).join(' · ')}</p>
              </button>
            ))}
          </div>
        )}
        {dropOpen && searchQ.length >= 2 && !searching && clients.length === 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
            <p className="text-xs text-gray-500">No se encontraron clientes.</p>
            <a href="/dashboard/clients" target="_blank" className="text-xs text-[#293c4f] underline font-medium">Crear cliente →</a>
          </div>
        )}
      </div>
    </F>
  )
}

/** Full set of opportunity fields — reused by the single form and each bulk row */
function OpportunityFields({
  form, errors, onChange,
}: {
  form: OppForm
  errors: Partial<Record<keyof OppForm, string>>
  onChange: (field: keyof OppForm, value: string) => void
}) {
  return (
    <>
      <SubSection title="Cliente">
        <ClientPicker
          clientId={form.clientId}
          clientName={form.clientName}
          error={errors.clientId}
          onSelect={(c) => { onChange('clientId', c.id); onChange('clientName', c.name) }}
          onClear={() => { onChange('clientId', ''); onChange('clientName', '') }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F label="Persona de contacto">
            <input type="text" value={form.contactName} onChange={(e) => onChange('contactName', e.target.value)}
              placeholder="Nombre del contacto en la empresa" className={ic} />
          </F>
          <F label="Teléfono de contacto">
            <input type="tel" value={form.contactPhone} onChange={(e) => onChange('contactPhone', e.target.value)}
              placeholder="+1 (809) 000-0000" className={ic} />
          </F>
        </div>
      </SubSection>

      <SubSection title="La oportunidad">
        <F label="Título" required error={errors.title}>
          <input type="text" value={form.title} onChange={(e) => onChange('title', e.target.value)}
            placeholder="Ej: Rediseño de identidad corporativa"
            className={cn(ic, errors.title ? icErr : '')} />
        </F>
        <F label="Descripción">
          <textarea value={form.description} onChange={(e) => onChange('description', e.target.value)}
            placeholder="Describe brevemente el alcance o los requerimientos del cliente..."
            rows={3} className={cn(ic, 'resize-none')} />
        </F>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F label="Valor estimado (DOP)" error={errors.value}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">RD$</span>
              <input type="number" min="0" step="1000" value={form.value}
                onChange={(e) => onChange('value', e.target.value)}
                placeholder="0"
                className={cn(ic, 'pl-10', errors.value ? icErr : '')} />
            </div>
          </F>
          <F label="Probabilidad de cierre (%)" error={errors.probability}>
            <div className="relative">
              <input type="number" min="0" max="100" value={form.probability}
                onChange={(e) => onChange('probability', e.target.value)}
                className={cn(ic, 'pr-8', errors.probability ? icErr : '')} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
            </div>
          </F>
        </div>
      </SubSection>

      <SubSection title="Pipeline">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F label="Etapa inicial">
            <Select value={form.status} onChange={(e: any) => onChange('status', e.target.value)} className={ic}>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </F>
          <F label="Unidad de negocio" required>
            <Select value={form.businessUnit} onChange={(e: any) => onChange('businessUnit', e.target.value)} className={ic}>
              <option value="HAX">HAX Estudio Creativo</option>
              <option value="KODER">KODER</option>
              <option value="ALDIA">Al Dia ERP</option>
            </Select>
          </F>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <F label="Origen del lead">
            <Select value={form.leadSource} onChange={(e: any) => onChange('leadSource', e.target.value)} className={ic}>
              <option value="">— Seleccionar origen —</option>
              {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </F>
          <F label="Fecha de cierre esperado">
            <input type="date" value={form.expectedDate} onChange={(e) => onChange('expectedDate', e.target.value)} className={ic} />
          </F>
        </div>
        <F label="Asignado a">
          <input type="text" value={form.assignedTo} onChange={(e) => onChange('assignedTo', e.target.value)}
            placeholder="Nombre del responsable de esta oportunidad" className={ic} />
        </F>
      </SubSection>

      <SubSection title="Notas internas">
        <F label="Notas">
          <textarea value={form.notes} onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Condiciones especiales, contexto del cliente, próximos pasos..."
            rows={4} className={cn(ic, 'resize-none')} />
        </F>
      </SubSection>
    </>
  )
}

function BulkRow({
  index, form, errors, expanded, onToggle, onChange, onRemove, canRemove,
}: {
  index: number
  form: OppForm
  errors: Partial<Record<keyof OppForm, string>>
  expanded: boolean
  onToggle: () => void
  onChange: (field: keyof OppForm, value: string) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const hasErrors = Object.keys(errors).length > 0
  return (
    <div className={cn(
      'bg-white rounded-2xl border shadow-sm overflow-hidden',
      hasErrors ? 'border-red-200' : 'border-gray-100'
    )}>
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/60 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-6 h-6 rounded-full bg-[#293c4f]/10 text-[#293c4f] text-xs font-semibold flex items-center justify-center">
            {index + 1}
          </span>
          <div className="text-left min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {form.title.trim() || <span className="text-gray-400 italic">Lead sin título</span>}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {[form.clientName || 'Sin cliente', form.businessUnit, form.value ? `RD$${form.value}` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {hasErrors && <AlertCircle className="w-4 h-4 text-red-500" />}
          {canRemove && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemove() } }}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              aria-label="Eliminar fila"
            >
              <Trash2 className="w-4 h-4" />
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-6 pb-6 pt-1 space-y-5 border-t border-gray-50">
          <OpportunityFields form={form} errors={errors} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

export default function NewOpportunityPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const qc           = useQueryClient()

  const initClientId   = searchParams.get('clientId') ?? ''
  const initClientName = searchParams.get('clientName') ?? ''

  const [mode, setMode] = useState<'single' | 'bulk'>('single')

  // --- Single mode state ---
  const [form, setForm] = useState<OppForm>({
    ...emptyForm(), clientId: initClientId, clientName: initClientName,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof OppForm, string>>>({})

  function set(field: keyof OppForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validate(): boolean {
    const e = validateForm(form)
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/crm', toPayload(form))
      return data.data ?? data
    },
    onSuccess: (opp) => {
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm-analytics'] })
      qc.invalidateQueries({ queryKey: ['crm-list'] })
      router.push(`/dashboard/crm/${opp.id}`)
    },
  })

  function handleSingleSubmit() {
    if (!validate()) return
    create.mutate()
  }

  // --- Bulk mode state ---
  const [rows, setRows] = useState<OppForm[]>([{ ...emptyForm(), clientId: initClientId, clientName: initClientName }])
  const [rowErrors, setRowErrors] = useState<Record<number, Partial<Record<keyof OppForm, string>>>>({})
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set([0]))

  function addRow() {
    setRows(r => {
      const next = [...r, emptyForm()]
      setExpandedRows(prev => new Set(prev).add(next.length - 1))
      return next
    })
  }

  function removeRow(idx: number) {
    setRows(r => r.filter((_, i) => i !== idx))
    setRowErrors(e => {
      const next: typeof e = {}
      Object.entries(e).forEach(([k, v]) => {
        const i = parseInt(k)
        if (i < idx) next[i] = v
        else if (i > idx) next[i - 1] = v
      })
      return next
    })
    setExpandedRows(prev => {
      const next = new Set<number>()
      prev.forEach(i => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1) })
      return next
    })
  }

  function toggleRow(idx: number) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function setRowField(idx: number, field: keyof OppForm, value: string) {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row))
    setRowErrors(e => {
      if (!e[idx]?.[field]) return e
      return { ...e, [idx]: { ...e[idx], [field]: undefined } }
    })
  }

  function validateRows(): boolean {
    const allErrors: Record<number, Partial<Record<keyof OppForm, string>>> = {}
    let hasError = false
    rows.forEach((row, i) => {
      const e = validateForm(row)
      if (Object.keys(e).length > 0) {
        allErrors[i] = e
        hasError = true
      }
    })
    setRowErrors(allErrors)
    if (hasError) {
      const firstBad = Object.keys(allErrors).map(Number).sort((a, b) => a - b)[0]
      setExpandedRows(prev => new Set(prev).add(firstBad))
    }
    return !hasError
  }

  const bulkCreate = useMutation({
    mutationFn: async () => {
      const payload = rows.map(toPayload)
      const { data } = await api.post('/crm/bulk/create', { opportunities: payload })
      return data.data ?? data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm-analytics'] })
      qc.invalidateQueries({ queryKey: ['crm-list'] })
      router.push('/dashboard/crm')
    },
  })

  function handleBulkSubmit() {
    if (!validateRows()) return
    bulkCreate.mutate()
  }

  const isPending = mode === 'single' ? create.isPending : bulkCreate.isPending
  const isError   = mode === 'single' ? create.isError : bulkCreate.isError
  const errorMsg  = mode === 'single'
    ? (create.error as any)?.response?.data?.error
    : (bulkCreate.error as any)?.response?.data?.error

  function handleSubmit() {
    if (mode === 'single') handleSingleSubmit()
    else handleBulkSubmit()
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#f4f6f8]/95 backdrop-blur-sm border-b border-gray-200/60 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/crm')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">CRM</span>
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-sm font-semibold text-gray-800">Nueva oportunidad</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 bg-white">
            {(['single', 'bulk'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  mode === m ? 'bg-[#293c4f] text-white' : 'text-gray-500 hover:text-gray-800'
                )}
              >
                {m === 'single' ? 'Individual' : 'Agregar varios'}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/crm')}>Cancelar</Button>
          <Button variant="primary" size="sm" loading={isPending} onClick={handleSubmit}>
            {mode === 'single' ? 'Crear oportunidad' : `Crear ${rows.length} oportunidad${rows.length === 1 ? '' : 'es'}`}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg ?? 'Error al crear la(s) oportunidad(es)'}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4 pb-24">
        {mode === 'single' ? (
          <Section title="Nueva oportunidad" subtitle="Completa los datos del negocio">
            <OpportunityFields form={form} errors={errors} onChange={set} />
          </Section>
        ) : (
          <>
            {rows.map((row, i) => (
              <BulkRow
                key={i}
                index={i}
                form={row}
                errors={rowErrors[i] ?? {}}
                expanded={expandedRows.has(i)}
                onToggle={() => toggleRow(i)}
                onChange={(field, value) => setRowField(i, field, value)}
                onRemove={() => removeRow(i)}
                canRemove={rows.length > 1}
              />
            ))}
            <button
              type="button"
              onClick={addRow}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-500 hover:border-[#293c4f]/30 hover:text-[#293c4f] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar otro lead
            </button>
          </>
        )}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/crm')}>Cancelar</Button>
        <Button variant="primary" size="sm" loading={isPending} onClick={handleSubmit}>
          {mode === 'single' ? 'Crear oportunidad' : `Crear ${rows.length} oportunidad${rows.length === 1 ? '' : 'es'}`}
        </Button>
      </div>
    </div>
  )
}
