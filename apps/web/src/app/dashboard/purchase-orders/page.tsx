'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, ChevronRight, ShoppingCart, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState, Select } from '@/components/ui'

type POStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED'

interface PurchaseOrder {
  id: string
  number: string
  status: POStatus
  businessUnit: 'HAX' | 'KODER' | 'ALDIA'
  supplier?: { id: string; name: string; rnc?: string } | null
  subtotal: number
  taxAmount: number
  total: number
  isCredit: boolean
  paymentTerms: number | null
  dueDate: string | null
  expenseId: string | null
  createdAt: string
}

const STATUS_LABELS: Record<POStatus, string> = {
  DRAFT: 'Borrador', SENT: 'Enviada', CONFIRMED: 'Confirmada', RECEIVED: 'Recibida', CANCELLED: 'Cancelada',
}
const STATUS_COLORS: Record<POStatus, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SENT:      'bg-blue-50 text-blue-700',
  CONFIRMED: 'bg-yellow-50 text-yellow-700',
  RECEIVED:  'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-600',
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function DueBadge({ dueDate }: { dueDate: string | null }) {
  const days = daysUntil(dueDate)
  if (days === null) return null
  if (days < 0)   return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Vencida hace {Math.abs(days)}d</span>
  if (days <= 15) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Vence en {days}d</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Vence en {days}d</span>
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const [tab,     setTab]     = useState<'orders' | 'cxp'>('orders')
  const [search,  setSearch]  = useState('')
  const [statusF, setStatusF] = useState('')

  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders', search, statusF],
    queryFn: async () => {
      const { data } = await api.get('/purchase-orders', { params: { search: search || undefined, status: statusF || undefined } })
      return data.data ?? data
    },
    enabled: tab === 'orders',
  })

  const { data: cxpList = [], isLoading: cxpLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders-cxp'],
    queryFn: async () => {
      const { data } = await api.get('/purchase-orders/cxp/pending')
      return data.data ?? data
    },
    enabled: tab === 'cxp',
  })

  const now            = Date.now()
  const cxpOverdue     = cxpList.filter(p => p.dueDate && new Date(p.dueDate).getTime() < now)
  const cxpUpcoming    = cxpList.filter(p => !p.dueDate || new Date(p.dueDate).getTime() >= now)
  const cxpTotal       = cxpList.reduce((s, p) => s + p.total, 0)
  const cxpOverdueTotal = cxpOverdue.reduce((s, p) => s + p.total, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Órdenes de Compra"
        subtitle="Gestión de órdenes a proveedores y cuentas por pagar"
        actions={<Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => router.push('/dashboard/purchase-orders/new')}>Nueva OC</Button>}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['orders', 'cxp'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px', tab === t ? 'border-[#293c4f] text-[#293c4f]' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t === 'orders' ? 'Todas las OC' : 'Cuentas por Pagar'}
            {t === 'cxp' && cxpList.length > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">{cxpList.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Orders tab ─────────────────────────────────────── */}
      {tab === 'orders' && (
        <>
          <Card padding="sm">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" placeholder="Buscar por número, proveedor…" value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]" />
              </div>
              <Select value={statusF} onChange={e => setStatusF(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-2">
                <option value="">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </div>
          </Card>

          <Card padding="sm">
            {isLoading ? (
              <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : orders.length === 0 ? (
              <EmptyState icon={<ShoppingCart className="w-5 h-5" />} title="No hay órdenes de compra" description="Crea una nueva orden con el botón de arriba." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Número', 'Proveedor', 'BU', 'Total', 'Tipo', 'Estado', ''].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/purchase-orders/${o.id}`)}>
                      <td className="px-3 py-3 font-mono text-xs font-medium text-[#293c4f]">{o.number}</td>
                      <td className="px-3 py-3 text-xs text-gray-800">{o.supplier?.name ?? '—'}</td>
                      <td className="px-3 py-3">
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={o.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                          {o.businessUnit}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-gray-900">{formatCurrency(o.total)}</td>
                      <td className="px-3 py-3">
                        {o.isCredit
                          ? <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">Crédito {o.paymentTerms}d</span>
                          : <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Contado</span>
                        }
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[o.status])}>{STATUS_LABELS[o.status]}</span>
                      </td>
                      <td className="px-3 py-3"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {/* ── CxP tab ────────────────────────────────────────── */}
      {tab === 'cxp' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card padding="sm">
              <p className="text-xs text-gray-400 mb-1">Total pendiente</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(cxpTotal)}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-gray-400 mb-1">Vencidas</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(cxpOverdueTotal)}</p>
              <p className="text-xs text-red-400">{cxpOverdue.length} órdenes</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-gray-400 mb-1">Por vencer</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(cxpTotal - cxpOverdueTotal)}</p>
              <p className="text-xs text-gray-400">{cxpUpcoming.length} órdenes</p>
            </Card>
          </div>

          <Card padding="sm">
            {cxpLoading ? (
              <div className="space-y-3 p-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : cxpList.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="w-5 h-5" />} title="Sin cuentas por pagar" description="No hay compras a crédito pendientes de pago." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['OC#', 'Proveedor', 'BU', 'Total', 'Vencimiento', 'Estado', ''].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cxpList.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/purchase-orders/${p.id}`)}>
                      <td className="px-3 py-3 font-mono text-xs font-medium text-[#293c4f]">{p.number}</td>
                      <td className="px-3 py-3 text-xs text-gray-800">{(p as any).supplier?.name ?? '—'}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{p.businessUnit}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-gray-900">{formatCurrency(p.total)}</td>
                      <td className="px-3 py-3 text-xs text-gray-500">{p.dueDate ? formatDate(p.dueDate) : '—'}</td>
                      <td className="px-3 py-3"><DueBadge dueDate={p.dueDate} /></td>
                      <td className="px-3 py-3">
                        <button onClick={e => { e.stopPropagation(); router.push(`/dashboard/purchase-orders/${p.id}`) }}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[#293c4f] text-white hover:bg-[#1e2d3d] transition-colors">
                          Ver / Pagar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
