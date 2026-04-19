'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Filter, Download, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import {
  PageHeader,
  Button,
  Card,
  Badge,
  InvoiceStatusBadge,
  Skeleton,
  EmptyState,
} from '@/components/ui'

type InvoiceStatus = 'DRAFT' | 'SENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED'

interface Invoice {
  id: string
  number: string
  sequence: number
  businessUnit: 'HAX' | 'KODER'
  client: { id: string; name: string; rnc: string }
  issueDate: string
  dueDate: string | null
  total: number
  amountDue: number
  status: InvoiceStatus
  ncf: string | null
}

interface InvoicesResponse {
  data: Invoice[]
  pagination: { total: number; page: number; limit: number; totalPages: number }
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'SENDING', label: 'Enviando' },
  { value: 'APPROVED', label: 'Aprobada' },
  { value: 'REJECTED', label: 'Rechazada' },
  { value: 'PAID', label: 'Pagada' },
  { value: 'CANCELLED', label: 'Cancelada' },
]

const BU_OPTIONS = [
  { value: '', label: 'Ambas' },
  { value: 'HAX', label: 'HAX' },
  { value: 'KODER', label: 'KODER' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'CREDITO_FISCAL', label: 'Crédito Fiscal (B01)' },
  { value: 'CONSUMO', label: 'Consumidor Final (B02)' },
  { value: 'NOTA_CREDITO', label: 'Nota de Crédito (B04)' },
]

export default function InvoicesPage() {
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [bu, setBu]           = useState('')
  const [type, setType]       = useState('')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [page, setPage]       = useState(1)
  const [exporting, setExporting] = useState(false)

  const { data, isLoading, isFetching, refetch } = useQuery<InvoicesResponse>({
    queryKey: ['invoices', { search, status, bu, type, from, to, page }],
    queryFn: async () => {
      const { data } = await api.get('/invoices', {
        params: {
          search: search || undefined,
          status: status || undefined,
          businessUnit: bu || undefined,
          type: type || undefined,
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
          page,
          limit: 20,
        },
      })
      return data
    },
  })

  const invoices   = data?.data ?? []
  const pagination = data?.pagination

  async function handleExport607() {
    setExporting(true)
    try {
      const period = new Date().toISOString().slice(0, 7) // YYYY-MM
      const response = await api.get('/reports/607/export', {
        params: { period },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `607-${period}.txt`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export 607 failed', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facturación"
        subtitle="Facturas electrónicas e-CF"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => refetch()} disabled={isFetching}>
              Actualizar
            </Button>
            <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport607} disabled={exporting}>
              {exporting ? 'Exportando…' : 'Exportar 607'}
            </Button>
            <Button asChild variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
              <Link href="/dashboard/invoices/new">Nueva factura</Link>
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3 px-1 py-1">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número, cliente…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white placeholder-gray-400"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Business unit */}
          <select
            value={bu}
            onChange={(e) => { setBu(e.target.value); setPage(1) }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700"
          >
            {BU_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1) }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 whitespace-nowrap">Desde</span>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 whitespace-nowrap">Hasta</span>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            title="No hay facturas"
            description="Crea tu primera factura electrónica para comenzar."
            action={
              <Button asChild variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                <Link href="/dashboard/invoices/new">Nueva factura</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Número', 'Cliente', 'NCF', 'Unidad', 'Fecha', 'Vence', 'Total', 'Por cobrar', 'Estado'].map((h) => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                    ))}
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="px-3 py-3">
                        <Link href={`/dashboard/invoices/${inv.id}`} className="font-mono text-xs text-[#293c4f] hover:underline font-medium">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-gray-800 text-xs font-medium">{inv.client.name}</span>
                        {inv.client.rnc && (
                          <p className="text-gray-400 text-xs">{inv.client.rnc}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-gray-500">{inv.ncf ?? '—'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-medium"
                          style={
                            inv.businessUnit === 'HAX'
                              ? { backgroundColor: '#eef1f4', color: '#293c4f' }
                              : { backgroundColor: '#f1f5f9', color: '#475569' }
                          }
                        >
                          {inv.businessUnit}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{formatDate(inv.issueDate)}</td>
                      <td className="px-3 py-3 text-xs">
                        {inv.dueDate ? (
                          <span className={cn(
                            new Date(inv.dueDate) < new Date() && inv.amountDue > 0
                              ? 'text-red-500 font-medium'
                              : 'text-gray-500'
                          )}>
                            {formatDate(inv.dueDate)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-gray-900 text-xs font-semibold">{formatCurrency(inv.total)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn('text-xs font-medium', inv.amountDue > 0 ? 'text-amber-600' : 'text-green-600')}>
                          {formatCurrency(inv.amountDue)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/dashboard/invoices/${inv.id}`}>
                          <Button variant="ghost" size="sm">Ver →</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-3 border-t border-gray-50">
                <p className="text-xs text-gray-400">
                  {pagination.total} facturas · página {pagination.page} de {pagination.totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ←
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= pagination.totalPages}
                  >
                    →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
