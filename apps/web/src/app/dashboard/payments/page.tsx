'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, CreditCard, ArrowLeft, CheckCircle2,
  Info, AlertCircle, ChevronDown, X,
} from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Payment {
  id: string
  amount: number
  method: string
  reference: string | null
  notes: string | null
  paidAt: string
  invoice: { id: string; number: string; businessUnit: string; client: { name: string } }
}

interface Client {
  id: string
  name: string
  rnc: string | null
  phone: string | null
}

interface PendingInvoice {
  id: string
  number: string
  issueDate: string
  dueDate: string | null
  total: number
  amountPaid: number
  amountDue: number
  paymentStatus: string
  businessUnit: string
}

interface Company {
  name: string
  rnc: string | null
  address: string | null
  phone: string | null
}

type PaymentMethod = 'TRANSFER' | 'CASH' | 'CHECK' | 'CARD'

const METHOD_LABEL: Record<PaymentMethod, string> = {
  TRANSFER: 'Transferencia bancaria',
  CASH:     'Efectivo',
  CHECK:    'Cheque',
  CARD:     'Tarjeta de crédito/débito',
}

const METHOD_OPTIONS: PaymentMethod[] = ['TRANSFER', 'CASH', 'CHECK', 'CARD']

interface PaymentForm {
  clientId:  string
  invoiceId: string
  amount:    string
  method:    PaymentMethod
  reference: string
  notes:     string
  paidAt:    string
}

const today = () => new Date().toISOString().split('T')[0]

const EMPTY_FORM: PaymentForm = {
  clientId:  '',
  invoiceId: '',
  amount:    '',
  method:    'TRANSFER',
  reference: '',
  notes:     '',
  paidAt:    today(),
}

// ─── New Payment Page ──────────────────────────────────────────────────────────
function NewPaymentPage({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [form, setForm]               = useState<PaymentForm>(EMPTY_FORM)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDrop, setShowClientDrop] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [incomeType, setIncomeType]   = useState<'invoice' | 'other'>('invoice')

  // Company info
  const { data: company } = useQuery<Company>({
    queryKey: ['settings-company'],
    queryFn: async () => {
      const { data } = await api.get('/settings/company')
      return data.data ?? data
    },
  })

  // Client search
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-search', clientSearch],
    queryFn: async () => {
      const { data } = await api.get('/clients', {
        params: { search: clientSearch || undefined, limit: 20 },
      })
      return data.data ?? data
    },
    enabled: showClientDrop,
  })

  // Pending invoices for selected client
  const { data: pendingInvoices = [], isLoading: loadingInvoices } = useQuery<PendingInvoice[]>({
    queryKey: ['pending-invoices', form.clientId],
    queryFn: async () => {
      const { data } = await api.get('/invoices', {
        params: { clientId: form.clientId, paymentStatus: 'PENDING,PARTIAL', limit: 50 },
      })
      // filter client-side too, API may not support comma-separated values
      const all = data.data ?? data
      return all.filter((i: PendingInvoice) =>
        i.paymentStatus === 'PENDING' || i.paymentStatus === 'PARTIAL'
      )
    },
    enabled: !!form.clientId && incomeType === 'invoice',
  })

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === form.clientId),
    [clients, form.clientId]
  )

  const selectedInvoice = useMemo(
    () => pendingInvoices.find((i) => i.id === form.invoiceId),
    [pendingInvoices, form.invoiceId]
  )

  const amountNum = parseFloat(form.amount) || 0
  const maxAmount = selectedInvoice?.amountDue ?? 0

  function set(field: keyof PaymentForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function selectClient(c: Client) {
    setForm((f) => ({ ...f, clientId: c.id, invoiceId: '', amount: '' }))
    setClientSearch(c.name)
    setShowClientDrop(false)
  }

  function selectInvoice(inv: PendingInvoice) {
    setForm((f) => ({
      ...f,
      invoiceId: inv.id,
      amount: inv.amountDue.toFixed(2),
    }))
  }

  const qc = useQueryClient()
  const save = useMutation({
    mutationFn: async () => {
      if (!form.invoiceId) throw new Error('Selecciona una factura')
      if (!amountNum || amountNum <= 0) throw new Error('El monto debe ser mayor a 0')
      if (amountNum > maxAmount + 0.01) throw new Error(`El monto supera el saldo pendiente (${formatCurrency(maxAmount)})`)
      await api.post(`/invoices/${form.invoiceId}/payments`, {
        amount:    amountNum,
        method:    form.method,
        reference: form.reference.trim() || null,
        notes:     form.notes.trim() || null,
        paidAt:    new Date(form.paidAt).toISOString(),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['pending-invoices'] })
      onSaved()
    },
    onError: (err: any) => {
      setError(err?.response?.data?.error ?? err?.message ?? 'Error al guardar el cobro')
    },
  })

  const canSave = incomeType === 'invoice'
    ? !!form.invoiceId && amountNum > 0
    : false // "Otros ingresos" not yet implemented

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#f4f6f8] px-6 pt-5 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-base font-semibold text-gray-800">Nuevo pago recibido</h1>
      </div>

      {/* Document card */}
      <div className="px-6 pb-32">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-4xl mx-auto">

          {/* Document header */}
          <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">{company?.name ?? '—'}</p>
              {company?.rnc && (
                <p className="text-xs text-gray-500 mt-0.5">{company.rnc}</p>
              )}
              {company?.address && (
                <p className="text-xs text-gray-400 mt-0.5">{company.address}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-800">No. —</p>
              <p className="text-xs text-gray-400 mt-0.5">Recibo de caja</p>
            </div>
          </div>

          <div className="px-8 py-7 space-y-7">

            {/* Row 1: Client + Date + Method */}
            <div className="grid grid-cols-3 gap-5">
              {/* Client */}
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Cliente
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={clientSearch}
                    placeholder="Buscar cliente…"
                    onFocus={() => setShowClientDrop(true)}
                    onChange={(e) => {
                      setClientSearch(e.target.value)
                      setShowClientDrop(true)
                      if (!e.target.value) setForm((f) => ({ ...f, clientId: '', invoiceId: '', amount: '' }))
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f] pr-8"
                  />
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  {showClientDrop && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {clients.length === 0 ? (
                        <p className="px-3 py-2.5 text-xs text-gray-400">Sin resultados</p>
                      ) : (
                        clients.map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-sm"
                            onClick={() => selectClient(c)}
                          >
                            <span className="font-medium text-gray-800 text-xs">{c.name}</span>
                            {c.rnc && <span className="text-gray-400 text-xs ml-2">{c.rnc}</span>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {/* Click-away */}
                {showClientDrop && (
                  <div className="fixed inset-0 z-20" onClick={() => setShowClientDrop(false)} />
                )}
              </div>

              {/* Payment date */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Fecha de pago <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={form.paidAt}
                  onChange={(e) => set('paidAt', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f]"
                />
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Forma de pago <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={form.method}
                    onChange={(e) => set('method', e.target.value as PaymentMethod)}
                    className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f] bg-white pr-8"
                  >
                    {METHOD_OPTIONS.map((m) => (
                      <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 2: Reference */}
            <div className="grid grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Referencia / No. cheque
                </label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(e) => set('reference', e.target.value)}
                  placeholder="Opcional"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f]"
                />
              </div>
            </div>

            {/* Income type toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Tipo de ingreso
              </label>
              <div className="flex rounded-xl overflow-hidden border border-gray-200 w-fit">
                <button
                  onClick={() => setIncomeType('invoice')}
                  className={cn(
                    'px-5 py-2.5 text-sm font-medium transition-colors',
                    incomeType === 'invoice'
                      ? 'bg-[#293c4f] text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  )}
                >
                  Pago a factura de cliente
                </button>
                <button
                  disabled
                  title="Próximamente"
                  className="px-5 py-2.5 text-sm font-medium bg-white text-gray-300 cursor-not-allowed border-l border-gray-200"
                >
                  Otros ingresos
                </button>
              </div>
            </div>

            {/* Pending invoices section */}
            {incomeType === 'invoice' && (
              <div>
                {!form.clientId ? (
                  <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3.5">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <p className="text-sm text-blue-600">Selecciona un cliente para ver sus facturas pendientes.</p>
                  </div>
                ) : loadingInvoices ? (
                  <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
                  </div>
                ) : pendingInvoices.length === 0 ? (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-sm text-amber-600">Este cliente no tiene facturas pendientes de cobro.</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                      Facturas por cobrar
                    </p>
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5 w-8" />
                            <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">No. Factura</th>
                            <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Fecha</th>
                            <th className="text-left text-xs font-medium text-gray-400 px-4 py-2.5">Estado</th>
                            <th className="text-right text-xs font-medium text-gray-400 px-4 py-2.5">Total</th>
                            <th className="text-right text-xs font-medium text-gray-400 px-4 py-2.5">Pagado</th>
                            <th className="text-right text-xs font-medium text-gray-400 px-4 py-2.5">Pendiente</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingInvoices.map((inv) => {
                            const selected = form.invoiceId === inv.id
                            return (
                              <tr
                                key={inv.id}
                                onClick={() => selectInvoice(inv)}
                                className={cn(
                                  'border-b border-gray-50 cursor-pointer transition-colors',
                                  selected
                                    ? 'bg-[#293c4f]/5 hover:bg-[#293c4f]/8'
                                    : 'hover:bg-gray-50'
                                )}
                              >
                                <td className="px-4 py-3">
                                  <div className={cn(
                                    'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                                    selected ? 'border-[#293c4f] bg-[#293c4f]' : 'border-gray-300'
                                  )}>
                                    {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs font-semibold text-[#293c4f]">
                                  {inv.number}
                                </td>
                                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(inv.issueDate)}</td>
                                <td className="px-4 py-3">
                                  <span className={cn(
                                    'px-2 py-0.5 rounded-full text-xs font-medium',
                                    inv.paymentStatus === 'PARTIAL'
                                      ? 'bg-amber-50 text-amber-600'
                                      : 'bg-red-50 text-red-500'
                                  )}>
                                    {inv.paymentStatus === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-right text-gray-700 font-medium">
                                  {formatCurrency(inv.total)}
                                </td>
                                <td className="px-4 py-3 text-xs text-right text-gray-500">
                                  {inv.amountPaid > 0 ? formatCurrency(inv.amountPaid) : '—'}
                                </td>
                                <td className="px-4 py-3 text-xs text-right font-semibold text-[#293c4f]">
                                  {formatCurrency(inv.amountDue)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Amount input when invoice is selected */}
                    {selectedInvoice && (
                      <div className="mt-5 flex items-end justify-end gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">
                            Saldo pendiente: <span className="font-semibold text-[#293c4f]">{formatCurrency(selectedInvoice.amountDue)}</span>
                          </p>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-gray-600">Monto a cobrar</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">RD$</span>
                              <input
                                type="number"
                                min="0.01"
                                max={selectedInvoice.amountDue}
                                step="0.01"
                                value={form.amount}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => set('amount', e.target.value)}
                                className="w-40 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f]"
                              />
                            </div>
                          </div>
                          {amountNum > 0 && amountNum < selectedInvoice.amountDue && (
                            <p className="text-xs text-amber-500 mt-1">
                              Pago parcial — quedará pendiente {formatCurrency(selectedInvoice.amountDue - amountNum)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Detalles adicionales visibles en el recibo…"
                rows={3}
                maxLength={500}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#293c4f]/20 focus:border-[#293c4f] resize-none"
              />
            </div>

            {/* Total */}
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <div className="flex items-baseline gap-4">
                <span className="text-base font-bold text-gray-800">Total</span>
                <span className="text-2xl font-bold text-[#293c4f]">
                  {formatCurrency(amountNum)}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl shadow-lg z-20">
          {error}
        </div>
      )}

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={onBack}>Cancelar</Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!canSave}
          loading={save.isPending}
          onClick={() => { setError(null); save.mutate() }}
        >
          Guardar cobro
        </Button>
      </div>
    </div>
  )
}

// ─── Payments List Page ────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch]   = useState('')
  const qc = useQueryClient()

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data } = await api.get('/payments', { params: { limit: 100 } })
      return data.data ?? data
    },
  })

  const filtered = useMemo(() => {
    if (!search) return payments
    const q = search.toLowerCase()
    return payments.filter((p) =>
      p.invoice.number.toLowerCase().includes(q) ||
      p.invoice.client.name.toLowerCase().includes(q) ||
      (p.reference ?? '').toLowerCase().includes(q)
    )
  }, [payments, search])

  const totalAmount = useMemo(
    () => payments.reduce((s, p) => s + p.amount, 0),
    [payments]
  )

  if (showNew) {
    return (
      <NewPaymentPage
        onBack={() => setShowNew(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['payments'] })
          setShowNew(false)
        }}
      />
    )
  }

  const METHOD_SHORT: Record<string, string> = {
    TRANSFER: 'Transferencia',
    CASH:     'Efectivo',
    CHECK:    'Cheque',
    CARD:     'Tarjeta',
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cobros"
        subtitle="Pagos recibidos de clientes"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowNew(true)}
          >
            Nuevo cobro
          </Button>
        }
      />

      {/* Stats */}
      {!isLoading && payments.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          <Card padding="sm">
            <div className="px-3 py-2">
              <p className="text-xs text-gray-400 mb-0.5">Total cobrado</p>
              <p className="text-lg font-bold text-[#293c4f]">{formatCurrency(totalAmount)}</p>
            </div>
          </Card>
          <Card padding="sm">
            <div className="px-3 py-2">
              <p className="text-xs text-gray-400 mb-0.5">Cobros registrados</p>
              <p className="text-lg font-bold text-[#293c4f]">{payments.length}</p>
            </div>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card padding="sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por factura, cliente, referencia…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white placeholder-gray-400"
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        {isLoading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-11 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="w-5 h-5" />}
            title="No hay cobros registrados"
            description="Registra el primer cobro de un cliente."
            action={
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setShowNew(true)}
              >
                Nuevo cobro
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Factura', 'Cliente', 'BU', 'Fecha', 'Método', 'Referencia', 'Monto'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-[#293c4f]">
                    {p.invoice.number}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-800">{p.invoice.client.name}</td>
                  <td className="px-3 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={p.invoice.businessUnit === 'HAX'
                        ? { backgroundColor: '#eef1f4', color: '#293c4f' }
                        : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {p.invoice.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{formatDate(p.paidAt)}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">
                    {METHOD_SHORT[p.method] ?? p.method}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-400">{p.reference ?? '—'}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-green-600">
                    {formatCurrency(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 1 && (
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={6} className="px-3 py-2.5 text-xs font-medium text-gray-400 text-right">Total</td>
                  <td className="px-3 py-2.5 text-sm font-bold text-green-600">
                    {formatCurrency(filtered.reduce((s, p) => s + p.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </Card>
    </div>
  )
}
