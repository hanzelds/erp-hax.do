'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Edit2, Truck, ArrowLeft, ChevronDown, X, Loader2,
} from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'
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
  businessUnit: 'HAX' | 'KODER'
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
                    <Button variant="ghost" size="sm" onClick={() => setEditingSupplier(s)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
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

  // RNC auto-lookup
  const handleRncFound = useCallback((r: { nombre: string }) => {
    setForm((f) => ({ ...f, name: r.nombre }))
  }, [])
  const { isLoading: rncLoading, isNotFound: rncNotFound } = useRncLookup(
    form.rnc ?? '',
    handleRncFound
  )

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

          {/* Nombre */}
          <Field label="Nombre / Razón social *">
            <input
              type="text"
              value={form.name ?? ''}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Nombre del proveedor"
              className={inp}
            />
          </Field>

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
                {rncNotFound && !rncLoading && (form.rnc?.replace(/\D/g, '').length ?? 0) >= 9 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-600 border-amber-200">
                    No encontrado
                  </span>
                )}
              </div>
            </Field>

            <Field label="Unidad de negocio">
              <div className="relative">
                <select
                  value={form.businessUnit}
                  onChange={(e) => set('businessUnit', e.target.value as 'HAX' | 'KODER')}
                  className={sel}>
                  <option value="HAX">HAX</option>
                  <option value="KODER">KODER</option>
                </select>
                <ChevronIcon />
              </div>
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
