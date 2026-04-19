'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, RefreshCw, Lock } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState, Badge } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

type Tab = 'journal' | 'accounts' | 'trial-balance' | 'periods'

interface Account {
  id: string
  code: string
  name: string
  type: string
  balance: number
}

interface JournalEntry {
  id: string
  type: string
  description: string
  amount: number
  period: string
  businessUnit: string
  createdAt: string
  debitAccount: Account
  creditAccount: Account
}

interface TrialBalanceLine {
  accountCode: string
  accountName: string
  type: string
  totalDebit: number
  totalCredit: number
  balance: number
}

interface FiscalPeriod {
  period: string
  status: 'OPEN' | 'CLOSED'
  closedAt?: string
  closedBy?: { name: string }
  entryCount: number
  totalDebit: number
}

const TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Factura', PAYMENT: 'Cobro', EXPENSE: 'Gasto', CREDIT_NOTE: 'Nota Crédito', MANUAL: 'Manual', DEPRECIATION: 'Depreciación',
}

const TYPE_COLOR: Record<string, string> = {
  INVOICE: 'bg-blue-100 text-blue-700', PAYMENT: 'bg-green-100 text-green-700',
  EXPENSE: 'bg-orange-100 text-orange-700', CREDIT_NOTE: 'bg-yellow-100 text-yellow-700',
  MANUAL: 'bg-gray-100 text-gray-600', DEPRECIATION: 'bg-purple-100 text-purple-700',
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  ASSET: 'Activo', LIABILITY: 'Pasivo', EQUITY: 'Patrimonio', INCOME: 'Ingreso', EXPENSE: 'Gasto',
}

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('journal')
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [bu, setBu] = useState('')
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contabilidad"
        subtitle="Asientos · Plan de cuentas · Balance de comprobación"
        actions={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700"
            />
            <select
              value={bu}
              onChange={(e) => setBu(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700"
            >
              <option value="">Ambas BU</option>
              <option value="HAX">HAX</option>
              <option value="KODER">KODER</option>
            </select>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {([
          { key: 'journal', label: 'Asientos' },
          { key: 'accounts', label: 'Plan de Cuentas' },
          { key: 'trial-balance', label: 'Balance de Comprobación' },
          { key: 'periods', label: 'Períodos' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === key
                ? 'border-[#293c4f] text-[#293c4f]'
                : 'border-transparent text-gray-400 hover:text-gray-600',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'journal'        && <JournalTab period={period} bu={bu} />}
      {tab === 'accounts'       && <AccountsTab />}
      {tab === 'trial-balance'  && <TrialBalanceTab period={period} />}
      {tab === 'periods'        && <PeriodsTab isAdmin={isAdmin} />}
    </div>
  )
}

// ── Journal Tab ───────────────────────────────────────────────

function JournalTab({ period, bu }: { period: string; bu: string }) {
  const { data, isLoading } = useQuery<{ data: JournalEntry[]; total: number }>({
    queryKey: ['journal', period, bu],
    queryFn: async () => {
      const { data } = await api.get('/accounting/journal', {
        params: { period, businessUnit: bu || undefined, limit: 100 },
      })
      return data.data ?? data
    },
  })

  const entries = data?.data ?? []

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
  if (entries.length === 0) return <EmptyState icon={<BookOpen className="w-5 h-5" />} title="Sin asientos" description="No hay asientos contables para este período." />

  return (
    <Card padding="sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Tipo', 'Descripción', 'Débito', 'Crédito', 'Monto', 'Período', 'BU'].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                <td className="px-3 py-3">
                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', TYPE_COLOR[e.type] ?? 'bg-gray-100 text-gray-600')}>
                    {TYPE_LABEL[e.type] ?? e.type}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-700 max-w-[220px] truncate">{e.description}</td>
                <td className="px-3 py-3 text-xs font-mono text-gray-600">{e.debitAccount?.code} {e.debitAccount?.name}</td>
                <td className="px-3 py-3 text-xs font-mono text-gray-600">{e.creditAccount?.code} {e.creditAccount?.name}</td>
                <td className="px-3 py-3 text-xs font-semibold text-[#293c4f]">{formatCurrency(e.amount)}</td>
                <td className="px-3 py-3 text-xs font-mono text-gray-500">{e.period}</td>
                <td className="px-3 py-3">
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={e.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                    {e.businessUnit}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Accounts Tab ──────────────────────────────────────────────

function AccountsTab() {
  const { data, isLoading } = useQuery<Account[]>({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/accounting/accounts')
      return data.data ?? data
    },
  })

  const accounts = data ?? []

  const grouped = accounts.reduce((acc, a) => {
    if (!acc[a.type]) acc[a.type] = []
    acc[a.type].push(a)
    return acc
  }, {} as Record<string, Account[]>)

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, accts]) => (
        <Card key={type} padding="sm">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{ACCOUNT_TYPE_LABEL[type] ?? type}</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {accts.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold text-[#293c4f] w-20">{a.code}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{a.name}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-right text-gray-800">{formatCurrency(a.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  )
}

// ── Trial Balance Tab ─────────────────────────────────────────

function TrialBalanceTab({ period }: { period: string }) {
  const { data, isLoading } = useQuery<{ lines: TrialBalanceLine[]; totalDebit: number; totalCredit: number; balanced: boolean }>({
    queryKey: ['trial-balance', period],
    queryFn: async () => {
      const { data } = await api.get('/accounting/trial-balance', { params: { period } })
      return data.data ?? data
    },
  })

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
  if (!data) return null

  return (
    <Card padding="sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">Balance de Comprobación — {period}</p>
        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', data.balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
          {data.balanced ? '✓ Balanceado' : '⚠ Desbalanceado'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">Código</th>
              <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">Cuenta</th>
              <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">Tipo</th>
              <th className="text-right text-xs font-medium text-gray-400 px-3 py-2.5">Débitos</th>
              <th className="text-right text-xs font-medium text-gray-400 px-3 py-2.5">Créditos</th>
              <th className="text-right text-xs font-medium text-gray-400 px-3 py-2.5">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.accountCode} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-3 py-2.5 font-mono text-xs font-semibold text-[#293c4f]">{line.accountCode}</td>
                <td className="px-3 py-2.5 text-xs text-gray-700">{line.accountName}</td>
                <td className="px-3 py-2.5 text-xs text-gray-400">{ACCOUNT_TYPE_LABEL[line.type] ?? line.type}</td>
                <td className="px-3 py-2.5 text-xs text-right text-gray-700">{formatCurrency(line.totalDebit)}</td>
                <td className="px-3 py-2.5 text-xs text-right text-gray-700">{formatCurrency(line.totalCredit)}</td>
                <td className={cn('px-3 py-2.5 text-xs text-right font-semibold', line.balance >= 0 ? 'text-[#293c4f]' : 'text-red-600')}>{formatCurrency(line.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td colSpan={3} className="px-3 py-2.5 text-xs font-bold text-gray-800">TOTALES</td>
              <td className="px-3 py-2.5 text-xs font-bold text-right text-gray-800">{formatCurrency(data.totalDebit)}</td>
              <td className="px-3 py-2.5 text-xs font-bold text-right text-gray-800">{formatCurrency(data.totalCredit)}</td>
              <td className="px-3 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  )
}

// ── Periods Tab ───────────────────────────────────────────────

function PeriodsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<FiscalPeriod[]>({
    queryKey: ['fiscal-periods'],
    queryFn: async () => {
      const { data } = await api.get('/accounting/periods')
      return data.data ?? data
    },
  })

  const closePeriod = useMutation({
    mutationFn: async (period: string) => api.post(`/accounting/periods/${period}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-periods'] }),
  })

  const periods = data ?? []

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
  if (periods.length === 0) return <EmptyState title="Sin períodos" description="Los períodos se crean automáticamente al registrar asientos." />

  return (
    <Card padding="sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Período', 'Estado', 'Asientos', 'Total Débitos', 'Cerrado por', 'Fecha Cierre', ''].map((h) => (
              <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.period} className="border-b border-gray-50 hover:bg-gray-50/60">
              <td className="px-3 py-3 font-mono text-xs font-semibold text-[#293c4f]">{p.period}</td>
              <td className="px-3 py-3">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                  p.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                  {p.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                </span>
              </td>
              <td className="px-3 py-3 text-xs text-gray-600">{p.entryCount}</td>
              <td className="px-3 py-3 text-xs font-medium text-gray-700">{formatCurrency(p.totalDebit)}</td>
              <td className="px-3 py-3 text-xs text-gray-500">{p.closedBy?.name ?? '—'}</td>
              <td className="px-3 py-3 text-xs text-gray-400">{p.closedAt ? formatDate(p.closedAt) : '—'}</td>
              <td className="px-3 py-3">
                {isAdmin && p.status === 'OPEN' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Lock className="w-3 h-3" />}
                    loading={closePeriod.isPending}
                    onClick={() => {
                      if (confirm(`¿Cerrar el período ${p.period}? Esta acción no se puede deshacer.`)) {
                        closePeriod.mutate(p.period)
                      }
                    }}
                  >
                    Cerrar
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
