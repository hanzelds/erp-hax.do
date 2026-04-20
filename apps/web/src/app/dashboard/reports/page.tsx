'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { Download, FileDown } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, cn, openPdf } from '@/lib/utils'
import { PageHeader, Button, Card, CardHeader, Skeleton, StatCard } from '@/components/ui'

const TABS = ['P&L', 'Balance General', 'Flujo de Caja', '606 Compras', '607 Ventas'] as const
type Tab = typeof TABS[number]

function periodOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
    options.push({ value, label })
  }
  return options
}

export default function ReportsPage() {
  const [tab, setTab]       = useState<Tab>('P&L')
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reportes"
        subtitle="Estados financieros y reportes DGII"
        actions={
          <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />}>
            Exportar CSV
          </Button>
        }
      />

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-gray-100">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t ? 'border-[#293c4f] text-[#293c4f]' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Period selector + PDF export for applicable tabs */}
      {(tab === 'P&L' || tab === '606 Compras' || tab === '607 Ventas' || tab === 'Flujo de Caja') && (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-gray-600 font-medium">Período:</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f]"
          >
            {periodOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {tab === 'P&L' && (
            <Button variant="secondary" size="sm" icon={<FileDown className="w-3.5 h-3.5" />}
              onClick={() => openPdf(`/reports/pnl/${period}/pdf`, `pnl-${period}.pdf`)}>
              PDF P&amp;L
            </Button>
          )}
          {tab === 'Flujo de Caja' && (
            <Button variant="secondary" size="sm" icon={<FileDown className="w-3.5 h-3.5" />}
              onClick={() => openPdf(`/reports/cash-flow/${period}/pdf`, `cashflow-${period}.pdf`)}>
              PDF Flujo
            </Button>
          )}
        </div>
      )}
      {tab === 'Balance General' && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" icon={<FileDown className="w-3.5 h-3.5" />}
            onClick={() => openPdf(`/reports/balance-sheet/pdf`, `balance-${period}.pdf`)}>
            PDF Balance
          </Button>
        </div>
      )}

      {/* Tab content */}
      {tab === 'P&L' && <PnLTab period={period} />}
      {tab === 'Balance General' && <BalanceSheetTab />}
      {tab === 'Flujo de Caja' && <CashFlowTab period={period} />}
      {tab === '606 Compras' && <Report606Tab period={period} />}
      {tab === '607 Ventas' && <Report607Tab period={period} />}
    </div>
  )
}

// ── P&L ───────────────────────────────────────────────────────

function PnLTab({ period }: { period: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-pnl', period],
    queryFn: async () => {
      const res = await api.get(`/reports/pnl/${period}`)
      return res.data?.data ?? res.data
    },
  })

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  const grossRevenue   = (data as any)?.grossRevenue   ?? 0
  const totalExpenses  = (data as any)?.totalExpenses  ?? 0
  const netIncome      = (data as any)?.netIncome      ?? 0
  const collectedRev   = (data as any)?.collectedRevenue ?? 0
  const taxRevenue     = (data as any)?.taxRevenue     ?? 0
  const taxExpenses    = (data as any)?.taxExpenses    ?? 0
  const margin         = grossRevenue > 0 ? (netIncome / grossRevenue) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Ingresos brutos" value={formatCurrency(grossRevenue)} accent="#16a34a" />
        <StatCard label="Gastos totales"  value={formatCurrency(totalExpenses)} accent="#dc2626" />
        <StatCard label="Beneficio neto"  value={formatCurrency(netIncome)} accent="#2563eb" />
        <StatCard label="Margen"          value={`${margin.toFixed(1)}%`} accent="#293c4f" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Ingresos" subtitle="Detalle del período" />
          <div className="space-y-2 text-sm">
            <Row label="Ingresos facturados" value={formatCurrency(grossRevenue)} />
            <Row label="ITBIS cobrado"        value={formatCurrency(taxRevenue)} />
            <div className="border-t border-gray-100 pt-2 mt-2">
              <Row label="Cobrado efectivamente" value={formatCurrency(collectedRev)} bold />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Gastos" subtitle="Detalle del período" />
          <div className="space-y-2 text-sm">
            <Row label="Gastos totales" value={formatCurrency(totalExpenses)} className="text-red-600" />
            <Row label="ITBIS pagado"   value={formatCurrency(taxExpenses)} />
            <div className="border-t border-gray-100 pt-2 mt-2">
              <Row label="Resultado neto" value={formatCurrency(netIncome)} bold />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Balance Sheet ─────────────────────────────────────────────

function BalanceSheetTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-balance-sheet'],
    queryFn: async () => {
      const res = await api.get('/reports/balance-sheet')
      return res.data?.data ?? res.data
    },
  })

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  const payload = (data as any) ?? {}
  const assetsRaw = payload.assets ?? {}
  const assetsMap: Record<string, number> = {
    'Efectivo / Banco':      assetsRaw.cash              ?? 0,
    'Cuentas por cobrar':    assetsRaw.accountsReceivable ?? 0,
  }
  const liabilitiesMap: Record<string, number> = {}
  const equityMap: Record<string, number> = {
    'Patrimonio neto': typeof payload.equity === 'number' ? payload.equity : 0,
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <BSSection title="Activos"    data={assetsMap}      color="text-green-600" />
      <BSSection title="Pasivos"    data={liabilitiesMap} color="text-red-500" />
      <BSSection title="Patrimonio" data={equityMap}      color="text-blue-600" />
    </div>
  )
}

function BSSection({ title, data, color }: { title: string; data: Record<string, number>; color: string }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0)
  return (
    <Card>
      <CardHeader title={title} subtitle={formatCurrency(total)} />
      <div className="space-y-2">
        {Object.entries(data).map(([k, v]) => (
          <Row key={k} label={k} value={formatCurrency(v as number)} className={color} />
        ))}
      </div>
    </Card>
  )
}

// ── Cash Flow ─────────────────────────────────────────────────

function CashFlowTab({ period }: { period: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-cash-flow', period],
    queryFn: async () => {
      const res = await api.get(`/reports/cash-flow/${period}`)
      return res.data?.data ?? res.data
    },
  })

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  const payload = (data as any) ?? {}
  const inflow  = payload.totalInflows  ?? 0
  const outflow = payload.totalOutflows ?? 0
  const net     = payload.netCashFlow   ?? 0
  const transactions = [
    ...(payload.inflows  ?? []).map((p: any) => ({
      date:        p.paidAt ? new Date(p.paidAt).toLocaleDateString('es-DO') : '—',
      description: `Cobro (${p.method ?? '—'})`,
      type:        'INFLOW',
      amount:      p.amount ?? 0,
    })),
    ...(payload.outflows ?? []).map((e: any) => ({
      date:        e.paidAt ? new Date(e.paidAt).toLocaleDateString('es-DO') : '—',
      description: `Gasto ${(e.category ?? '').toLowerCase()}`,
      type:        'OUTFLOW',
      amount:      e.total ?? 0,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Entradas" value={formatCurrency(inflow)} accent="#16a34a" />
        <StatCard label="Salidas" value={formatCurrency(outflow)} accent="#dc2626" />
        <StatCard label="Neto" value={formatCurrency(net)} accent="#2563eb" />
      </div>
      {transactions.length > 0 && (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Fecha', 'Descripción', 'Tipo', 'Monto'].map((h) => <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-3 py-2.5 text-xs text-gray-500">{t.date}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-700">{t.description}</td>
                    <td className="px-3 py-2.5"><span className={cn('text-xs font-medium', t.type === 'INFLOW' ? 'text-green-600' : 'text-red-500')}>{t.type === 'INFLOW' ? 'Entrada' : 'Salida'}</span></td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">{formatCurrency(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── 606 ───────────────────────────────────────────────────────

function Report606Tab({ period }: { period: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-606', period],
    queryFn: async () => {
      const res = await api.get(`/reports/606/${period}`)
      return res.data?.data ?? res.data
    },
  })

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  const payload     = (data as any) ?? {}
  const totalAmount = payload.totalAmount ?? 0
  const totalItbis  = payload.totalItbis  ?? 0
  const count       = payload.count       ?? 0
  const records     = (payload.records ?? []).map((r: any) => ({
    rnc:    r.supplierRef?.rnc ?? r.supplier ?? '—',
    type:   r.ncfType ?? '—',
    ncf:    r.ncf     ?? '—',
    amount: r.amount  ?? 0,
    itbis:  r.taxAmount ?? 0,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total compras" value={formatCurrency(totalAmount)} accent="#293c4f" />
        <StatCard label="ITBIS pagado"  value={formatCurrency(totalItbis)} accent="#d97706" />
        <StatCard label="Comprobantes"  value={String(count)} accent="#2563eb" />
      </div>
      <ReportTable
        headers={['RNC Proveedor', 'Tipo comprobante', 'NCF', 'Monto', 'ITBIS']}
        rows={records.map((r: any) => [r.rnc, r.type, r.ncf, formatCurrency(r.amount), formatCurrency(r.itbis)])}
      />
    </div>
  )
}

// ── 607 ───────────────────────────────────────────────────────

function Report607Tab({ period }: { period: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-607', period],
    queryFn: async () => {
      const res = await api.get(`/reports/607/${period}`)
      return res.data?.data ?? res.data
    },
  })

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />

  const payload    = (data as any) ?? {}
  const totalSales = payload.totalAmount ?? 0
  const totalItbis = payload.totalItbis  ?? 0
  const count      = payload.count       ?? 0
  const records    = (payload.records ?? []).map((r: any) => ({
    rnc:    r.client?.rnc ?? 'Consumidor',
    ncf:    r.ncf         ?? '—',
    date:   r.issueDate ? new Date(r.issueDate).toLocaleDateString('es-DO') : '—',
    amount: r.total       ?? 0,
    itbis:  r.taxAmount   ?? 0,
    status: r.status      ?? '—',
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total ventas"  value={formatCurrency(totalSales)} accent="#16a34a" />
        <StatCard label="ITBIS cobrado" value={formatCurrency(totalItbis)} accent="#d97706" />
        <StatCard label="Comprobantes"  value={String(count)} accent="#2563eb" />
      </div>
      <ReportTable
        headers={['RNC Cliente', 'NCF', 'Fecha', 'Monto', 'ITBIS', 'Estado']}
        rows={records.map((r: any) => [r.rnc, r.ncf, r.date, formatCurrency(r.amount), formatCurrency(r.itbis), r.status])}
      />
    </div>
  )
}

// ── Shared components ─────────────────────────────────────────

function Row({ label, value, className, bold }: { label: string; value: string; className?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={cn(bold ? 'font-bold text-gray-900' : 'font-medium text-gray-700', className)}>{value}</span>
    </div>
  )
}

function ReportTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <Card padding="sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {headers.map((h) => <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-xs text-gray-400">No hay datos para este período</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                {row.map((cell, j) => <td key={j} className="px-3 py-2.5 text-xs text-gray-700">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
