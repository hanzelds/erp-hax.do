'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Lock, TrendingDown, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

type Tab = 'journal' | 'accounts' | 'trial-balance' | 'balance-sheet' | 'pnl' | 'margins' | 'itbis' | 'periods'

const TABS: { key: Tab; label: string }[] = [
  { key: 'journal',       label: 'Asientos' },
  { key: 'accounts',      label: 'Plan de Cuentas' },
  { key: 'trial-balance', label: 'Comprobación' },
  { key: 'balance-sheet', label: 'Situación' },
  { key: 'pnl',           label: 'P&G' },
  { key: 'margins',       label: 'Márgenes' },
  { key: 'itbis',         label: 'ITBIS' },
  { key: 'periods',       label: 'Períodos' },
]

const TYPE_LABEL: Record<string, string> = {
  INVOICE: 'Factura', PAYMENT: 'Cobro', EXPENSE: 'Gasto',
  CREDIT_NOTE: 'N. Crédito', MANUAL: 'Manual', DEPRECIATION: 'Depreciación',
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
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contabilidad"
        subtitle="Asientos · Cuentas · Estados financieros · ITBIS"
        actions={
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700" />
        }
      />

      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === key ? 'border-[#293c4f] text-[#293c4f]' : 'border-transparent text-gray-400 hover:text-gray-600')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'journal'       && <JournalTab period={period} />}
      {tab === 'accounts'      && <AccountsTab />}
      {tab === 'trial-balance' && <TrialBalanceTab period={period} />}
      {tab === 'balance-sheet' && <BalanceSheetTab period={period} />}
      {tab === 'pnl'           && <PnLTab period={period} />}
      {tab === 'margins'       && <MarginsTab year={parseInt(period.slice(0, 4))} />}
      {tab === 'itbis'         && <ItbisTab />}
      {tab === 'periods'       && <PeriodsTab isAdmin={isAdmin} />}
    </div>
  )
}

// ── Journal ───────────────────────────────────────────────────

function JournalTab({ period }: { period: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['journal', period],
    queryFn: async () => {
      const { data } = await api.get('/accounting/journal', { params: { period, limit: 200 } })
      return data.data ?? data
    },
  })
  const entries: any[] = Array.isArray(data) ? data : (data?.data ?? [])
  if (isLoading) return <Skeletons />
  if (!entries.length) return <EmptyState icon={<BookOpen className="w-5 h-5" />} title="Sin asientos" description="No hay asientos para este período." />
  return (
    <Card padding="sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100">
            {['Tipo', 'Descripción', 'Débito', 'Crédito', 'Monto', 'Período', 'BU'].map((h) => (
              <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {entries.map((e: any) => (
              <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-3 py-2.5"><span className={cn('px-2 py-0.5 rounded text-xs font-medium', TYPE_COLOR[e.type] ?? 'bg-gray-100 text-gray-600')}>{TYPE_LABEL[e.type] ?? e.type}</span></td>
                <td className="px-3 py-2.5 text-xs text-gray-700 max-w-[200px] truncate">{e.description}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-gray-500">{e.debitAccount?.code}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-gray-500">{e.creditAccount?.code}</td>
                <td className="px-3 py-2.5 text-xs font-semibold text-[#293c4f]">{formatCurrency(e.amount)}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-gray-400">{e.period}</td>
                <td className="px-3 py-2.5 text-xs font-medium" style={e.businessUnit === 'HAX' ? { color: '#293c4f' } : { color: '#475569' }}>{e.businessUnit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Accounts ──────────────────────────────────────────────────

function AccountsTab() {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => { const { data } = await api.get('/accounting/accounts'); return data.data ?? data },
  })
  const grouped = data.reduce((acc: any, a) => { if (!acc[a.type]) acc[a.type] = []; acc[a.type].push(a); return acc }, {})
  if (isLoading) return <Skeletons />
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, accts]: any) => (
        <Card key={type} padding="sm">
          <div className="px-3 py-2 border-b border-gray-100"><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{ACCOUNT_TYPE_LABEL[type] ?? type}</p></div>
          <table className="w-full text-sm"><tbody>
            {accts.map((a: any) => (
              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-3 py-2 font-mono text-xs font-semibold text-[#293c4f] w-20">{a.code}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{a.name}</td>
                <td className="px-3 py-2 text-xs font-semibold text-right text-gray-800">{formatCurrency(a.balance)}</td>
              </tr>
            ))}
          </tbody></table>
        </Card>
      ))}
    </div>
  )
}

// ── Trial Balance ─────────────────────────────────────────────

function TrialBalanceTab({ period }: { period: string }) {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['trial-balance', period],
    queryFn: async () => { const { data } = await api.get('/accounting/trial-balance', { params: { period } }); return data.data ?? data },
    retry: false,
  })
  if (isLoading) return <Skeletons />
  if (error) return <Card><p className="p-4 text-sm text-red-600">Error cargando balance. Intenta con otro período.</p></Card>
  if (!data) return null
  const lines = data.lines ?? data.rows ?? []
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
          <thead><tr className="border-b border-gray-100">
            {['Código', 'Cuenta', 'Tipo', 'Débitos', 'Créditos', 'Saldo'].map((h) => (
              <th key={h} className={cn('text-xs font-medium text-gray-400 px-3 py-2.5', h.includes('Déb') || h.includes('Cré') || h.includes('Sal') ? 'text-right' : 'text-left')}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {lines.map((line: any) => (
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
          <tfoot><tr className="border-t-2 border-gray-200 bg-gray-50">
            <td colSpan={3} className="px-3 py-2.5 text-xs font-bold text-gray-800">TOTALES</td>
            <td className="px-3 py-2.5 text-xs font-bold text-right">{formatCurrency(data.totalDebit)}</td>
            <td className="px-3 py-2.5 text-xs font-bold text-right">{formatCurrency(data.totalCredit)}</td>
            <td />
          </tr></tfoot>
        </table>
      </div>
    </Card>
  )
}

// ── Balance Sheet ─────────────────────────────────────────────

function BalanceSheetTab({ period }: { period: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['balance-sheet', period],
    queryFn: async () => { const { data } = await api.get('/accounting/balance-sheet', { params: { period } }); return data.data ?? data },
  })
  if (isLoading) return <Skeletons />
  if (!data) return null

  function Section({ title, items, total, color = 'text-[#293c4f]' }: { title: string; items: any[]; total: number; color?: string }) {
    return (
      <Card padding="sm">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</p>
          <p className={cn('text-sm font-bold', color)}>{formatCurrency(total)}</p>
        </div>
        {items.length === 0 ? <p className="px-3 py-3 text-xs text-gray-400">Sin movimientos</p> : (
          <table className="w-full text-sm"><tbody>
            {items.map((a: any) => (
              <tr key={a.id} className="border-b border-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-[#293c4f] w-16">{a.code}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{a.name}</td>
                <td className="px-3 py-2 text-xs font-semibold text-right text-gray-800">{formatCurrency(a.balance)}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><p className="text-xs text-gray-400">Total Activos</p><p className="text-2xl font-bold text-[#293c4f] mt-1">{formatCurrency(data.assets?.total ?? 0)}</p></Card>
        <Card><p className="text-xs text-gray-400">Total Pasivos</p><p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(data.liabilities?.total ?? 0)}</p></Card>
        <Card><p className="text-xs text-gray-400">Patrimonio Neto</p><p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(data.equity?.netWorth ?? 0)}</p></Card>
      </div>
      <Section title="Activos" items={data.assets?.items ?? []} total={data.assets?.total ?? 0} />
      <Section title="Pasivos" items={data.liabilities?.items ?? []} total={data.liabilities?.total ?? 0} color="text-red-600" />
    </div>
  )
}

// ── P&L ───────────────────────────────────────────────────────

function PnLTab({ period }: { period: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['pnl', period],
    queryFn: async () => { const { data } = await api.get('/accounting/pnl', { params: { period } }); return data.data ?? data },
  })
  if (isLoading) return <Skeletons />
  if (!data) return null

  const netPositive = (data.netIncome ?? 0) >= 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><p className="text-xs text-gray-400">Ingresos</p><p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(data.income?.total ?? 0)}</p></Card>
        <Card><p className="text-xs text-gray-400">Gastos</p><p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(data.expenses?.total ?? 0)}</p></Card>
        <Card>
          <p className="text-xs text-gray-400">Resultado Neto</p>
          <p className={cn('text-2xl font-bold mt-1', netPositive ? 'text-green-600' : 'text-red-600')}>{formatCurrency(data.netIncome ?? 0)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Margen: {data.netMargin ?? 0}%</p>
        </Card>
      </div>
      {[{ title: 'Ingresos', items: data.income?.items ?? [], color: 'text-green-600' },
        { title: 'Gastos', items: data.expenses?.items ?? [], color: 'text-red-600' }].map(({ title, items, color }) => (
        <Card key={title} padding="sm">
          <div className="px-3 py-2 border-b border-gray-100"><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p></div>
          {items.length === 0 ? <p className="px-3 py-3 text-xs text-gray-400">Sin movimientos</p> : (
            <table className="w-full text-sm"><tbody>
              {items.map((a: any) => (
                <tr key={a.id} className="border-b border-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-[#293c4f] w-16">{a.code}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{a.name}</td>
                  <td className={cn('px-3 py-2 text-xs font-semibold text-right', color)}>{formatCurrency(a.balance)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Card>
      ))}
    </div>
  )
}

// ── Margins ───────────────────────────────────────────────────

function MarginsTab({ year }: { year: number }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['margins', year],
    queryFn: async () => { const { data } = await api.get('/accounting/margins', { params: { year } }); return data.data ?? data },
  })
  if (isLoading) return <Skeletons />
  if (!data) return null

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><p className="text-xs text-gray-400">Ingresos YTD</p><p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(data.ytd?.revenue ?? 0)}</p></Card>
        <Card><p className="text-xs text-gray-400">Gastos YTD</p><p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(data.ytd?.expenses ?? 0)}</p></Card>
        <Card><p className="text-xs text-gray-400">Resultado YTD</p><p className={cn('text-xl font-bold mt-1', (data.ytd?.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(data.ytd?.net ?? 0)}</p></Card>
        <Card><p className="text-xs text-gray-400">Margen Neto YTD</p><p className={cn('text-xl font-bold mt-1', (data.ytd?.margin ?? 0) >= 0 ? 'text-green-600' : 'text-red-600')}>{data.ytd?.margin ?? 0}%</p></Card>
      </div>
      <Card padding="sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100">
            {['Mes', 'Ingresos', 'Gastos', 'Resultado', 'Margen'].map((h) => (
              <th key={h} className={cn('text-xs font-medium text-gray-400 px-3 py-2.5', h === 'Mes' ? 'text-left' : 'text-right')}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(data.monthly ?? []).map((row: any) => (
              <tr key={row.period} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-3 py-2.5 text-xs font-medium text-gray-700">{months[(row.month ?? 1) - 1]} {year}</td>
                <td className="px-3 py-2.5 text-xs text-right text-green-600 font-medium">{formatCurrency(row.revenue)}</td>
                <td className="px-3 py-2.5 text-xs text-right text-red-600 font-medium">{formatCurrency(row.expenses)}</td>
                <td className={cn('px-3 py-2.5 text-xs text-right font-semibold', row.net >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(row.net)}</td>
                <td className={cn('px-3 py-2.5 text-xs text-right font-bold', row.margin >= 0 ? 'text-[#293c4f]' : 'text-red-600')}>{row.margin}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

// ── ITBIS ─────────────────────────────────────────────────────

const ITBIS_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Abierto', PRE_CLOSED: 'Pre-cierre', FILED: 'Declarado', PAID: 'Pagado', OVERDUE: 'Vencido',
}
const ITBIS_STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700', PRE_CLOSED: 'bg-yellow-100 text-yellow-700',
  FILED: 'bg-purple-100 text-purple-700', PAID: 'bg-green-100 text-green-700', OVERDUE: 'bg-red-100 text-red-700',
}

function ItbisTab() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const [newPeriod, setNewPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['itbis-periods'],
    queryFn: async () => { const { data } = await api.get('/accounting/itbis'); return data.data ?? data },
  })

  const calculate = useMutation({
    mutationFn: (p: string) => api.post(`/accounting/itbis/${p}/calculate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itbis-periods'] }),
  })
  const file = useMutation({
    mutationFn: (p: string) => api.post(`/accounting/itbis/${p}/file`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itbis-periods'] }),
  })
  const pay = useMutation({
    mutationFn: (p: string) => api.post(`/accounting/itbis/${p}/pay`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itbis-periods'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input type="text" value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)}
          placeholder="YYYYMM" maxLength={6}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] w-36" />
        <Button variant="primary" size="sm" loading={calculate.isPending} onClick={() => calculate.mutate(newPeriod)}>
          Calcular período
        </Button>
      </div>

      <Card padding="sm">
        {isLoading ? <Skeletons count={3} /> : data.length === 0 ? (
          <EmptyState title="Sin períodos ITBIS" description="Calcula el primer período IT-1 para comenzar." />
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              {['Período', 'Vence', 'Estado', 'ITBIS Ventas', 'ITBIS Compras', 'Por Pagar', 'Saldo a Favor', ''].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map((p: any) => (
                <tr key={p.period} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-3 font-mono text-xs font-semibold text-[#293c4f]">{p.period}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{p.dueDate ? new Date(p.dueDate).toLocaleDateString('es-DO') : '—'}</td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ITBIS_STATUS_COLOR[p.status] ?? 'bg-gray-100 text-gray-600')}>
                      {ITBIS_STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-green-600 font-medium">{formatCurrency(p.totalSalesItbis)}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{formatCurrency(p.totalPurchasesItbis)}</td>
                  <td className="px-3 py-3 text-xs font-bold text-[#293c4f]">{formatCurrency(p.payableItbis)}</td>
                  <td className="px-3 py-3 text-xs text-blue-600">{p.carryForwardBalance > 0 ? formatCurrency(p.carryForwardBalance) : '—'}</td>
                  <td className="px-3 py-3">
                    {isAdmin && p.status === 'PRE_CLOSED' && (
                      <Button variant="secondary" size="sm" loading={file.isPending} onClick={() => file.mutate(p.period)}>Declarar</Button>
                    )}
                    {isAdmin && p.status === 'FILED' && (
                      <Button variant="primary" size="sm" loading={pay.isPending} onClick={() => pay.mutate(p.period)}>Pagar</Button>
                    )}
                    {p.status === 'OPEN' && (
                      <Button variant="secondary" size="sm" loading={calculate.isPending} onClick={() => calculate.mutate(p.period)}>Recalcular</Button>
                    )}
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

// ── Fiscal Periods ────────────────────────────────────────────

function PeriodsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ['fiscal-periods'],
    queryFn: async () => { const { data } = await api.get('/accounting/periods'); return data.data ?? data },
  })
  const closePeriod = useMutation({
    mutationFn: (period: string) => api.post(`/accounting/periods/${period}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-periods'] }),
  })

  if (isLoading) return <Skeletons />
  if (!data.length) return <EmptyState title="Sin períodos" description="Los períodos se crean automáticamente al registrar asientos." />

  return (
    <Card padding="sm">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-100">
          {['Período', 'Estado', 'Asientos', 'Total Débitos', 'Fecha Cierre', ''].map((h) => (
            <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {data.map((p: any) => (
            <tr key={p.period} className="border-b border-gray-50 hover:bg-gray-50/60">
              <td className="px-3 py-3 font-mono text-xs font-semibold text-[#293c4f]">{p.period}</td>
              <td className="px-3 py-3">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                  p.status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                  {p.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
                </span>
              </td>
              <td className="px-3 py-3 text-xs text-gray-500">{p.entryCount}</td>
              <td className="px-3 py-3 text-xs font-medium text-gray-700">{formatCurrency(p.totalDebit)}</td>
              <td className="px-3 py-3 text-xs text-gray-400">{p.closedAt ? formatDate(p.closedAt) : '—'}</td>
              <td className="px-3 py-3">
                {isAdmin && p.status === 'OPEN' && (
                  <Button variant="secondary" size="sm" icon={<Lock className="w-3 h-3" />} loading={closePeriod.isPending}
                    onClick={() => confirm(`¿Cerrar período ${p.period}?`) && closePeriod.mutate(p.period)}>
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

function Skeletons({ count = 5 }: { count?: number }) {
  return <div className="space-y-3">{Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
}
