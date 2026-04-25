'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, X, ArrowUpCircle, ArrowDownCircle, Search,
  RefreshCw, Eye, MoreHorizontal, Landmark, Wallet, CreditCard,
  ChevronLeft, ChevronRight, Upload, BookOpen, Check,
  MinusCircle, TrendingUp, TrendingDown, ArrowLeft,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface BankAccount {
  id: string; name: string; accountNumber: string | null
  bank: string | null; currency: string; balance: number
  businessUnit?: 'HAX' | 'KODER' | null; isActive: boolean
}
interface BankTransaction {
  id: string; type: 'CREDIT' | 'DEBIT'; amount: number
  description: string; balance: number; date: string; reference: string | null
}
interface AddTxBody {
  type: 'CREDIT' | 'DEBIT'; amount: number; description: string
  reference?: string; date: string
}

type RecStatus = 'OPEN' | 'CLOSED'
type TxStatus  = 'UNMATCHED' | 'MATCHED' | 'MATCHED_MANUAL' | 'IGNORED'

interface Reconciliation {
  id: string; period: string; status: RecStatus; notes?: string
  bankAccount: { id: string; name: string; bank: string; accountNumber: string }
  _count: { transactions: number }; createdAt: string
}
interface RecTx {
  id: string; txDate: string; description: string; amount: number
  reference?: string; status: TxStatus; notes?: string
  matchedPaymentId?: string; matchedExpenseId?: string
}
interface RecDetail extends Reconciliation { transactions: RecTx[] }

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const EMPTY_ACCT = { name: '', accountNumber: '', bank: '', currency: 'DOP' }
const EMPTY_TX: AddTxBody = {
  type: 'CREDIT', amount: 0, description: '', reference: '',
  date: new Date().toISOString().slice(0, 10),
}
const PERIODS = ['6M', '3M', '7D'] as const
type Period = typeof PERIODS[number]
const PAGE_SIZES = [5, 10, 25]

const TX_STATUS_LABEL: Record<TxStatus, string> = {
  UNMATCHED: 'Sin conciliar', MATCHED: 'Conciliado',
  MATCHED_MANUAL: 'Conciliado manual', IGNORED: 'Ignorado',
}
const TX_STATUS_COLOR: Record<TxStatus, string> = {
  UNMATCHED: 'bg-red-100 text-red-700', MATCHED: 'bg-emerald-100 text-emerald-700',
  MATCHED_MANUAL: 'bg-blue-100 text-blue-700', IGNORED: 'bg-gray-100 text-gray-500',
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function acctType(a: BankAccount): 'bank' | 'card' | 'cash' {
  const s = `${a.name} ${a.bank ?? ''}`.toLowerCase()
  if (s.includes('tarjeta') || s.includes('crédito') || s.includes('credito') || s.includes('credit')) return 'card'
  if (s.includes('caja') || s.includes('efectivo') || s.includes('cash')) return 'cash'
  return 'bank'
}

function TypeBadge({ account }: { account: BankAccount }) {
  const t = acctType(account)
  if (t === 'card') return <span className="flex items-center gap-1.5 text-xs text-gray-500"><CreditCard className="w-3.5 h-3.5 text-gray-400" /> Tarjeta de crédito</span>
  if (t === 'cash') return <span className="flex items-center gap-1.5 text-xs text-gray-500"><Wallet className="w-3.5 h-3.5 text-gray-400" /> Efectivo</span>
  return <span className="flex items-center gap-1.5 text-xs text-gray-500"><Landmark className="w-3.5 h-3.5 text-gray-400" /> Banco</span>
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs shadow-lg">
      <p className="text-gray-400 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">{p.name}: {formatCurrency(p.value)}</p>
      ))}
    </div>
  )
}

const ic = 'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-[#293c4f]/40 transition-colors'

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function BankPage() {
  const [tab, setTab] = useState<'accounts' | 'reconciliation'>('accounts')

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bancos"
        subtitle="Cuentas bancarias, transacciones y conciliación de extractos."
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { key: 'accounts',       label: 'Cuentas' },
          { key: 'reconciliation', label: 'Conciliación' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === t.key
                ? 'bg-white text-[#293c4f] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts'       && <AccountsTab />}
      {tab === 'reconciliation' && <ReconciliationTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Tab 1: Accounts
// ─────────────────────────────────────────────────────────────

function AccountsTab() {
  const qc = useQueryClient()
  const [selected,  setSelected]  = useState<BankAccount | null>(null)
  const [newAcct,   setNewAcct]   = useState<any | null>(null)
  const [addTx,     setAddTx]     = useState<AddTxBody | null>(null)
  const [search,    setSearch]    = useState('')
  const [period,    setPeriod]    = useState<Period>('6M')
  const [page,      setPage]      = useState(1)
  const [pageSize,  setPageSize]  = useState(10)
  const [openMenu,  setOpenMenu]  = useState<string | null>(null)

  const { data: accounts = [], isLoading, refetch, isFetching } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: async () => { const { data } = await api.get('/bank-accounts'); return data.data ?? data },
  })

  const { data: transactions = [] } = useQuery<BankTransaction[]>({
    queryKey: ['bank-transactions', selected?.id],
    queryFn: async () => { const { data } = await api.get(`/bank-accounts/${selected!.id}/transactions`); return data.data ?? data },
    enabled: !!selected,
  })

  const { data: chartData = [] } = useQuery({
    queryKey: ['bank-chart', period],
    queryFn: async () => {
      const now    = new Date()
      const months = period === '6M' ? 6 : period === '3M' ? 3 : 1
      const results = await Promise.all(
        Array.from({ length: months }, async (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
          const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          try {
            const { data } = await api.get(`/reports/pnl/${p}`)
            const payload = data?.data ?? data
            return { mes: d.toLocaleDateString('es-DO', { month: 'short' }), Ingresos: payload?.grossRevenue ?? 0, Gastos: payload?.totalExpenses ?? 0 }
          } catch {
            return { mes: d.toLocaleDateString('es-DO', { month: 'short' }), Ingresos: 0, Gastos: 0 }
          }
        })
      )
      if (period === '7D') {
        return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (6 - i))
          return { mes: d.toLocaleDateString('es-DO', { weekday: 'short' }), Ingresos: 0, Gastos: 0 }
        })
      }
      return results
    },
    staleTime: 5 * 60 * 1000,
  })

  const saveAcct = useMutation({
    mutationFn: (body: any) => api.post('/bank-accounts', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-accounts'] }); setNewAcct(null) },
  })

  const saveTx = useMutation({
    mutationFn: (body: AddTxBody) => api.post(`/bank-accounts/${selected!.id}/transactions`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['bank-transactions', selected?.id] })
      setAddTx(null)
    },
  })

  const bankBalance = accounts.filter(a => acctType(a) !== 'card').reduce((s, a) => s + a.balance, 0)
  const cardDebt    = accounts.filter(a => acctType(a) === 'card' && a.balance < 0).reduce((s, a) => s + a.balance, 0)

  const filtered   = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.accountNumber ?? '').includes(search) || (a.bank ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <>
      {/* Stats + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="flex flex-col gap-4">
          <Card padding="md">
            <p className="text-xs text-gray-400 font-medium mb-1">Saldo en bancos y efectivo</p>
            <p className={cn('text-2xl font-bold tracking-tight', bankBalance >= 0 ? 'text-emerald-600' : 'text-red-500')}>{formatCurrency(bankBalance)}</p>
            <p className="text-xs text-gray-300 mt-1">Última actualización: {new Date().toLocaleDateString('es-DO')}</p>
          </Card>
          <Card padding="md">
            <p className="text-xs text-gray-400 font-medium mb-1">Deuda en tarjetas de crédito</p>
            <p className={cn('text-2xl font-bold tracking-tight', cardDebt < 0 ? 'text-red-500' : 'text-emerald-600')}>{formatCurrency(Math.abs(cardDebt))}</p>
            <p className="text-xs text-gray-300 mt-1">Última actualización: {new Date().toLocaleDateString('es-DO')}</p>
          </Card>
        </div>
        <Card padding="md" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">Ingresos y gastos</p>
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100">
              {PERIODS.map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all',
                    period === p ? 'bg-[#293c4f]/10 text-[#293c4f]' : 'text-gray-400 hover:text-gray-600')}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.4)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(0,0,0,0.4)' }} axisLine={false} tickLine={false}
                tickFormatter={v => v === 0 ? '$0' : `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={6}
                formatter={(v) => <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 11 }}>{v}</span>} />
              <Line type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Gastos"   stroke="#f87171" strokeWidth={2} dot={{ r: 3, fill: '#f87171' }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Table */}
      <Card padding="sm">
        <div className="flex items-center justify-between gap-3 mb-4 px-1">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Buscar bancos..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-lg text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-gray-300 transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm"
              icon={<RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />}
              onClick={() => refetch()}>
              Actualizar
            </Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setNewAcct({ ...EMPTY_ACCT })}>
              Agregar banco
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Landmark className="w-5 h-5" />} title="No hay cuentas bancarias"
            description="Agrega tus cuentas para hacer seguimiento de tu liquidez."
            action={<Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewAcct({ ...EMPTY_ACCT })}>Agregar banco</Button>} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Nombre', 'Tipo', 'Número de cuenta', 'Estado', 'Saldo', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map(a => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
                  <td className="px-3 py-3">
                    <p className="text-sm font-medium text-gray-800">{a.name}</p>
                    {a.bank && <p className="text-xs text-gray-400 mt-0.5">{a.bank}</p>}
                  </td>
                  <td className="px-3 py-3"><TypeBadge account={a} /></td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-400">{a.accountNumber || '—'}</td>
                  <td className="px-3 py-3">
                    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', a.isActive ? 'text-gray-400' : 'text-red-500')}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', a.isActive ? 'bg-gray-300' : 'bg-red-400')} />
                      {a.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('text-sm font-semibold', a.balance >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                      {formatCurrency(a.balance)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setSelected(a)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <div className="relative">
                        <button onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {openMenu === a.id && (
                          <div onClick={() => setOpenMenu(null)}
                            className="absolute right-0 top-8 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                            <button onClick={() => setSelected(a)}
                              className="w-full text-left px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors">
                              Ver transacciones
                            </button>
                            <button onClick={() => { setSelected(a); setAddTx({ ...EMPTY_TX }) }}
                              className="w-full text-left px-4 py-2 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors">
                              Nueva transacción
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 px-1">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Items por página:</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-600 text-xs focus:outline-none">
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>{Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} de {filtered.length}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Página</span>
              <span className="w-8 text-center font-medium text-gray-600">{page}</span>
              <span>de {totalPages}</span>
              <div className="flex items-center gap-1 ml-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Transaction slide-over */}
      {selected && !addTx && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelected(null)}>
          <div className="flex-1" />
          <div className="w-full max-w-lg bg-white border-l border-gray-100 shadow-2xl overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">{selected.name}</p>
                <p className={cn('text-sm font-bold mt-0.5', selected.balance >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                  {formatCurrency(selected.balance)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => setAddTx({ ...EMPTY_TX })}>
                  Transacción
                </Button>
                <button onClick={() => setSelected(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-6">
              {transactions.length === 0 ? (
                <EmptyState title="No hay transacciones" description="Registra la primera transacción." />
              ) : (
                <div className="space-y-1">
                  {transactions.map(t => (
                    <div key={t.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        {t.type === 'CREDIT'
                          ? <ArrowUpCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          : <ArrowDownCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        <div>
                          <p className="text-xs font-medium text-gray-700">{t.description}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.date)}{t.reference ? ` · ${t.reference}` : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-xs font-semibold', t.type === 'CREDIT' ? 'text-emerald-600' : 'text-red-500')}>
                          {t.type === 'CREDIT' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                        <p className="text-xs text-gray-300 mt-0.5">{formatCurrency(t.balance)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add transaction modal */}
      {addTx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-800">Nueva transacción</h2>
              <button onClick={() => setAddTx(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <F label="Tipo">
                <select value={addTx.type} onChange={e => setAddTx({ ...addTx, type: e.target.value as 'CREDIT' | 'DEBIT' })} className={ic}>
                  <option value="CREDIT">Crédito (entrada)</option>
                  <option value="DEBIT">Débito (salida)</option>
                </select>
              </F>
              <F label="Monto (DOP) *">
                <input type="number" min="0" step="0.01" value={addTx.amount}
                  onChange={e => setAddTx({ ...addTx, amount: parseFloat(e.target.value) || 0 })} className={ic} />
              </F>
              <F label="Descripción *">
                <input type="text" value={addTx.description}
                  onChange={e => setAddTx({ ...addTx, description: e.target.value })} className={ic} />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Fecha">
                  <input type="date" value={addTx.date}
                    onChange={e => setAddTx({ ...addTx, date: e.target.value })} className={ic} />
                </F>
                <F label="Referencia">
                  <input type="text" value={addTx.reference ?? ''}
                    onChange={e => setAddTx({ ...addTx, reference: e.target.value })} className={ic} />
                </F>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setAddTx(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" loading={saveTx.isPending} onClick={() => saveTx.mutate(addTx)}>Registrar</Button>
            </div>
          </div>
        </div>
      )}

      {/* New account modal */}
      {newAcct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-800">Nueva cuenta bancaria</h2>
              <button onClick={() => setNewAcct(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <F label="Nombre de la cuenta *">
                <input type="text" value={newAcct.name}
                  onChange={e => setNewAcct({ ...newAcct, name: e.target.value })} className={ic} />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Banco">
                  <input type="text" value={newAcct.bank}
                    onChange={e => setNewAcct({ ...newAcct, bank: e.target.value })} className={ic} />
                </F>
                <F label="Número de cuenta">
                  <input type="text" value={newAcct.accountNumber}
                    onChange={e => setNewAcct({ ...newAcct, accountNumber: e.target.value })} className={ic} />
                </F>
              </div>
              <F label="Moneda">
                <select value={newAcct.currency}
                  onChange={e => setNewAcct({ ...newAcct, currency: e.target.value })} className={ic}>
                  <option value="DOP">DOP</option>
                  <option value="USD">USD</option>
                </select>
              </F>
              <F label="Balance inicial (DOP)">
                <input type="number" min="0" step="0.01" defaultValue={0}
                  onChange={e => setNewAcct({ ...newAcct, initialBalance: parseFloat(e.target.value) || 0 })} className={ic} />
              </F>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setNewAcct(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" loading={saveAcct.isPending} onClick={() => saveAcct.mutate(newAcct)}>Crear</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Tab 2: Reconciliation
// ─────────────────────────────────────────────────────────────

function ReconciliationTab() {
  const [selected, setSelected] = useState<string | null>(null)

  return selected
    ? <ReconciliationDetail id={selected} onBack={() => setSelected(null)} />
    : <ReconciliationList onSelect={setSelected} />
}

function ReconciliationList({ onSelect }: { onSelect: (id: string) => void }) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data = [], isLoading } = useQuery<Reconciliation[]>({
    queryKey: ['bank-reconciliations'],
    queryFn: async () => { const { data } = await api.get('/bank-reconciliation'); return data.data ?? data },
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>
          Nueva conciliación
        </Button>
      </div>

      <Card padding="sm">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : data.length === 0 ? (
          <EmptyState title="Sin conciliaciones" description="Crea tu primera conciliación bancaria para comenzar."
            action={<Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>Nueva conciliación</Button>} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Cuenta', 'Banco', 'Período', 'Estado', 'Transacciones', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
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

function ReconciliationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const [showImport, setShowImport]     = useState(false)
  const [ignoreModal, setIgnoreModal]   = useState<string | null>(null)
  const [classifyModal, setClassifyModal] = useState<RecTx | null>(null)

  const { data: rec, isLoading } = useQuery<RecDetail>({
    queryKey: ['bank-reconciliation', id],
    queryFn: async () => { const { data } = await api.get(`/bank-reconciliation/${id}`); return data.data ?? data },
  })

  const closeRec = useMutation({
    mutationFn: async () => api.post(`/bank-reconciliation/${id}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-reconciliation', id] }),
  })

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
  if (!rec) return null

  const unmatched    = rec.transactions.filter(t => t.status === 'UNMATCHED').length
  const matched      = rec.transactions.filter(t => t.status === 'MATCHED' || t.status === 'MATCHED_MANUAL').length
  const ignored      = rec.transactions.filter(t => t.status === 'IGNORED').length
  const totalDebit   = rec.transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalCredit  = rec.transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-4">
      {/* Sub-header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="font-semibold text-gray-800">{rec.bankAccount.name} — {rec.period}</p>
            <p className="text-xs text-gray-400">{rec.bankAccount.bank} · {rec.bankAccount.accountNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rec.status === 'OPEN' && (
            <>
              <Button variant="secondary" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => setShowImport(true)}>
                Importar extracto
              </Button>
              {isAdmin && unmatched === 0 && rec.transactions.length > 0 && (
                <Button variant="primary" size="sm" icon={<Check className="w-3.5 h-3.5" />} loading={closeRec.isPending}
                  onClick={() => { if (confirm('¿Cerrar esta conciliación?')) closeRec.mutate() }}>
                  Cerrar conciliación
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Créditos',      value: formatCurrency(totalCredit), color: 'text-emerald-600' },
          { label: 'Débitos',       value: formatCurrency(totalDebit),  color: 'text-red-600' },
          { label: 'Sin conciliar', value: unmatched.toString(), color: unmatched > 0 ? 'text-red-600' : 'text-emerald-600' },
          { label: 'Conciliados',   value: matched.toString(),  color: 'text-emerald-600' },
          { label: 'Ignorados',     value: ignored.toString(),  color: 'text-gray-500' },
        ].map(s => (
          <Card key={s.label}>
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={cn('text-xl font-bold mt-1', s.color)}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Transactions table */}
      <Card padding="sm">
        {rec.transactions.length === 0 ? (
          <EmptyState title="Sin transacciones" description="Importa el extracto bancario para comenzar la conciliación."
            action={rec.status === 'OPEN'
              ? <Button variant="primary" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={() => setShowImport(true)}>Importar extracto</Button>
              : undefined} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Fecha', 'Descripción', 'Referencia', 'Monto', 'Estado', rec.status === 'OPEN' ? 'Acciones' : ''].filter(Boolean).map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rec.transactions.map(tx => (
                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-3 py-3 text-xs font-mono text-gray-500">{tx.txDate.slice(0, 10)}</td>
                  <td className="px-3 py-3 text-xs text-gray-700 max-w-[200px] truncate">{tx.description}</td>
                  <td className="px-3 py-3 text-xs text-gray-400">{tx.reference ?? '—'}</td>
                  <td className={cn('px-3 py-3 text-xs font-semibold', tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600')}>
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
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-[#293c4f] text-white rounded-lg hover:bg-[#1e2d3d] transition-colors"
                            onClick={() => setClassifyModal(tx)}>
                            <BookOpen className="w-3 h-3" /> Clasificar
                          </button>
                          <button
                            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                            onClick={() => setIgnoreModal(tx.id)}>
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

      {showImport    && <ImportModal reconciliationId={id} onClose={() => setShowImport(false)} />}
      {ignoreModal   && <IgnoreModal txId={ignoreModal} reconciliationId={id} onClose={() => setIgnoreModal(null)} />}
      {classifyModal && (
        <ClassifyModal tx={classifyModal} reconciliationId={id} onClose={() => setClassifyModal(null)}
          onSaved={() => { setClassifyModal(null); qc.invalidateQueries({ queryKey: ['bank-reconciliation', id] }) }} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────

function NewReconciliationModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [bankAccountId, setBankAccountId] = useState('')
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [notes, setNotes] = useState('')

  const { data: accounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts-list'],
    queryFn: async () => { const { data } = await api.get('/bank-accounts'); return data.data ?? data },
  })

  const save = useMutation({
    mutationFn: async () => api.post('/bank-reconciliation', { bankAccountId, period, notes: notes || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-reconciliations'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Nueva conciliación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); save.mutate() }} className="p-6 space-y-4">
          <F label="Cuenta bancaria *">
            <select required value={bankAccountId} onChange={e => setBankAccountId(e.target.value)} className={ic}>
              <option value="">Seleccionar cuenta</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` — ${a.bank}` : ''}</option>)}
            </select>
          </F>
          <F label="Período *">
            <input type="month" required value={period} onChange={e => setPeriod(e.target.value)} className={ic} />
          </F>
          <F label="Notas (opcional)">
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={cn(ic, 'resize-none')} />
          </F>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={save.isPending} disabled={!bankAccountId}>Crear</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ImportModal({ reconciliationId, onClose }: { reconciliationId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [csvText, setCsvText] = useState('')
  const [error, setError]     = useState('')

  const importMutation = useMutation({
    mutationFn: async (transactions: any[]) =>
      api.post(`/bank-reconciliation/${reconciliationId}/import`, { transactions }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-reconciliation', reconciliationId] }); onClose() },
  })

  function parseCsv(text: string) {
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) throw new Error('El CSV debe tener encabezado y al menos una fila')
    return lines.slice(1).map((line, i) => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 3) throw new Error(`Fila ${i + 2}: se esperan al menos 3 columnas`)
      const [txDate, description, amountStr, reference] = cols
      const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''))
      if (isNaN(amount)) throw new Error(`Fila ${i + 2}: monto inválido "${amountStr}"`)
      return { txDate, description: description || 'Sin descripción', amount, reference: reference || undefined }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    try { importMutation.mutate(parseCsv(csvText)) }
    catch (err: any) { setError(err.message) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Importar extracto bancario</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Pega el CSV del extracto. Formato: <code className="bg-gray-100 px-1 rounded">fecha,descripcion,monto,referencia</code><br />
            Ejemplo: <code className="bg-gray-100 px-1 rounded">2026-04-01,Deposito cliente,15000.00,CHK-001</code><br />
            <span className="text-gray-400">Los débitos deben ser negativos (ej: -5000.00)</span>
          </p>
          <textarea rows={8} required value={csvText} onChange={e => setCsvText(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#293c4f]/40 resize-none"
            placeholder={'fecha,descripcion,monto,referencia\n2026-04-01,Deposito cliente,15000.00,CHK-001\n2026-04-03,Pago proveedor,-8500.00,TRF-002'} />
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

function ClassifyModal({ tx, reconciliationId, onClose, onSaved }: {
  tx: RecTx; reconciliationId: string; onClose: () => void; onSaved: () => void
}) {
  const isCredit = tx.amount >= 0
  const [accountCode, setAccountCode]           = useState('')
  const [acctSearch, setAcctSearch]             = useState('')
  const [acctOpen, setAcctOpen]                 = useState(false)
  const [matchedPaymentId, setMatchedPaymentId] = useState('')
  const [matchedExpenseId, setMatchedExpenseId] = useState('')
  const [classifiedInvoiceId, setClassifiedInvoiceId] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const { data: accounts = [] } = useQuery<{ id: string; code: string; name: string; type: string; allowsEntry: boolean }[]>({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => { const { data } = await api.get('/accounting/accounts'); return (data.data ?? data).filter((a: any) => a.allowsEntry) },
  })
  const { data: invoices = [] } = useQuery<{ id: string; number: string; total: number; client?: { name: string } }[]>({
    queryKey: ['invoices-pending-reconcile'],
    enabled: isCredit,
    queryFn: async () => { const { data } = await api.get('/invoices', { params: { paymentStatus: 'PENDING', limit: 100 } }); return data.data ?? data },
  })
  const { data: payments = [] } = useQuery<{ id: string; amount: number; method: string; paidAt: string }[]>({
    queryKey: ['payments-list'],
    enabled: isCredit,
    queryFn: async () => { const { data } = await api.get('/payments', { params: { limit: 100 } }); return data.data ?? data },
  })
  const { data: expenses = [] } = useQuery<{ id: string; description: string; total: number; expenseDate: string }[]>({
    queryKey: ['expenses-list-reconcile'],
    enabled: !isCredit,
    queryFn: async () => { const { data } = await api.get('/expenses', { params: { status: 'APPROVED', limit: 100 } }); return data.data ?? data },
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
        ...(isCredit && matchedPaymentId    ? { matchedPaymentId }      : {}),
        ...(isCredit && classifiedInvoiceId ? { classifiedInvoiceId }   : {}),
        ...(!isCredit && matchedExpenseId   ? { matchedExpenseId }      : {}),
      })
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className={`px-6 py-4 ${isCredit ? 'bg-emerald-600' : 'bg-red-600'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isCredit ? <TrendingUp className="w-4 h-4 text-white" /> : <TrendingDown className="w-4 h-4 text-white" />}
              <h2 className="text-white font-semibold text-sm">{isCredit ? 'Clasificar ingreso' : 'Clasificar egreso'}</h2>
            </div>
            <button onClick={onClose}><X className="w-5 h-5 text-white/70 hover:text-white" /></button>
          </div>
          <p className="text-white/80 text-xs mt-1 truncate">{tx.description}</p>
          <p className={`text-lg font-bold mt-0.5 ${isCredit ? 'text-emerald-100' : 'text-red-100'}`}>
            {isCredit ? '+' : ''}{new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(tx.amount)}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Cuenta contable * <span className="text-gray-400 font-normal">({isCredit ? 'Ingresos / Activos' : 'Gastos / Pasivos'})</span>
            </label>
            <div className="relative">
              <button type="button" onClick={() => setAcctOpen(o => !o)}
                className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm text-left bg-white focus:outline-none focus:ring-1 focus:ring-[#293c4f]/40">
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
                        className={cn('px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 flex gap-3', accountCode === a.code ? 'bg-[#293c4f]/5 text-[#293c4f]' : '')}>
                        <span className="font-mono text-xs text-[#293c4f] w-16 shrink-0">{a.code}</span>
                        <span className="truncate">{a.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {isCredit && (
            <>
              <F label="Factura correspondiente (opcional)">
                <select value={classifiedInvoiceId} onChange={e => setClassifiedInvoiceId(e.target.value)} className={ic}>
                  <option value="">Sin factura asociada</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.number} — {inv.client?.name} — {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(inv.total)}
                    </option>
                  ))}
                </select>
              </F>
              <F label="Cobro ERP correspondiente (opcional)">
                <select value={matchedPaymentId} onChange={e => setMatchedPaymentId(e.target.value)} className={ic}>
                  <option value="">Sin cobro asociado</option>
                  {payments.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.method} — {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(p.amount)} — {p.paidAt?.slice(0, 10)}
                    </option>
                  ))}
                </select>
              </F>
            </>
          )}

          {!isCredit && (
            <F label="Gasto ERP correspondiente (opcional)">
              <select value={matchedExpenseId} onChange={e => setMatchedExpenseId(e.target.value)} className={ic}>
                <option value="">Sin gasto asociado</option>
                {expenses.map(exp => (
                  <option key={exp.id} value={exp.id}>
                    {exp.description} — {new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(exp.total)} — {exp.expenseDate?.slice(0, 10)}
                  </option>
                ))}
              </select>
            </F>
          )}

          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>Guardar clasificación</Button>
        </div>
      </div>
    </div>
  )
}

function IgnoreModal({ txId, reconciliationId, onClose }: { txId: string; reconciliationId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')

  const ignoreMutation = useMutation({
    mutationFn: async () => api.patch(`/bank-reconciliation/${reconciliationId}/transactions/${txId}/ignore`, { notes }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-reconciliation', reconciliationId] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Ignorar transacción</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); ignoreMutation.mutate() }} className="p-6 space-y-4">
          <F label="Motivo">
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              className={cn(ic, 'resize-none')}
              placeholder="Transacción duplicada, comisión bancaria, etc." />
          </F>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={ignoreMutation.isPending}>Ignorar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
