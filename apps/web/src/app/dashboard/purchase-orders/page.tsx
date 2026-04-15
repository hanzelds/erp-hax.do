'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, X, ChevronRight, ShoppingCart } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'

type POStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED'

interface PurchaseOrder {
  id: string
  number: string
  status: POStatus
  businessUnit: 'HAX' | 'KODER'
  supplier?: { id: string; name: string } | null
  issueDate: string
  expectedDate: string | null
  subtotal: number
  taxAmount: number
  total: number
  notes: string | null
  items?: POItem[]
}

interface POItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

const STATUS_LABELS: Record<POStatus, string> = {
  DRAFT: 'Borrador', SENT: 'Enviada', CONFIRMED: 'Confirmada', RECEIVED: 'Recibida', CANCELLED: 'Cancelada',
}
const STATUS_COLORS: Record<POStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-50 text-blue-700',
  CONFIRMED: 'bg-yellow-50 text-yellow-700',
  RECEIVED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-600',
}
const NEXT_STATUS: Partial<Record<POStatus, POStatus>> = {
  DRAFT: 'SENT', SENT: 'CONFIRMED', CONFIRMED: 'RECEIVED',
}
const NEXT_LABEL: Partial<Record<POStatus, string>> = {
  DRAFT: 'Enviar', SENT: 'Confirmar', CONFIRMED: 'Marcar recibida',
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient()
  const [search, setSearch]     = useState('')
  const [statusF, setStatusF]   = useState('')
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)

  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders', search, statusF],
    queryFn: async () => {
      const { data } = await api.get('/purchase-orders', { params: { search: search || undefined, status: statusF || undefined } })
      return data.data ?? data
    },
  })

  const advance = useMutation({
    mutationFn: (id: string) => api.post(`/purchase-orders/${id}/advance`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); setSelected(null) },
  })

  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/purchase-orders/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); setSelected(null) },
  })

  const { data: detail } = useQuery<PurchaseOrder>({
    queryKey: ['purchase-order', selected?.id],
    queryFn: async () => {
      const { data } = await api.get(`/purchase-orders/${selected!.id}`)
      return data
    },
    enabled: !!selected?.id,
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Órdenes de Compra"
        subtitle="Gestión de órdenes y recepción"
      />

      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Buscar por número, proveedor…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f]" />
          </div>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f]">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </Card>

      <Card padding="sm">
        {isLoading ? (
          <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : orders.length === 0 ? (
          <EmptyState icon={<ShoppingCart className="w-5 h-5" />} title="No hay órdenes de compra" description="Las órdenes de compra se crean desde el API." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Número', 'Proveedor', 'Unidad', 'Fecha', 'Esperada', 'Total', 'Estado', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer" onClick={() => setSelected(o)}>
                  <td className="px-3 py-3 font-mono text-xs font-medium text-[#293c4f]">{o.number}</td>
                  <td className="px-3 py-3 text-xs text-gray-800">{o.supplier?.name ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={o.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {o.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{formatDate(o.issueDate)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{o.expectedDate ? formatDate(o.expectedDate) : '—'}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-gray-900">{formatCurrency(o.total)}</td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[o.status])}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3"><ChevronRight className="w-4 h-4 text-gray-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Detail slide-over */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setSelected(null)} />
          <div className="w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{selected.number}</p>
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[selected.status])}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-gray-400">Proveedor</p><p className="font-medium text-gray-800">{selected.supplier?.name ?? '—'}</p></div>
                <div><p className="text-xs text-gray-400">Unidad</p><p className="font-medium text-gray-800">{selected.businessUnit}</p></div>
                <div><p className="text-xs text-gray-400">Fecha emisión</p><p className="text-gray-700">{formatDate(selected.issueDate)}</p></div>
                <div><p className="text-xs text-gray-400">Fecha esperada</p><p className="text-gray-700">{selected.expectedDate ? formatDate(selected.expectedDate) : '—'}</p></div>
              </div>

              {/* Items */}
              {(detail?.items ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Ítems</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Descripción', 'Cant.', 'Precio', 'Total'].map((h) => (
                          <th key={h} className="text-left font-medium text-gray-400 py-1.5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail?.items?.map((item) => (
                        <tr key={item.id} className="border-b border-gray-50">
                          <td className="py-2 text-gray-700">{item.description}</td>
                          <td className="py-2 text-gray-600">{item.quantity}</td>
                          <td className="py-2 text-gray-600">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-2 font-medium text-gray-800">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div className="border-t border-gray-100 pt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span><span>{formatCurrency(selected.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>ITBIS</span><span>{formatCurrency(selected.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm text-gray-900 pt-1">
                  <span>Total</span><span>{formatCurrency(selected.total)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {NEXT_STATUS[selected.status] && (
                  <Button variant="primary" size="sm" loading={advance.isPending} onClick={() => advance.mutate(selected.id)}>
                    {NEXT_LABEL[selected.status]}
                  </Button>
                )}
                {(selected.status === 'DRAFT' || selected.status === 'SENT') && (
                  <Button variant="danger" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate(selected.id)}>
                    Cancelar OC
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
