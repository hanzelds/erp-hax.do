'use client'

import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import {
  DollarSign, FileText, Clock, TrendingUp,
  ArrowUpRight, CheckCircle2, AlertCircle, Clock3,
} from 'lucide-react'
import Link from 'next/link'
import {
  StatCard, Card, CardHeader, PageHeader, Button, InvoiceStatusBadge, Skeleton, SkeletonCard,
} from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import api from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────

interface DashboardData {
  revenue:        { current: number; previous: number; change: number }
  expenses:       { current: number }
  receivables:    { total: number; count: number; avgDays: number }
  invoices:       { total: number; approvedToday: number }
  netIncome:      { current: number; margin: number }
  recentInvoices: {
    id: string; number: string; client: { name: string }
    total: number; status: string; issueDate: string; businessUnit: string
  }[]
  pendingReceivables: {
    client: string; amount: number; days: number
  }[]
  revenueChart: { month: string; hax: number; koder: number }[]
  expenseChart: { category: string; amount: number }[]
}

// ── Custom tooltip ────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500">{p.name === 'hax' ? 'Hax' : 'Koder'}:</span>
          <span className="font-medium text-gray-800">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────

export function DashboardClient() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/reports/dashboard')
      return data.data ?? data
    },
    staleTime: 60_000,
  })

  const now         = new Date()
  const currentMonth = now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-100 rounded-lg w-72 animate-pulse" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Skeleton className="h-64 xl:col-span-2 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  const revenueChange = data?.revenue.change ?? 0
  const revenueData   = data?.revenueChart ?? []
  const expenseData   = data?.expenseChart ?? []
  const recentInvoices = data?.recentInvoices ?? []
  const pendingCobros  = data?.pendingReceivables ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle={`Resumen financiero — ${currentMonth}`}
        actions={
          <Button asChild variant="primary" size="sm" icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
            <Link href="/dashboard/invoices/new">Nueva factura</Link>
          </Button>
        }
      />

      {/* ── KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Ingresos del mes"
          value={formatCurrency(data?.revenue.current ?? 0)}
          sub="vs mes anterior"
          trend={revenueChange !== 0 ? { value: `${Math.abs(revenueChange).toFixed(1)}%`, up: revenueChange >= 0 } : undefined}
          icon={<DollarSign className="w-4 h-4" />}
          accent="#293c4f"
        />
        <StatCard
          label="Cuentas por cobrar"
          value={formatCurrency(data?.receivables.total ?? 0)}
          sub={`${data?.receivables.count ?? 0} facturas pendientes`}
          icon={<Clock className="w-4 h-4" />}
          accent="#d97706"
        />
        <StatCard
          label="Facturas emitidas"
          value={String(data?.invoices.total ?? 0)}
          sub="este mes"
          trend={data?.invoices.approvedToday ? { value: `${data.invoices.approvedToday} aprobadas hoy`, up: true } : undefined}
          icon={<FileText className="w-4 h-4" />}
          accent="#16a34a"
        />
        <StatCard
          label="Beneficio neto"
          value={formatCurrency(data?.netIncome.current ?? 0)}
          sub={`margen ${data?.netIncome.margin?.toFixed(0) ?? 0}%`}
          icon={<TrendingUp className="w-4 h-4" />}
          accent="#2563eb"
        />
      </div>

      {/* ── Charts row ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue area chart */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Ingresos por unidad"
            subtitle="Últimos 6 meses"
            action={
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#293c4f' }} />
                  Hax
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#4621a3' }} />
                  Koder
                </span>
              </div>
            }
          />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="haxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#293c4f" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#293c4f" stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="koderGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#4621a3" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4621a3" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="hax"   stroke="#293c4f" strokeWidth={2} fill="url(#haxGrad)"   />
              <Area type="monotone" dataKey="koder" stroke="#4621a3" strokeWidth={2} fill="url(#koderGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Expenses bar chart */}
        <Card>
          <CardHeader title="Gastos por categoría" subtitle={currentMonth} />
          {expenseData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-xs text-gray-400">Sin datos disponibles</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={expenseData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v / 1000}k`}
                />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false} tickLine={false} width={72}
                />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f1f5f9' }} />
                <Bar dataKey="amount" fill="#293c4f" radius={[0, 4, 4, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Bottom row ────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Recent invoices */}
        <Card className="xl:col-span-2" padding="sm">
          <div className="flex items-center justify-between px-2 pt-1 pb-3">
            <div>
              <h3 className="text-gray-900 font-semibold text-sm">Facturas recientes</h3>
              <p className="text-gray-400 text-xs">Últimas 5 emitidas</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/invoices">Ver todas →</Link>
            </Button>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-8">No hay facturas recientes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50">
                    {['Número', 'Cliente', 'Monto', 'Estado', 'Fecha'].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer">
                      <td className="px-3 py-2.5">
                        <Link href={`/dashboard/invoices/${inv.id}`} className="font-mono text-xs text-[#293c4f] hover:underline">{inv.number}</Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-gray-800 text-xs font-medium">{inv.client.name}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-gray-900 text-xs font-semibold">{formatCurrency(inv.total)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-gray-400 text-xs">{formatDate(inv.issueDate)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pending collections */}
        <Card>
          <CardHeader
            title="Cobros pendientes"
            subtitle={`Total: ${formatCurrency(data?.receivables.total ?? 0)}`}
          />
          {pendingCobros.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-6">No hay cobros pendientes</p>
          ) : (
            <div className="space-y-3">
              {pendingCobros.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-800 text-xs font-medium truncate">{c.client}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {c.days > 15 ? (
                        <AlertCircle className="w-3 h-3 text-red-400" />
                      ) : c.days > 7 ? (
                        <Clock3 className="w-3 h-3 text-yellow-500" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      )}
                      <span className="text-gray-400 text-xs">{c.days}d pendiente</span>
                    </div>
                  </div>
                  <span className="text-gray-900 text-xs font-semibold shrink-0">
                    {formatCurrency(c.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Mini summary */}
          <div className="mt-4 pt-3 border-t border-gray-50 grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-gray-900 font-bold text-sm">{data?.receivables.count ?? 0}</p>
              <p className="text-gray-400 text-xs">Facturas</p>
            </div>
            <div className="text-center border-l border-gray-100">
              <p className="text-gray-900 font-bold text-sm">{data?.receivables.avgDays?.toFixed(1) ?? '0'}d</p>
              <p className="text-gray-400 text-xs">Promedio</p>
            </div>
          </div>
        </Card>

      </div>
    </div>
  )
}
