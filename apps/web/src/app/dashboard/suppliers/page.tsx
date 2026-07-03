'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Edit2, Trash2, Truck, ArrowLeft, ChevronDown, X, Loader2,
} from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState, Select } from '@/components/ui'
import { useRncLookup } from '@/hooks/useRncLookup'
import NewContactPage from '@/components/NewContactPage'

// ── Types ─────────────────────────────────────────────────────
interface Supplier {
  id: string
  name: string
  rnc: string | null
  email: string | null
  phone: string | null
  address: string | null
  category: string | null
  categoryCode: string | null
  businessUnit: 'HAX' | 'KODER' | 'ALDIA'
  isActive: boolean
  createdAt: string
  _count?: { expenses: number }
  totalSpent?: number
}

interface Account {
  id: string
  code: string
  name: string
  type: string
  allowsEntry: boolean
}

// ── Page ──────────────────────────────────────────────────────
export default function SuppliersPage() {
  const qc = useQueryClient()
  const [search, setSearch]               = useState('')
  const [showNewContact, setShowNewContact] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deletingId, setDeletingId]       = useState<string | null>(null)

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers', search],
    queryFn: async () => {
      const { data } = await api.get('/suppliers', { params: { search: search || undefined } })
      return data.data ?? data
    },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['suppliers'] })
    qc.invalidateQueries({ queryKey: ['suppliers-list'] })
  }

  const deleteSupplier = useMutation({
    mutationFn: (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => { setDeletingId(null); invalidate() },
  })

  // ── Full-page new contact view ─────────────────────────────
  if (showNewContact) {
    return (
      <NewContactPage
        mode="proveedor"
        onCreated={() => { invalidate(); setShowNewContact(false) }}
        onBack={() => setShowNewContact(false)}
      />
    )
  }

  // ── Full-page edit view ────────────────────────────────────
  if (editingSupplier) {
    return (
      <EditSupplierPage
        supplier={editingSupplier}
        onSaved={() => { invalidate(); setEditingSupplier(null) }}
        onBack={() => setEditingSupplier(null)}
      />
    )
  }

  // ── List view ─────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <PageHeader
        title="Proveedores"
        subtitle="Gestión de proveedores"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowNewContact(true)}>
            Nuevo proveedor
          </Button>
        }
      />

      <Card padding="sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RNC…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
          />
        </div>
      </Card>

      <Card padding="sm">
        {isLoading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={<Truck className="w-5 h-5" />}
            title="No hay proveedores"
            description="Agrega proveedores para gestionar tus compras y gastos."
            action={
              <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setShowNewContact(true)}>
                Nuevo proveedor
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Nombre', 'RNC', 'Categoría', 'Email', 'Teléfono', 'Unidad', 'Gastos', 'Total gastado', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className={cn('border-b border-gray-50 hover:bg-gray-50/60 transition-colors', !s.isActive && 'opacity-50')}>
                  <td className="px-3 py-3 text-xs font-medium text-gray-800">{s.name}</td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-500">{s.rnc ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {s.categoryCode
                      ? <span className="font-mono text-[#293c4f] bg-[#293c4f]/5 px-1.5 py-0.5 rounded">{s.categoryCode}</span>
                      : s.category ?? '—'}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{s.email ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{s.phone ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={s.businessUnit === 'HAX'
                        ? { backgroundColor: '#eef1f4', color: '#293c4f' }
                        : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {s.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{s._count?.expenses ?? 0}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-gray-800">{formatCurrency(s.totalSpent ?? 0)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" onClick={() => setEditingSupplier(s)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeletingId(s.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
      {/* Delete confirmation dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
          onClick={() => setDeletingId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">¿Eliminar proveedor?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Esta acción no se puede deshacer. El proveedor será eliminado permanentemente.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeletingId(null)}>Cancelar</Button>
              <Button
                variant="primary"
                size="sm"
                loading={deleteSupplier.isPending}
                onClick={() => deleteSupplier.mutate(deletingId)}
                className="bg-red-600 hover:bg-red-700 border-red-600"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Status badge helper ────────────────────────────────────────
function statusCls(estado: string) {
  const e = (estado ?? '').toUpperCase()
  if (e === 'ACTIVO')     return 'bg-green-50 text-green-700 border-green-200'
  if (e === 'SUSPENDIDO') return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  return 'bg-red-50 text-red-600 border-red-200'
}

// ── Edit full-page ─────────────────────────────────────────────
function EditSupplierPage({
  supplier,
  onSaved,
  onBack,
}: {
  supplier: Supplier
  onSaved: () => void
  onBack: () => void
}) {
  const [form, setForm] = useState<Partial<Supplier>>({ ...supplier })
  const [err,  setErr]  = useState<string | null>(null)

  // Account selector state
  const [acctOpen,   setAcctOpen]   = useState(false)
  const [acctSearch, setAcctSearch] = useState('')

  // RNC / DGII lookup state
  const [foundStatus,   setFoundStatus]   = useState<string | null>(null)
  const [foundByNumber, setFoundByNumber] = useState(false)
  const [suggestions,   setSuggestions]   = useState<any[]>([])
  const [showSugg,      setShowSugg]      = useState(false)
  const [searchingName, setSearchingName] = useState(false)
  const nameWrapRef = useRef<HTMLDivElement>(null)

  const handleRncFound = useCallback((r: any) => {
    setForm((f) => ({ ...f, name: r.nombre_razon_social ?? r.nombre }))
    setFoundStatus(r.estado ?? null)
    setFoundByNumber(true)
  }, [])

  useEffect(() => { setFoundStatus(null); setFoundByNumber(false) }, [form.rnc])

  const { isLoading: rncLoading, isNotFound: rncNotFound } = useRncLookup(
    form.rnc ?? '',
    handleRncFound
  )

  // Name search suggestions
  useEffect(() => {
    const name = form.name ?? ''
    if (name.length < 3 || foundByNumber) { setSuggestions([]); setShowSugg(false); return }
    setSearchingName(true)
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`${base}/rnc-lookup/nombres?buscar=${encodeURIComponent(name)}`)
        const json = await res.json()
        const r    = json.resultados?.slice(0, 7) ?? []
        setSuggestions(r)
        setShowSugg(r.length > 0)
      } catch { /* silent */ }
      finally { setSearchingName(false) }
    }, 600)
    return () => clearTimeout(timer)
  }, [form.name, foundByNumber])

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
    setForm((f) => ({ ...f, name: s.nombre_razon_social, rnc: digits || f.rnc }))
    setFoundStatus(s.estado ?? null)
    setFoundByNumber(true)
    setShowSugg(false)
  }

  // Expense accounts
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/accounting/accounts')
      return (data.data ?? data).filter((a: Account) => a.allowsEntry && a.type === 'EXPENSE')
    },
  })

  const filteredAccounts = accounts.filter(
    (a) =>
      !acctSearch ||
      a.code.toLowerCase().includes(acctSearch.toLowerCase()) ||
      a.name.toLowerCase().includes(acctSearch.toLowerCase())
  )

  const selectedAccount = accounts.find((a) => a.code === form.categoryCode)

  const save = useMutation({
    mutationFn: async () => {
      const body: any = {
        name:         form.name?.trim() || undefined,
        rnc:          form.rnc?.trim()  || null,
        email:        form.email?.trim() || null,
        phone:        form.phone?.trim() || null,
        address:      form.address?.trim() || null,
        categoryCode: form.categoryCode  || null,
        businessUnit: form.businessUnit,
        isActive:     form.isActive,
      }
      await api.patch(`/suppliers/${supplier.id}`, body)
    },
    onSuccess: onSaved,
    onError:   (e: any) => setErr(e?.response?.data?.error ?? 'Error al guardar el proveedor'),
  })

  const set = (k: keyof Supplier, v: any) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Volver a proveedores
      </button>

      <PageHeader
        title="Editar proveedor"
        subtitle={supplier.name}
      />

      <Card>
        <div className="space-y-4 p-1">

          {/* Nombre con sugerencias DGII */}
          <div ref={nameWrapRef} className="relative">
            <Field label="Nombre / Razón social *">
              <div className="relative">
                <input
                  type="text"
                  value={form.name ?? ''}
                  onChange={(e) => { set('name', e.target.value); setFoundStatus(null); setFoundByNumber(false) }}
                  placeholder="Nombre del proveedor o busca desde RNC"
                  className={inp}
                />
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

          {/* RNC + Unidad */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="RNC / Cédula">
              <div className="relative">
                <input
                  type="text"
                  value={form.rnc ?? ''}
                  onChange={(e) => set('rnc', e.target.value)}
                  placeholder="131996035"
                  className={inp}
                />
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
                {rncNotFound && !foundStatus && !rncLoading && (form.rnc?.replace(/\D/g, '').length ?? 0) >= 9 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-600 border-amber-200">
                    No encontrado
                  </span>
                )}
              </div>
            </Field>

            <Field label="Unidad de negocio">
              <Select
                value={form.businessUnit}
                onChange={(e) => set('businessUnit', e.target.value as 'HAX' | 'KODER' | 'ALDIA')}
                className={sel}>
                <option value="HAX">HAX</option>
                <option value="KODER">KODER</option>
                <option value="ALDIA">Al Dia ERP</option>
              </Select>
            </Field>
          </div>

          {/* Email + Teléfono */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Correo electrónico">
              <input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
                placeholder="proveedor@email.com"
                className={inp}
              />
            </Field>
            <Field label="Teléfono">
              <input
                type="text"
                value={form.phone ?? ''}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="809-000-0000"
                className={inp}
              />
            </Field>
          </div>

          {/* Dirección */}
          <Field label="Dirección">
            <input
              type="text"
              value={form.address ?? ''}
              onChange={(e) => set('address', e.target.value)}
              placeholder="Calle, número, sector…"
              className={inp}
            />
          </Field>

          {/* Categoría contable */}
          <Field label="Categoría contable (cuenta de gasto)">
            <button
              type="button"
              onClick={() => setAcctOpen(true)}
              className={cn(inp, 'flex items-center justify-between text-left')}
            >
              {selectedAccount ? (
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-[#293c4f] shrink-0">{selectedAccount.code}</span>
                  <span className="text-sm text-gray-700 truncate">{selectedAccount.name}</span>
                </span>
              ) : (
                <span className="text-gray-400">Sin categoría — seleccionar cuenta…</span>
              )}
              <ChevronDown className="w-4 h-4 text-gray-300 shrink-0 ml-2" />
            </button>
          </Field>

          {/* Estado activo */}
          <Field label="Estado">
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => set('isActive', !form.isActive)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  form.isActive ? 'bg-[#293c4f]' : 'bg-gray-200'
                )}
              >
                <span className={cn(
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform',
                  form.isActive ? 'translate-x-4' : 'translate-x-0'
                )} />
              </button>
              <span className="text-sm text-gray-600">
                {form.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </Field>

          {err && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{err}</p>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onBack}>Cancelar</Button>
        <Button
          variant="primary"
          loading={save.isPending}
          disabled={!form.name?.trim()}
          onClick={() => { setErr(null); save.mutate() }}
        >
          Guardar cambios
        </Button>
      </div>

      {/* Account selector overlay */}
      {acctOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4 bg-black/20"
          onClick={() => { setAcctOpen(false); setAcctSearch('') }}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Categoría contable (cuenta débito)</p>
              <button type="button" onClick={() => { setAcctOpen(false); setAcctSearch('') }}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-3 border-b border-gray-100">
              <input
                autoFocus
                type="text"
                placeholder="Buscar por código o nombre…"
                value={acctSearch}
                onChange={(e) => setAcctSearch(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto py-1">
              <li
                onClick={() => { set('categoryCode', null); setAcctOpen(false); setAcctSearch('') }}
                className="px-4 py-2.5 cursor-pointer hover:bg-gray-50 text-xs text-gray-400 italic"
              >
                Sin categoría
              </li>
              {filteredAccounts.length === 0 ? (
                <li className="px-4 py-4 text-xs text-gray-400 text-center">Sin resultados</li>
              ) : (
                filteredAccounts.map((a) => (
                  <li
                    key={a.id}
                    onClick={() => { set('categoryCode', a.code); setAcctOpen(false); setAcctSearch('') }}
                    className={cn(
                      'px-4 py-2.5 cursor-pointer hover:bg-gray-50 flex items-center gap-3',
                      form.categoryCode === a.code && 'bg-[#293c4f]/5'
                    )}
                  >
                    <span className="font-mono text-xs text-[#293c4f] w-14 shrink-0">{a.code}</span>
                    <span className="text-xs text-gray-700 truncate">{a.name}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
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

function ChevronIcon() {
  return (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f] placeholder-gray-300 transition-colors'
const sel = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f] bg-white text-gray-700 appearance-none transition-colors pr-8'
