'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ArrowLeft, Check, X, MinusCircle, Upload, BookOpen, TrendingUp, TrendingDown } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

type RecStatus = 'OPEN' | 'CLOSED'
type TxStatus  = 'UNMATCHED' | 'MATCHED' | 'MATCHED_MANUAL' | 'IGNORED'

interface BankAccount {
  id: string
  name: string
  bank: string
  accountNumber: string
}

interface Reconciliation {
  id: string
  period: string
  status: RecStatus
  notes?: string
  bankAccount: BankAccount
  _count: { transactions: number }
  createdAt: string
}

interface RecTx {
  id: string
  txDate: string
  description: string
  amount: number
  reference?: string
  status: TxStatus
  notes?: string
  matchedPaymentId?: string
  matchedExpenseId?: string
}

interface RecDetail extends Reconciliation {
  transactions: RecTx[]
}

const TX_STATUS_LABEL: Record<TxStatus, string> = {
  UNMATCHED: 'Sin conciliar',
  MATCHED: 'Conciliado',
  MATCHED_MANUAL: 'Conciliado manual',
  IGNORED: 'Ignorado',
}

const TX_STATUS_COLOR: Record<TxStatus, string> = {
  UNMATCHED: 'bg-red-100 text-red-700',
  MATCHED: 'bg-green-100 text-green-700',
  MATCHED_MANUAL: 'bg-blue-100 text-blue-700',
  IGNORED: 'bg-gray-100 text-gray-500',
}

export default function BankReconciliationPage() {
  const [selected, setSelected] = useState<string | null>(null)

  return selected
    ? <ReconciliationDetail id={selected} onBack={() => setSelected(null)} />
    : <ReconciliationList onSelect={setSelected} />
}

// ── List view ─────────────────────────────────────────────────

function ReconciliationList({ onSelect }: { onSelect: (id: string) => void }) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data = [], isLoading } = useQuery<Reconciliation[]>({
    queryKey: ['bank-reconciliations'],
    queryFn: async () => {
      const { data } = await api.get('/bank-reconciliation')
      return data.data ?? data
    },
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conciliación Bancaria"
        subtitle="Conciliación de extractos con registros ERP"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>
            Nueva Conciliación
          </Button>
        }
      />

      <Card padding="sm">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : data.length === 0 ? (
          <EmptyState
            title="Sin conciliaciones"
            description="Crea tu primera conciliación bancaria para comenzar."
            action={<Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>Nueva Conciliación</Button>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Cuenta', 'Banco', 'Período', 'Estado', 'Transacciones', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer transition-colors" onClick={() => onSelect(r.id)}>
                  <td className="px-3 py-3 text-xs font-medium text-gray-800">{r.bankAccount.name}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{r.bankAccount.bank}</td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600">{r.period}</td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                      r.status === 'OPEN' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                      {r.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{r._count.transactions}</td>
                  <td className="px-3 py-3 text-xs text-[#293c4f] font-medium">Ver detalle →</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showModal && <NewReconciliationModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

// ── Detail view ───────────────────────────────────────────────

function ReconciliationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const [showImport, setShowImport] = useState(false)
  const [ignoreModal, setIgnoreModal] = useState<string | null>(null)
  const [classifyModal, setClassifyModal] = useState<RecTx | null>(null)

  const { data: rec, isLoading } = useQuery<RecDetail>({
    queryKey: ['bank-reconciliation', id],
    queryFn: async () => {
      const { data } = await api.get(`/bank-reconciliation/${id}`)
      return data.data ?? data
    },
  })

  const matchTx = useMutation({
    mutationFn: async ({ txId, ...opts }: { txId: string; matchedPaymentId?: string; matchedExpenseId?: string }) =>
      api.patch(`/bank-reconciliation/${id}/transactions/${txId}`, opts),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-reconciliation', id] }),
  })

  const closeRec = useMutation({
    mutationFn: async () => api.post(`/bank-reconciliation/${id}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-reconciliation', id] }),
  })

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
  if (!rec) return null

  const unmatched = rec.transactions.filter((t) => t.status === 'UNMATCHED').length
  const matched   = rec.transactions.filter((t) => t.status === 'MATCHED' || t.status === 'MATCHED_MANUAL').length
  const ignored   = rec.transactions.filter((t) => t.status === 'IGNORED').length
  const totalDebit  = rec.transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalCredit = rec.transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${rec.bankAccount.name} — ${rec.period}`}
        subtitle={`${rec.bankAccount.bank} · ${rec.bankAccount.accountNumber}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={onBack}>Volver</Button>
            {rec.status === 'OPEN' && (
              <>
                <Button variant="secondary" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => setShowImport(true)}>
                  Importar extracto
                </Button>
                {isAdmin && unmatched === 0 && rec.transactions.length > 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Check className="w-3.5 h-3.5" />}
                    loading={closeRec.isPending}
                    onClick={() => {
                      if (confirm('¿Cerrar esta conciliación? No podrás agregar más transacciones.')) {
                        closeRec.mutate()
                      }
                    }}
                  >
                    Cerrar conciliación
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Créditos', value: formatCurrency(totalCredit), color: 'text-green-600' },
          { label: 'Débitos', value: formatCurrency(totalDebit), color: 'text-red-600' },
          { label: 'Sin conciliar', value: unmatched.toString(), color: unmatched > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Conciliados', value: matched.toString(), color: 'text-green-600' },
          { label: 'Ignorados', value: ignored.toString(), color: 'text-gray-500' },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={cn('text-xl font-bold mt-1', s.color)}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Transactions */}
      <Card padding="sm">
        {rec.transactions.length === 0 ? (
          <EmptyState
            title="Sin transacciones"
            description="Importa el extracto bancario para comenzar la conciliación."
            action={rec.status === 'OPEN' ? <Button variant="primary" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => setShowImport(true)}>Importar extracto</Button> : undefined}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Fecha', 'Descripción', 'Referencia', 'Monto', 'Estado', rec.status === 'OPEN' ? 'Acciones' : ''].filter(Boolean).map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rec.transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-3 text-xs font-mono text-gray-500">{tx.txDate.slice(0, 10)}</td>
                  <td className="px-3 py-3 text-xs text-gray-700 max-w-[200px] truncate">{tx.description}</td>
                  <td className="px-3 py-3 text-xs text-gray-400">{tx.reference ?? '—'}</td>
                  <td className={cn('px-3 py-3 text-xs font-semibold', tx.amount >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', TX_STATUS_COLOR[tx.status])}>
                      {TX_STATUS_LABEL[tx.status]}
                    </span>
                  </td>
                  {rec.status === 'OPEN' && (
                    <td className="px-3 py-3">
                      {tx.status === 'UNMATCHED' && (
                        <div className="flex items-center gap-1">
                          <button
                            title="Clasificar y conciliar"
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-[#293c4f] text-white rounded-lg hover:bg-[#1e2d3d] transition-colors"
                            onClick={() => setClassifyModal(tx)}
                          >
                            <BookOpen className="w-3 h-3" />
                            Clasificar
                          </button>
                          <button
                            title="Ignorar"
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                            onClick={() => setIgnoreModal(tx.id)}
                          >
                            <MinusCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showImport && <ImportModal reconciliationId={id} onClose={() => setShowImport(false)} />}
      {ignoreModal && (
        <IgnoreModal
          txId={ignoreModal}
          reconciliationId={id}
          onClose={() => setIgnoreModal(null)}
        />
      )}
      {classifyModal && (
        <ClassifyModal
          tx={classifyModal}
          reconciliationId={id}
          onClose={() => setClassifyModal(null)}
          onSaved={() => {
            setClassifyModal(null)
            qc.invalidateQueries({ queryKey: ['bank-reconciliation', id] })
          }}
        />
      )}
    </div>
  )
}

// ── New Reconciliation Modal ──────────────────────────────────

function NewReconciliationModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [bankAccountId, setBankAccountId] = useState('')
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [notes, setNotes] = useState('')

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts-list'],
    queryFn: async () => {
      const { data } = await api.get('/bank-accounts')
      return data.data ?? data
    },
  })

  const save = useMutation({
    mutationFn: async () => api.post('/bank-reconciliation', { bankAccountId, period, notes: notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-reconciliations'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nueva Conciliación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate() }}
          className="p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta Bancaria *</label>
            <select
              required
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
            >
              <option value="">Seleccionar cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} — {a.bank}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Período *</label>
            <input
              type="month"
              required
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={save.isPending} disabled={!bankAccountId}>Crear</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Import Modal ──────────────────────────────────────────────

function ImportModal({ reconciliationId, onClose }: { reconciliationId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [csvText, setCsvText] = useState('')
  const [error, setError] = useState('')

  const importMutation = useMutation({
    mutationFn: async (transactions: any[]) =>
      api.post(`/bank-reconciliation/${reconciliationId}/import`, { transactions }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-reconciliation', reconciliationId] })
      onClose()
    },
  })

  function parseCsv(text: string) {
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) throw new Error('El CSV debe tener encabezado y al menos una fila')

    return lines.slice(1).map((line, i) => {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 3) throw new Error(`Fila ${i + 2}: se esperan al menos 3 columnas (fecha, descripción, monto)`)
      const [txDate, description, amountStr, reference] = cols
      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''))
      if (isNaN(amount)) throw new Error(`Fila ${i + 2}: monto inválido "${amountStr}"`)
      return { txDate, description: description || 'Sin descripción', amount, reference: reference || undefined }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const txns = parseCsv(csvText)
      importMutation.mutate(txns)
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Importar Extracto Bancario</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Pega el CSV del extracto. Formato: <code className="bg-gray-100 px-1 rounded">fecha,descripcion,monto,referencia</code>
            <br />Ejemplo: <code className="bg-gray-100 px-1 rounded">2026-04-01,Deposito cliente,15000.00,CHK-001</code>
            <br /><span className="text-gray-400">Los débitos deben ser negativos (ej: -5000.00)</span>
          </p>
          <textarea
            rows={8}
            required
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#293c4f] resize-none"
            placeholder={'fecha,descripcion,monto,referencia\n2026-04-01,Deposito cliente,15000.00,CHK-001\n2026-04-03,Pago proveedor,-8500.00,TRF-002'}
          />
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={importMutation.isPending}>Importar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Classify Modal ────────────────────────────────────────────

function ClassifyModal({ tx, reconciliationId, onClose, onSaved }: {
  tx: RecTx
  reconciliationId: string
  onClose: () => void
  onSaved: () => void
}) {
  const isCredit = tx.amount >= 0
  const [accountCode, setAccountCode]         = useState('')
  const [acctSearch, setAcctSearch]           = useState('')
  const [acctOpen, setAcctOpen]               = useState(false)
  const [matchedPaymentId, setMatchedPaymentId]   = useState('')
  const [matchedExpenseId, setMatchedExpenseId]   = useState('')
  const [classifiedInvoiceId, setClassifiedInvoiceId] = useState('')
  const [saving, setSaving]                   = useState(false)
  const [err, setErr]                         = useState('')

  // Load chart of accounts
  const { data: accounts = [] } = useQuery<{ id: string; code: string; name: string; type: string; allowsEntry: boolean }[]>({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/accounting/accounts')
      return (data.data ?? data).filter((a: any) => a.allowsEntry)
    },
  })

  // Load pending invoices (for credits)
  const { data: invoices = [] } = useQuery<{ id: string; number: string; total: number; client?: { name: string } }[]>({
    queryKey: ['invoices-pending-reconcile'],
    enabled: isCredit,
    queryFn: async () => {
      const { data } = await api.get('/invoices', { params: { paymentStatus: 'PENDING', limit: 100 } })
      return data.data ?? data
    },
  })

  // Load payments (for credits)
  const { data: payments = [] } = useQuery<{ id: string; amount: number; method: string; paidAt: string }[]>({
    queryKey: ['payments-list'],
    enabled: isCredit,
    queryFn: async () => {
      const { data } = await api.get('/payments', { params: { limit: 100 } })
      return data.data ?? data
    },
  })

  // Load expenses (for debits)
  const { data: expenses = [] } = useQuery<{ id: string; description: string; total: number; expenseDate: string }[]>({
    queryKey: ['expenses-list-reconcile'],
    enabled: !isCredit,
    queryFn: async () => {
      const { data } = await api.get('/expenses', { params: { status: 'APPROVED', limit: 100 } })
      return data.data ?? data
    },
  })

  const relevantAccounts = accounts.filter(a =>
    isCredit ? ['INCOME', 'ASSET'].includes(a.type) : ['EXPENSE', 'LIABILITY'].includes(a.type)
  )
  const filteredAccounts = acctSearch
    ? relevantAccounts.filter(a => a.code.toLowerCase().includes(acctSearch.toLowerCase()) || a.name.toLowerCase().includes(acctSearch.toLowerCase()))
    : relevantAccounts
  const selectedAccount = relevantAccounts.find(a => a.code === accountCode)

  async function handleSave() {
    if (!accountCode) { setErr('Selecciona una cuenta contable'); return }
    setSaving(true); setErr('')
    try {
      await api.patch(`/bank-reconciliation/${reconciliationId}/transactions/${tx.id}`, {
        accountCode,
        ...(isCredit && matchedPaymentId ? { matchedPaymentId } : {}),
        ...(isCredit && classifiedInvoiceId ? { classifiedInvoiceId } : {}),
        ...(!isCredit && matchedExpenseId ? { matchedExpenseId } : {}),
      })
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 ${isCredit ? 'bg-green-600' : 'bg-red-600'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isCredit ? <TrendingUp className="w-4 h-4 text-white" /> : <TrendingDown className="w-4 h-4 text-white" />}
              <h2 className="text-white font-semibold text-sm">
                {isCredit ? 'Clasificar ingreso' : 'Clasificar egreso'}
              </h2>
            </div>
            <button onClick={onClose}><X className="w-5 h-5 text-white/70 hover:text-white" /></button>
          </div>
          <p className="text-white/80 text-xs mt-1 truncate">{tx.description}</p>
          <p className={`text-lg font-bold mt-0.5 ${isCredit ? 'text-green-100' : 'text-red-100'}`}>
            {isCredit ? '+' : ''}{new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(tx.amount)}
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Account selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Cuenta contable *
              <span className="ml-1 text-gray-400 font-normal">({isCredit ? 'Ingresos / Activos' : 'Gastos / Pasivos'})</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAcctOpen(o => !o)}
                className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm text-left bg-white focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
              >
                {selectedAccount
                  ? <span><span className="font-mono text-[#293c4f] mr-2">{selectedAccount.code}</span>{selectedAccount.name}</span>
                  : <span className="text-gray-400">Seleccionar cuenta…</span>}
                <span className="text-gray-300 ml-2">▾</span>
              </button>
              {acctOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg">
                  <div className="p-2 border-b border-gray-100">
                    <input autoFocus type="text" placeholder="Buscar…" value={acctSearch}
                      onChange={e => setAcctSearch(e.target.value)}
                      className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none" />
                  </div>
                  <ul className="max-h-48 overflow-y-auto py-1">
                    {filteredAccounts.map(a => (
                      <li key={a.id} onClick={() => { setAccountCode(a.code); setAcctOpen(false); setAcctSearch('') }}
                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 flex gap-3 ${accountCode === a.code ? 'bg-[#293c4f]/5 text-[#293c4f]' : ''}`}>
                        <span className="font-mono text-xs text-[#293c4f] w-16 shrink-0">{a.code}</span>
                        <span className="truncate">{a.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Credit: link to invoice or payment */}
          {isCredit && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Factura correspondiente (opcional)</label>
                <select value={classifiedInvoiceId} onChange={e => setClassifiedInvoiceId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f]">
                  <option value="">Sin factura asociada</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.number} — {inv.client?.name} — {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(inv.total)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cobro ERP correspondiente (opcional)</label>
                <select value={matchedPaymentId} onChange={e => setMatchedPaymentId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f]">
                  <option value="">Sin cobro asociado</option>
                  {payments.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.method} — {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(p.amount)} — {p.paidAt?.slice(0, 10)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Debit: link to expense */}
          {!isCredit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gasto ERP correspondiente (opcional)</label>
              <select value={matchedExpenseId} onChange={e => setMatchedExpenseId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f]">
                <option value="">Sin gasto asociado</option>
                {expenses.map(exp => (
                  <option key={exp.id} value={exp.id}>
                    {exp.description} — {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(exp.total)} — {exp.expenseDate?.slice(0, 10)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Guardar clasificación
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Ignore Modal ──────────────────────────────────────────────

function IgnoreModal({ txId, reconciliationId, onClose }: { txId: string; reconciliationId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')

  const ignoreMutation = useMutation({
    mutationFn: async () =>
      api.patch(`/bank-reconciliation/${reconciliationId}/transactions/${txId}/ignore`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-reconciliation', reconciliationId] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Ignorar transacción</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ignoreMutation.mutate() }} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Motivo</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] resize-none"
              placeholder="Transacción duplicada, comisión bancaria, etc."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={ignoreMutation.isPending}>Ignorar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
