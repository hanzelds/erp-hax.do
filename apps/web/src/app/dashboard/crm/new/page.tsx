'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, AlertCircle } from 'lucide-react'
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
  businessUnit: 'HAX' | 'KODER'
  leadSource:   string
  expectedDate: string
  assignedTo:   string
  notes:        string
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

export default function NewOpportunityPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const qc           = useQueryClient()

  const initClientId   = searchParams.get('clientId') ?? ''
  const initClientName = searchParams.get('clientName') ?? ''

  const [form, setForm] = useState<OppForm>({
    title: '', clientId: initClientId, clientName: initClientName,
    contactName: '', contactPhone: '', description: '',
    value: '', probability: '20',
    status: 'LEAD', businessUnit: 'HAX',
    leadSource: '', expectedDate: '', assignedTo: '', notes: '',
  })
  const [errors, setErrors]         = useState<Partial<Record<keyof OppForm, string>>>({})
  const [clients, setClients]       = useState<ClientResult[]>([])
  const [searchQ, setSearchQ]       = useState(initClientName)
  const [dropOpen, setDropOpen]     = useState(false)
  const [searching, setSearching]   = useState(false)
  const dropRef                     = useRef<HTMLDivElement>(null)
  const searchTimer                 = useRef<ReturnType<typeof setTimeout>>()

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced client search
  useEffect(() => {
    if (searchQ.length < 2 || form.clientId) { setClients([]); return }
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
  }, [searchQ, form.clientId])

  function selectClient(c: ClientResult) {
    setForm(f => ({ ...f, clientId: c.id, clientName: c.name }))
    setSearchQ(c.name)
    setDropOpen(false)
    setClients([])
    setErrors(e => ({ ...e, clientId: undefined }))
  }

  function clearClient() {
    setForm(f => ({ ...f, clientId: '', clientName: '' }))
    setSearchQ('')
    setClients([])
  }

  function set(field: keyof OppForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof OppForm, string>> = {}
    if (!form.title.trim() || form.title.trim().length < 3) e.title = 'El título debe tener al menos 3 caracteres'
    if (!form.clientId) e.clientId = 'Debes seleccionar un cliente'
    if (form.value && isNaN(parseFloat(form.value))) e.value = 'Valor inválido'
    const prob = parseInt(form.probability)
    if (isNaN(prob) || prob < 0 || prob > 100) e.probability = 'Debe ser entre 0 y 100'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        clientId:     form.clientId,
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
      }
      const { data } = await api.post('/crm', payload)
      return data.data ?? data
    },
    onSuccess: (opp) => {
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm-analytics'] })
      qc.invalidateQueries({ queryKey: ['crm-list'] })
      router.push(`/dashboard/crm/${opp.id}`)
    },
  })

  function handleSubmit() {
    if (!validate()) return
    create.mutate()
  }

  const selectedClient = form.clientId ? { id: form.clientId, name: form.clientName } : null

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-[#f4f6f8]/95 backdrop-blur-sm border-b border-gray-200/60 px-6 py-4 flex items-center justify-between">
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
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/crm')}>Cancelar</Button>
          <Button variant="primary" size="sm" loading={create.isPending} onClick={handleSubmit}>
            Crear oportunidad
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {create.isError && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {(create.error as any)?.response?.data?.error ?? 'Error al crear la oportunidad'}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4 pb-24">

        {/* Sección 1 — Cliente */}
        <Section title="Cliente" subtitle="Empresa o persona asociada a esta oportunidad">
          <F label="Cliente" required error={errors.clientId}>
            <div ref={dropRef} className="relative">
              <div className={cn(
                'w-full flex items-center gap-2 border rounded-xl px-3 py-2.5 bg-white transition-colors',
                errors.clientId ? 'border-red-300' : dropOpen ? 'border-[#293c4f] ring-2 ring-[#293c4f]/10' : 'border-gray-200'
              )}>
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                {selectedClient ? (
                  <div className="flex items-center justify-between flex-1 gap-2">
                    <span className="text-sm font-medium text-gray-800">{selectedClient.name}</span>
                    <button onClick={clearClient} className="text-gray-400 hover:text-gray-600 transition-colors text-xs underline">
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
                    <button key={c.id} type="button" onClick={() => selectClient(c)}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Persona de contacto">
              <input type="text" value={form.contactName} onChange={(e) => set('contactName', e.target.value)}
                placeholder="Nombre del contacto en la empresa" className={ic} />
            </F>
            <F label="Teléfono de contacto">
              <input type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)}
                placeholder="+1 (809) 000-0000" className={ic} />
            </F>
          </div>
        </Section>

        {/* Sección 2 — La oportunidad */}
        <Section title="La oportunidad" subtitle="Qué se va a vender y por cuánto">
          <F label="Título" required error={errors.title}>
            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="Ej: Rediseño de identidad corporativa"
              className={cn(ic, errors.title ? icErr : '')} />
          </F>

          <F label="Descripción">
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              placeholder="Describe brevemente el alcance o los requerimientos del cliente..."
              rows={3} className={cn(ic, 'resize-none')} />
          </F>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Valor estimado (DOP)" error={errors.value}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">RD$</span>
                <input type="number" min="0" step="1000" value={form.value}
                  onChange={(e) => set('value', e.target.value)}
                  placeholder="0"
                  className={cn(ic, 'pl-10', errors.value ? icErr : '')} />
              </div>
            </F>
            <F label="Probabilidad de cierre (%)" error={errors.probability}>
              <div className="relative">
                <input type="number" min="0" max="100" value={form.probability}
                  onChange={(e) => set('probability', e.target.value)}
                  className={cn(ic, 'pr-8', errors.probability ? icErr : '')} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
            </F>
          </div>
        </Section>

        {/* Sección 3 — Pipeline */}
        <Section title="Pipeline" subtitle="Cómo y cuándo se espera cerrar este negocio">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Etapa inicial">
              <Select value={form.status} onChange={(e: any) => set('status', e.target.value)} className={ic}>
                {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </F>
            <F label="Unidad de negocio" required>
              <Select value={form.businessUnit} onChange={(e: any) => set('businessUnit', e.target.value)} className={ic}>
                <option value="HAX">HAX Estudio Creativo</option>
                <option value="KODER">KODER</option>
              </Select>
            </F>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Origen del lead">
              <Select value={form.leadSource} onChange={(e: any) => set('leadSource', e.target.value)} className={ic}>
                <option value="">— Seleccionar origen —</option>
                {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            </F>
            <F label="Fecha de cierre esperado">
              <input type="date" value={form.expectedDate} onChange={(e) => set('expectedDate', e.target.value)} className={ic} />
            </F>
          </div>

          <F label="Asignado a">
            <input type="text" value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}
              placeholder="Nombre del responsable de esta oportunidad" className={ic} />
          </F>
        </Section>

        {/* Sección 4 — Notas */}
        <Section title="Notas internas" subtitle="Contexto adicional visible solo para el equipo">
          <F label="Notas">
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              placeholder="Condiciones especiales, contexto del cliente, próximos pasos..."
              rows={4} className={cn(ic, 'resize-none')} />
          </F>
        </Section>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/crm')}>Cancelar</Button>
        <Button variant="primary" size="sm" loading={create.isPending} onClick={handleSubmit}>
          Crear oportunidad
        </Button>
      </div>
    </div>
  )
}
