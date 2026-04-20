'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { useRncLookup } from '@/hooks/useRncLookup'
import { Button, Card, PageHeader } from '@/components/ui'

// ── Dominican Republic provinces ─────────────────────────────
const DR_PROVINCES = [
  'Azua','Bahoruco','Barahona','Dajabón','Distrito Nacional',
  'Duarte','Elías Piña','El Seibo','Espaillat','Hato Mayor',
  'Hermanas Mirabal','Independencia','La Altagracia','La Romana','La Vega',
  'María Trinidad Sánchez','Monseñor Nouel','Monte Cristi','Monte Plata',
  'Pedernales','Peravia','Puerto Plata','Samaná','San Cristóbal',
  'San José de Ocoa','San Juan','San Pedro de Macorís','Sánchez Ramírez',
  'Santiago','Santiago Rodríguez','Santo Domingo','Valverde',
]

const ID_TYPES = ['RNC', 'Cédula', 'Pasaporte']

function statusCls(estado: string) {
  const e = (estado ?? '').toUpperCase()
  if (e === 'ACTIVO')     return 'bg-green-50 text-green-700 border-green-200'
  if (e === 'SUSPENDIDO') return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  return 'bg-red-50 text-red-600 border-red-200'
}

export interface CreatedContact {
  id: string
  name: string
  mode: 'cliente' | 'proveedor'
}

interface Props {
  mode: 'cliente' | 'proveedor'
  onCreated: (contact: CreatedContact) => void
  onBack: () => void
}

export default function NewContactPage({ mode, onCreated, onBack }: Props) {
  const [idType, setIdType]       = useState('RNC')
  const [numero, setNumero]       = useState('')
  const [nombre, setNombre]       = useState('')
  const [provincia, setProvincia] = useState('')
  const [direccion, setDireccion] = useState('')
  const [email, setEmail]         = useState('')
  const [telefono, setTelefono]   = useState('')
  const [err, setErr]             = useState<string | null>(null)

  const [foundStatus, setFoundStatus]   = useState<string | null>(null)
  const [foundByNumber, setFoundByNumber] = useState(false)

  const [suggestions, setSuggestions]   = useState<any[]>([])
  const [showSugg, setShowSugg]         = useState(false)
  const [searchingName, setSearchingName] = useState(false)
  const nameWrapRef = useRef<HTMLDivElement>(null)

  // ── RNC / Cédula auto-lookup ─────────────────────────────────
  const handleFound = useCallback((r: any) => {
    setNombre(r.nombre_razon_social)
    setFoundStatus(r.estado)
    setFoundByNumber(true)
  }, [])

  const lookupVal = idType === 'Pasaporte' ? '' : numero
  const { isLoading: rncLoading, isNotFound: rncNotFound } = useRncLookup(lookupVal, handleFound)

  useEffect(() => { setFoundStatus(null); setFoundByNumber(false) }, [numero, idType])

  // ── Name search suggestions ──────────────────────────────────
  useEffect(() => {
    if (nombre.length < 3 || foundByNumber) { setSuggestions([]); setShowSugg(false); return }
    setSearchingName(true)
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`${base}/rnc-lookup/nombres?buscar=${encodeURIComponent(nombre)}`)
        const json = await res.json()
        const r    = json.resultados?.slice(0, 7) ?? []
        setSuggestions(r)
        setShowSugg(r.length > 0)
      } catch { /* silent */ }
      finally { setSearchingName(false) }
    }, 600)
    return () => clearTimeout(timer)
  }, [nombre, foundByNumber])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (nameWrapRef.current && !nameWrapRef.current.contains(e.target as Node))
        setShowSugg(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function selectSuggestion(s: any) {
    const digits = (s.cedula_rnc ?? '').replace(/\D/g, '')
    setNombre(s.nombre_razon_social)
    setNumero(digits)
    setFoundStatus(s.estado)
    setFoundByNumber(true)
    setShowSugg(false)
    if (digits.length === 9)  setIdType('RNC')
    else if (digits.length === 11) setIdType('Cédula')
  }

  // ── Create mutation ──────────────────────────────────────────
  const create = useMutation({
    mutationFn: async () => {
      const rncVal = (idType === 'RNC' || idType === 'Cédula')
        ? (numero.replace(/\D/g, '') || null) : null
      const body = {
        name:    nombre.trim(),
        rnc:     rncVal,
        email:   email.trim()    || null,
        phone:   telefono.trim() || null,
        address: [provincia, direccion].filter(Boolean).join(', ') || null,
      }
      if (mode === 'cliente') {
        const { data } = await api.post('/clients', body)
        return { ...(data.data ?? data), mode } as CreatedContact
      } else {
        const { data } = await api.post('/suppliers', body)
        return { ...(data.data ?? data), mode } as CreatedContact
      }
    },
    onSuccess: (contact) => onCreated(contact),
    onError:   (e: any)  => setErr(e?.response?.data?.error ?? 'Error al crear el contacto'),
  })

  const title    = mode === 'cliente' ? 'Nuevo cliente' : 'Nuevo proveedor'
  const subtitle = mode === 'cliente' ? 'Completa los datos del cliente' : 'Completa los datos del proveedor'

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <PageHeader title={title} subtitle={subtitle} />

      <Card>
        <div className="space-y-4 p-1">

          {/* Tipo identificación */}
          <Field label="Tipo de identificación">
            <div className="relative">
              <select value={idType}
                onChange={(e) => { setIdType(e.target.value); setNumero(''); setFoundStatus(null) }}
                className={sel}>
                <option value="">Seleccionar</option>
                {ID_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Chevron />
            </div>
          </Field>

          {/* Número */}
          {idType && (
            <Field label="Número">
              <div className="relative">
                <input type="text" value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder={
                    idType === 'RNC'    ? '131996035' :
                    idType === 'Cédula' ? '00100000000' : 'Número de pasaporte'
                  }
                  className={inp} />
                {rncLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  </span>
                )}
                {foundStatus && !rncLoading && (
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCls(foundStatus)}`}>
                    {foundStatus}
                  </span>
                )}
                {rncNotFound && !foundStatus && !rncLoading && numero.replace(/\D/g,'').length >= 9 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-600 border-amber-200">
                    No encontrado
                  </span>
                )}
              </div>
            </Field>
          )}

          {/* Nombre con sugerencias */}
          <div ref={nameWrapRef} className="relative">
            <Field label="Nombre o Razón social *">
              <div className="relative">
                <input type="text" value={nombre}
                  onChange={(e) => { setNombre(e.target.value); setFoundStatus(null); setFoundByNumber(false) }}
                  placeholder="Escribe nombre o busca desde el campo Número"
                  className={inp} />
                {searchingName && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                  </span>
                )}
              </div>
            </Field>

            {showSugg && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-xl z-30 overflow-hidden">
                {suggestions.map((s, i) => (
                  <button key={i} type="button" onMouseDown={() => selectSuggestion(s)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0 transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{s.nombre_razon_social}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{s.cedula_rnc}</p>
                    </div>
                    <span className={`shrink-0 ml-3 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCls(s.estado ?? '')}`}>
                      {s.estado}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Municipio + Dirección */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Municipio / Provincia">
              <div className="relative">
                <select value={provincia} onChange={(e) => setProvincia(e.target.value)} className={sel}>
                  <option value="">Seleccionar</option>
                  {DR_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <Chevron />
              </div>
            </Field>
            <Field label="Dirección">
              <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, número…" className={inp} />
            </Field>
          </div>

          {/* Email + Teléfono */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Correo electrónico">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Ejemplo@email.com" className={inp} />
            </Field>
            <Field label="Teléfono">
              <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)}
                placeholder="809-000-0000" className={inp} />
            </Field>
          </div>

          {err && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{err}</p>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onBack}>Cancelar</Button>
        <Button variant="primary" loading={create.isPending}
          disabled={!nombre.trim()}
          onClick={() => { setErr(null); create.mutate() }}>
          Crear contacto
        </Button>
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
function Chevron() {
  return (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f] placeholder-gray-300 transition-colors'
const sel = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f] bg-white text-gray-700 appearance-none transition-colors'
