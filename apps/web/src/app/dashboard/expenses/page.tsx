'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, ChevronLeft, CheckCircle, DollarSign, XCircle,
  Truck, Building2, FileText, Receipt, CreditCard, Banknote,
  PiggyBank, AlertCircle, X,
} from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'
import NewContactPage from '@/components/NewContactPage'

// ── Types ─────────────────────────────────────────────────────────
type ExpenseStatus  = 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED'
type BusinessUnit   = 'HAX' | 'KODER'
type PayMethod      = 'CASH' | 'TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'DEBIT_CARD'
type NcfType        = '' | 'B11' | 'B13'

interface Supplier  { id: string; name: string; rnc?: string }
interface Account   { id: string; code: string; name: string; type: string; allowsEntry: boolean }
interface Expense   {
  id: string; description: string; amount: number; taxAmount: number; total: number
  accountCode: string | null; paymentMethod: string | null; category: string
  status: ExpenseStatus; businessUnit: BusinessUnit
  expenseDate: string; ncf: string | null; supplier: string
  supplierRef?: { id: string; name: string; rnc?: string } | null
  createdAt: string
}

// ── Constants ─────────────────────────────────────────────────────
const STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: 'Borrador', APPROVED: 'Aprobado', PAID: 'Pagado', CANCELLED: 'Cancelado',
}
const STATUS_COLORS: Record<ExpenseStatus, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  APPROVED:  'bg-blue-50 text-blue-700',
  PAID:      'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-600',
}
const PAY_LABELS: Record<PayMethod, string> = {
  CASH:        'Efectivo',
  TRANSFER:    'Transferencia',
  CHECK:       'Cheque',
  CREDIT_CARD: 'T. Crédito',
  DEBIT_CARD:  'T. Débito',
}
const PAY_ICONS: Record<PayMethod, React.ReactNode> = {
  CASH:        <Banknote  className="w-3.5 h-3.5" />,
  TRANSFER:    <Building2 className="w-3.5 h-3.5" />,
  CHECK:       <FileText  className="w-3.5 h-3.5" />,
  CREDIT_CARD: <CreditCard className="w-3.5 h-3.5" />,
  DEBIT_CARD:  <CreditCard className="w-3.5 h-3.5" />,
}

const NCF_TYPE_LABELS: Record<NcfType, string> = {
  '':    'Comprobante regular',
  'B13': 'Gastos menores (B13)',
  'B11': 'Proveedor informal (B11)',
}

const EMPTY: any = {
  description: '', amount: '', taxAmount: '', accountCode: '5201',
  paymentMethod: 'TRANSFER' as PayMethod, ncf: '', ncfType: '' as NcfType,
  businessUnit: 'HAX' as BusinessUnit,
  expenseDate: new Date().toISOString().slice(0, 10),
  supplierId: '', notes: '',
}

// ── Field helper ──────────────────────────────────────────────────
const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white'
function F({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function ExpensesPage() {
  const qc = useQueryClient()
  const [search, setSearch]               = useState('')
  const [statusF, setStatusF]             = useState('')
  const [buFilter, setBuFilter]           = useState('')
  const [view, setView]                   = useState<'list' | 'new' | 'edit'>('list')
  const [form, setForm]                   = useState<any>({ ...EMPTY })
  const [editId, setEditId]               = useState<string | null>(null)
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [acctSearch, setAcctSearch]       = useState('')
  const [acctOpen, setAcctOpen]           = useState(false)

  // ── Queries ──────────────────────────────────────────────────────
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data } = await api.get('/suppliers', { params: { limit: 200 } })
      return data.data ?? []
    },
  })

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/accounting/accounts')
      return (data.data ?? data).filter((a: Account) => a.allowsEntry)
    },
  })

  const { data: expensesResp, isLoading } = useQuery<any>({
    queryKey: ['expenses', search, statusF, buFilter],
    queryFn: async () => {
      const { data } = await api.get('/expenses', {
        params: {
          search: search || undefined,
          status: statusF || undefined,
          businessUnit: buFilter || undefined,
          limit: 100,
        },
      })
      return data
    },
  })
  const expenses: Expense[] = expensesResp?.data ?? expensesResp ?? []

  const { data: stats } = useQuery<any>({
    queryKey: ['expense-stats'],
    queryFn: async () => {
      const { data } = await api.get('/expenses/stats')
      return data.data ?? data
    },
  })

  // ── Computed account lists ────────────────────────────────────────
  const expenseAccounts = useMemo(() =>
    accounts.filter(a => a.type === 'EXPENSE' && a.allowsEntry), [accounts])

  const filteredAccounts = useMemo(() => {
    if (!acctSearch) return expenseAccounts
    const q = acctSearch.toLowerCase()
    return expenseAccounts.filter(a =>
      a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
  }, [expenseAccounts, acctSearch])

  const selectedAccount = useMemo(() =>
    expenseAccounts.find(a => a.code === form.accountCode), [expenseAccounts, form.accountCode])

  // ── Calculations ──────────────────────────────────────────────────
  const amount   = parseFloat(form.amount)   || 0
  const taxAmt   = parseFloat(form.taxAmount) || 0
  const total    = amount + taxAmt

  // ── Mutations ─────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async (body: any) => {
      const supplierName = suppliers.find(s => s.id === body.supplierId)?.name ?? body.supplierName ?? 'Sin proveedor'
      const payload = {
        description:   body.description,
        amount:        parseFloat(body.amount) || 0,
        taxAmount:     parseFloat(body.taxAmount) || 0,
        accountCode:   body.accountCode || null,
        paymentMethod: body.paymentMethod || 'TRANSFER',
        ncf:           body.ncf || null,
        ncfType:       body.ncfType || null,
        businessUnit:  body.businessUnit,
        expenseDate:   body.expenseDate || undefined,
        supplierId:    body.supplierId || undefined,
        supplier:      supplierName,
        category:      'OPERATIONS',
      }
      if (view === 'new') return api.post('/expenses', payload)
      return api.put(`/expenses/${editId}`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-stats'] })
      setView('list')
      setForm({ ...EMPTY })
      setEditId(null)
    },
  })

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/expenses/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-stats'] })
    },
  })

  const markPaid = useMutation({
    mutationFn: (id: string) => api.patch(`/expenses/${id}/pay`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-stats'] })
    },
  })

  const cancel = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['expense-stats'] })
    },
  })

  const openEdit = (e: Expense) => {
    setForm({
      description:   e.description,
      amount:        String(e.amount),
      taxAmount:     String(e.taxAmount),
      accountCode:   e.accountCode ?? '5201',
      paymentMethod: (e.paymentMethod as PayMethod) ?? 'TRANSFER',
      ncf:           e.ncf ?? '',
      ncfType:       (e as any).ncfType ?? '',
      businessUnit:  e.businessUnit,
      expenseDate:   e.expenseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      supplierId:    e.supplierRef?.id ?? '',
    })
    setEditId(e.id)
    setView('edit')
  }

  // ── New supplier full-page ────────────────────────────────────────
  if (showNewSupplier) {
    return (
      <NewContactPage
        mode="proveedor"
        onCreated={(contact) => {
          qc.invalidateQueries({ queryKey: ['suppliers-list'] })
          setForm((p: any) => ({ ...p, supplierId: contact.id }))
          setShowNewSupplier(false)
        }}
        onBack={() => setShowNewSupplier(false)}
      />
    )
  }

  // ── New / Edit full-page form ─────────────────────────────────────
  if (view === 'new' || view === 'edit') {
    const isNew = view === 'new'
    const selectedSupplier = suppliers.find(s => s.id === form.supplierId)

    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <button
              onClick={() => { setView('list'); setForm({ ...EMPTY }); setEditId(null) }}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver a gastos
            </button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm"
                onClick={() => { setView('list'); setForm({ ...EMPTY }); setEditId(null) }}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" loading={save.isPending}
                onClick={() => save.mutate(form)}>
                {isNew ? 'Crear gasto' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 pt-8 space-y-5">
          {/* Document header */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="bg-[#293c4f] px-6 py-4 flex items-center gap-3 rounded-t-xl">
              <Receipt className="w-5 h-5 text-white/80" />
              <h1 className="text-white font-semibold text-base">
                {isNew ? 'Nuevo gasto' : 'Editar gasto'}
              </h1>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: supplier + account */}
              <div className="space-y-4">
                <F label="Proveedor">
                  <div className="flex gap-2">
                    <select
                      value={form.supplierId}
                      onChange={e => setForm((p: any) => ({ ...p, supplierId: e.target.value }))}
                      className={ic + ' flex-1'}
                    >
                      <option value="">Sin proveedor</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}{s.rnc ? ` — ${s.rnc}` : ''}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewSupplier(true)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs border border-[#293c4f] text-[#293c4f] rounded-lg hover:bg-[#293c4f] hover:text-white transition-colors"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      Nuevo
                    </button>
                  </div>
                </F>

                <F label="Descripción" required>
                  <input
                    type="text"
                    placeholder="Ej. Pago de alquiler de oficina enero 2026"
                    value={form.description}
                    onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))}
                    className={ic}
                  />
                </F>

                <F label="Cuenta contable (débito)" required>
                  <button
                    type="button"
                    onClick={() => setAcctOpen(true)}
                    className={cn(
                      'w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm text-left bg-white focus:outline-none focus:ring-1 focus:ring-[#293c4f]',
                      !selectedAccount && 'text-gray-400'
                    )}
                  >
                    {selectedAccount
                      ? <span className="truncate"><span className="font-mono text-[#293c4f] mr-2">{selectedAccount.code}</span>{selectedAccount.name}</span>
                      : <span>Seleccionar cuenta…</span>
                    }
                    <span className="text-gray-300 ml-2 shrink-0">▾</span>
                  </button>

                  {/* Fixed-position modal — avoids overflow clipping from any ancestor */}
                  {acctOpen && (
                    <div
                      className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4 bg-black/20"
                      onClick={() => { setAcctOpen(false); setAcctSearch('') }}
                    >
                      <div
                        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-semibold text-gray-800">Cuenta contable (débito)</p>
                          <button
                            type="button"
                            onClick={() => { setAcctOpen(false); setAcctSearch('') }}
                            className="p-1 rounded hover:bg-gray-100"
                          >
                            <X className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                        <div className="p-3 border-b border-gray-100">
                          <input
                            autoFocus
                            type="text"
                            placeholder="Buscar por código o nombre…"
                            value={acctSearch}
                            onChange={e => setAcctSearch(e.target.value)}
                            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
                          />
                        </div>
                        <ul className="max-h-80 overflow-y-auto py-1">
                          {filteredAccounts.length === 0 ? (
                            <li className="px-4 py-4 text-xs text-gray-400 text-center">Sin resultados</li>
                          ) : filteredAccounts.map(a => (
                            <li
                              key={a.id}
                              onClick={() => {
                                setForm((p: any) => ({ ...p, accountCode: a.code }))
                                setAcctOpen(false)
                                setAcctSearch('')
                              }}
                              className={cn(
                                'px-4 py-2.5 cursor-pointer hover:bg-gray-50 flex items-center gap-3',
                                form.accountCode === a.code && 'bg-[#293c4f]/5'
                              )}
                            >
                              <span className="font-mono text-xs text-[#293c4f] w-14 shrink-0">{a.code}</span>
                              <span className="text-xs text-gray-700 truncate">{a.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </F>
              </div>

              {/* Right: date, method, BU, NCF */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <F label="Fecha" required>
                    <input
                      type="date"
                      value={form.expenseDate}
                      onChange={e => setForm((p: any) => ({ ...p, expenseDate: e.target.value }))}
                      className={ic}
                    />
                  </F>
                  <F label="Unidad">
                    <select
                      value={form.businessUnit}
                      onChange={e => setForm((p: any) => ({ ...p, businessUnit: e.target.value }))}
                      className={ic}
                    >
                      <option value="HAX">HAX</option>
                      <option value="KODER">KODER</option>
                    </select>
                  </F>
                </div>

                <F label="Forma de pago">
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(PAY_LABELS) as PayMethod[]).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm((p: any) => ({ ...p, paymentMethod: m }))}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-colors',
                          form.paymentMethod === m
                            ? 'border-[#293c4f] bg-[#293c4f]/5 text-[#293c4f] font-medium'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        {PAY_ICONS[m]}
                        {PAY_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </F>

                <F label="Tipo de comprobante">
                  <select
                    value={form.ncfType}
                    onChange={e => setForm((p: any) => ({ ...p, ncfType: e.target.value }))}
                    className={ic}
                  >
                    {(Object.entries(NCF_TYPE_LABELS) as [NcfType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </F>

                <F label="NCF (número comprobante)">
                  <input
                    type="text"
                    placeholder={form.ncfType === 'B13' ? 'B1300000000' : form.ncfType === 'B11' ? 'B1100000000' : 'E310000000001'}
                    value={form.ncf}
                    onChange={e => setForm((p: any) => ({ ...p, ncf: e.target.value }))}
                    className={ic + ' font-mono'}
                  />
                </F>
              </div>
            </div>
          </div>

          {/* Amounts section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Detalle del gasto</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <F label="Monto neto (DOP)" required>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number" min="0" step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm((p: any) => ({ ...p, amount: e.target.value }))}
                    className={ic + ' pl-7'}
                  />
                </div>
              </F>
              <F label="ITBIS (18%)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number" min="0" step="0.01"
                    placeholder="0.00"
                    value={form.taxAmount}
                    onChange={e => setForm((p: any) => ({ ...p, taxAmount: e.target.value }))}
                    className={ic + ' pl-7'}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const base = parseFloat(form.amount) || 0
                    setForm((p: any) => ({ ...p, taxAmount: (base * 0.18).toFixed(2) }))
                  }}
                  className="mt-1 text-xs text-[#293c4f] hover:underline"
                >
                  Calcular 18%
                </button>
              </F>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Total</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900">
                  {formatCurrency(total)}
                </div>
              </div>
            </div>
          </div>

          {/* Summary panel */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(amount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-gray-500">ITBIS</span>
              <span className="font-medium">{formatCurrency(taxAmt)}</span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="font-semibold text-gray-900">Total a pagar</span>
              <span className="text-xl font-bold text-[#293c4f]">{formatCurrency(total)}</span>
            </div>
            {selectedSupplier && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                Proveedor: <span className="text-gray-700 font-medium">{selectedSupplier.name}</span>
                {selectedSupplier.rnc && <span> · RNC {selectedSupplier.rnc}</span>}
              </div>
            )}
          </div>

          {save.isError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Error al guardar. Verifica los campos obligatorios.
            </div>
          )}
        </div>

        {/* Fixed bottom bar */}
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Total: <span className="font-bold text-gray-900 text-base">{formatCurrency(total)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm"
                onClick={() => { setView('list'); setForm({ ...EMPTY }); setEditId(null) }}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" loading={save.isPending}
                onClick={() => save.mutate(form)}>
                {isNew ? 'Crear gasto' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────
  const monthTotal = stats?.monthTotal ?? 0
  const pendingCount = expenses.filter(e => e.status === 'DRAFT' || e.status === 'APPROVED').length
  const pendingAmount = expenses.filter(e => e.status === 'DRAFT' || e.status === 'APPROVED').reduce((s, e) => s + e.total, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gastos"
        subtitle="Control de gastos y egresos empresariales"
        actions={
          <Button
            variant="primary" size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => { setForm({ ...EMPTY }); setView('new') }}
          >
            Nuevo gasto
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Este mes', value: formatCurrency(monthTotal), icon: <Receipt className="w-4 h-4" />, color: 'text-[#293c4f]' },
          { label: 'Pendientes', value: pendingCount.toString(), icon: <AlertCircle className="w-4 h-4" />, color: 'text-amber-600' },
          { label: 'Por pagar', value: formatCurrency(pendingAmount), icon: <PiggyBank className="w-4 h-4" />, color: 'text-blue-600' },
          { label: 'Total gastos', value: (expensesResp?.total ?? expenses.length).toString(), icon: <FileText className="w-4 h-4" />, color: 'text-gray-600' },
        ].map(s => (
          <Card key={s.label} padding="sm">
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={cn('text-lg font-bold', s.color)}>{s.value}</p>
              </div>
              <div className={cn('p-2 rounded-lg bg-gray-50', s.color)}>{s.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text" placeholder="Buscar gastos…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
            />
          </div>
          <select value={statusF} onChange={e => setStatusF(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f]">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={buFilter} onChange={e => setBuFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f]">
            <option value="">Todas las unidades</option>
            <option value="HAX">HAX</option>
            <option value="KODER">KODER</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        {isLoading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState
            title="No hay gastos"
            description="Registra tu primer gasto para llevar el control financiero."
            action={<Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => { setForm({ ...EMPTY }); setView('new') }}>Nuevo gasto</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Descripción', 'Proveedor', 'Cuenta', 'NCF', 'Método', 'Unidad', 'Fecha', 'Monto', 'Estado', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id}
                  className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                  onClick={() => openEdit(e)}
                >
                  <td className="px-3 py-3 text-xs font-medium text-gray-800 max-w-[180px] truncate">{e.description}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{e.supplierRef?.name ?? e.supplier ?? '—'}</td>
                  <td className="px-3 py-3">
                    {e.accountCode
                      ? <span className="font-mono text-xs text-[#293c4f] bg-[#293c4f]/5 px-1.5 py-0.5 rounded">{e.accountCode}</span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-400">{e.ncf ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {e.paymentMethod ? PAY_LABELS[e.paymentMethod as PayMethod] ?? e.paymentMethod : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={e.businessUnit === 'HAX'
                        ? { backgroundColor: '#eef1f4', color: '#293c4f' }
                        : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {e.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-400">{formatDate(e.expenseDate)}</td>
                  <td className="px-3 py-3">
                    <div className="text-xs font-semibold text-gray-900">{formatCurrency(e.total)}</div>
                    {e.taxAmount > 0 && <div className="text-xs text-gray-400">ITBIS {formatCurrency(e.taxAmount)}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[e.status])}>
                      {STATUS_LABELS[e.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3" onClick={ev => ev.stopPropagation()}>
                    <div className="flex items-center gap-0.5">
                      {e.status === 'DRAFT' && (
                        <button title="Aprobar"
                          onClick={() => approve.mutate(e.id)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                          <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                        </button>
                      )}
                      {e.status === 'APPROVED' && (
                        <button title="Marcar pagado"
                          onClick={() => markPaid.mutate(e.id)}
                          className="p-1.5 rounded-lg hover:bg-green-50 transition-colors">
                          <DollarSign className="w-3.5 h-3.5 text-green-500" />
                        </button>
                      )}
                      {(e.status === 'DRAFT' || e.status === 'APPROVED') && (
                        <button title="Cancelar"
                          onClick={() => cancel.mutate(e.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={7} className="px-3 py-2 text-xs font-medium text-gray-500">
                    {expenses.length} registros
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-xs font-bold text-gray-900">
                      {formatCurrency(expenses.reduce((s, e) => s + e.total, 0))}
                    </div>
                    <div className="text-xs text-gray-400">
                      ITBIS {formatCurrency(expenses.reduce((s, e) => s + e.taxAmount, 0))}
                    </div>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </Card>
    </div>
  )
}
