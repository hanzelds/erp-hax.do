'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import {
  DollarSign,
  FileText,
  Clock,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Clock3,
} from 'lucide-react'
import {
  StatCard,
  Card,
  CardHeader,
  PageHeader,
  Badge,
  Button,
  InvoiceStatusBadge,
} from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'

// ── Mock data (replace with real API calls) ──────────────────

const revenueData = [
  { month: 'Oct', hax: 95000,  koder: 42000  },
  { month: 'Nov', hax: 112000, koder: 38000  },
  { month: 'Dic', hax: 88000,  koder: 55000  },
  { month: 'Ene', hax: 143000, koder: 61000  },
  { month: 'Feb', hax: 127000, koder: 48000  },
  { month: 'Mar', hax: 165000, koder: 72000  },
]

const expenseData = [
  { category: 'Nómina',     amount: 85000 },
  { category: 'Tecnología', amount: 22000 },
  { category: 'Marketing',  amount: 18000 },
  { category: 'Operativos', amount: 14000 },
  { category: 'Otros',      amount: 9500  },
]

const recentInvoices = [
  {
    id: '1',
    number: 'HAX-2025-042',
    client: 'Empresa ABC SRL',
    amount: 85000,
    status: 'APPROVED',
    date: '2025-03-28',
    unit: 'HAX',
  },
  {
    id: '2',
    number: 'KDR-2025-018',
    client: 'Tech Solutions RD',
    amount: 42500,
    status: 'PAID',
    date: '2025-03-27',
    unit: 'KODER',
  },
  {
    id: '3',
    number: 'HAX-2025-041',
    client: 'Grupo Innovación',
    amount: 120000,
    status: 'SENDING',
    date: '2025-03-26',
    unit: 'HAX',
  },
  {
    id: '4',
    number: 'HAX-2025-040',
    client: 'Constructora Norte',
    amount: 67800,
    status: 'REJECTED',
    date: '2025-03-25',
    unit: 'HAX',
  },
  {
    id: '5',
    number: 'KDR-2025-017',
    client: 'Digital Agency Plus',
    amount: 38000,
    status: 'APPROVED',
    date: '2025-03-24',
    unit: 'KODER',
  },
]

const pendingCobros = [
  { client: 'Empresa ABC SRL',     amount: 85000,  days: 5  },
  { client: 'Grupo Innovación',    amount: 120000, days: 12 },
  { client: 'Servicios Pro SRL',   amount: 45000,  days: 18 },
  { client: 'Digital Agency Plus', amount: 38000,  days: 3  },
]

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
  return (
    <div className="space-y-6">

      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Resumen financiero — Marzo 2025"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">Exportar</Button>
            <Button variant="primary" size="sm" icon={<ArrowUpRight className="w-3.5 h-3.5" />}>
              Nueva factura
            </Button>
          </div>
        }
      />

      {/* ── KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Ingresos del mes"
          value={formatCurrency(237000)}
          sub="vs mes anterior"
          trend={{ value: '18.4%', up: true }}
          icon={<DollarSign className="w-4 h-4" />}
          accent="#293c4f"
        />
        <StatCard
          label="Cuentas por cobrar"
          value={formatCurrency(288000)}
          sub="4 facturas pendientes"
          icon={<Clock className="w-4 h-4" />}
          accent="#d97706"
        />
        <StatCard
          label="Facturas emitidas"
          value="42"
          sub="este mes"
          trend={{ value: '8 aprobadas hoy', up: true }}
          icon={<FileText className="w-4 h-4" />}
          accent="#16a34a"
        />
        <StatCard
          label="Beneficio neto"
          value={formatCurrency(149500)}
          sub="margen 63%"
          trend={{ value: '12.1%', up: true }}
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
                  <span className="w-2 h-2 rounded-full inline-block bg-slate-400" />
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
                  <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v / 1000}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="hax"   stroke="#293c4f" strokeWidth={2} fill="url(#haxGrad)"   />
              <Area type="monotone" dataKey="koder" stroke="#94a3b8" strokeWidth={2} fill="url(#koderGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Expenses bar chart */}
        <Card>
          <CardHeader
            title="Gastos por categoría"
            subtitle="Marzo 2025"
          />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={expenseData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v / 1000}k`}
              />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false} tickLine={false} width={72}
              />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #f1f5f9' }}
              />
              <Bar dataKey="amount" fill="#293c4f" radius={[0, 4, 4, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
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
            <Button variant="ghost" size="sm">Ver todas →</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  {['Número', 'Cliente', 'Unidad', 'Monto', 'Estado', 'Fecha'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs text-gray-600">{inv.number}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-gray-800 text-xs font-medium">{inv.client}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={
                          inv.unit === 'HAX'
                            ? { backgroundColor: '#eef1f4', color: '#293c4f' }
                            : { backgroundColor: '#f1f5f9', color: '#475569' }
                        }
                      >
                        {inv.unit}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-gray-900 text-xs font-semibold">
                        {formatCurrency(inv.amount)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-gray-400 text-xs">{formatDate(inv.date)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pending collections */}
        <Card>
          <CardHeader
            title="Cobros pendientes"
            subtitle={`Total: ${formatCurrency(288000)}`}
          />
          <div className="space-y-3">
            {pendingCobros.map((c) => (
              <div key={c.client} className="flex items-center justify-between gap-3">
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

          {/* Mini summary */}
          <div className="mt-4 pt-3 border-t border-gray-50 grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-gray-900 font-bold text-sm">4</p>
              <p className="text-gray-400 text-xs">Facturas</p>
            </div>
            <div className="text-center border-l border-gray-100">
              <p className="text-gray-900 font-bold text-sm">9.5d</p>
              <p className="text-gray-400 text-xs">Promedio</p>
            </div>
          </div>
        </Card>

      </div>
    </div>
  )
}
