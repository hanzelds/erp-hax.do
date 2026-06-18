'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Mail, Phone, MapPin, Hash, Plus } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button, Card, CardHeader, Skeleton } from '@/components/ui'

interface Client {
  id: string
  name: string
  rnc: string | null
  email: string | null
  phone: string | null
  address: string | null
  isActive: boolean
  createdAt: string
}

interface Opportunity {
  id: string
  title: string
  status: string
  value?: number
  businessUnit: string
  expectedDate?: string
  createdAt: string
}

interface Quote {
  id: string
  number: string
  status: string
  total: number
  createdAt: string
}

interface Invoice {
  id: string
  number: string
  status: string
  total: number
  issueDate: string
}

const STAGE_LABELS: Record<string, string> = {
  LEAD: 'Lead', CONTACT: 'Contactado', PROPOSAL: 'Propuesta',
  NEGOTIATION: 'Negociación', CLOSED_WON: 'Ganado', CLOSED_LOST: 'Perdido',
}

const STAGE_COLORS: Record<string, string> = {
  LEAD: 'bg-gray-100 text-gray-700',
  CONTACT: 'bg-blue-50 text-blue-700',
  PROPOSAL: 'bg-yellow-50 text-yellow-700',
  NEGOTIATION: 'bg-orange-50 text-orange-700',
  CLOSED_WON: 'bg-green-50 text-green-700',
  CLOSED_LOST: 'bg-red-50 text-red-600',
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: client, isLoading: loadingClient } = useQuery<Client>({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data } = await api.get(`/clients/${id}`)
      return data.data ?? data
    },
  })

  const { data: oppsData } = useQuery<{ data: Opportunity[] }>({
    queryKey: ['client-opps', id],
    queryFn: async () => {
      const { data } = await api.get(`/crm?clientId=${id}&limit=20`)
      return data
    },
  })

  const { data: quotesData } = useQuery<{ data: Quote[] }>({
    queryKey: ['client-quotes', id],
    queryFn: async () => {
      const { data } = await api.get(`/quotes?clientId=${id}&limit=10`)
      return data
    },
  })

  const { data: invoicesData } = useQuery<{ data: Invoice[] }>({
    queryKey: ['client-invoices', id],
    queryFn: async () => {
      const { data } = await api.get(`/invoices?clientId=${id}&limit=10`)
      return data
    },
  })

  const opps = oppsData?.data ?? []
  const quotes = quotesData?.data ?? []
  const invoices = invoicesData?.data ?? []

  if (loadingClient) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20 text-gray-400 text-sm">
        Cliente no encontrado.
        <Button variant="ghost" size="sm" className="ml-2" onClick={() => router.push('/dashboard/clients')}>
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/clients')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Clientes
        </button>
      </div>

      {/* Client info card */}
      <Card padding="md">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">{client.name}</h1>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', client.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                {client.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-2">
              {client.rnc && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Hash className="w-3.5 h-3.5" /> {client.rnc}
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Mail className="w-3.5 h-3.5" /> {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Phone className="w-3.5 h-3.5" /> {client.phone}
                </span>
              )}
              {client.address && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="w-3.5 h-3.5" /> {client.address}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => router.push(`/dashboard/crm/new?clientId=${client.id}&clientName=${encodeURIComponent(client.name)}`)}
            >
              Nueva oportunidad
            </Button>
          </div>
        </div>
      </Card>

      {/* Opportunities */}
      <Card padding="sm">
        <CardHeader
          title="Oportunidades CRM"
          subtitle={`${opps.length} oportunidad${opps.length !== 1 ? 'es' : ''}`}
        />
        {opps.length === 0 ? (
          <p className="text-xs text-gray-400 px-3 pb-3">No hay oportunidades para este cliente.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Oportunidad', 'Etapa', 'Valor', 'Unidad', 'Cierre esp.'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {opps.map((opp) => (
                <tr
                  key={opp.id}
                  className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/crm/${opp.id}`)}
                >
                  <td className="px-3 py-2.5 text-xs font-medium text-gray-800 max-w-[200px] truncate">{opp.title}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STAGE_COLORS[opp.status] ?? 'bg-gray-100 text-gray-600')}>
                      {STAGE_LABELS[opp.status] ?? opp.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">
                    {opp.value ? formatCurrency(opp.value) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium',
                      opp.businessUnit === 'HAX' ? 'bg-[#eef1f4] text-[#293c4f]' : 'bg-slate-100 text-slate-600'
                    )}>{opp.businessUnit}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">
                    {opp.expectedDate ? formatDate(opp.expectedDate) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Quotes */}
      <Card padding="sm">
        <CardHeader
          title="Cotizaciones"
          subtitle={`${quotes.length} cotización${quotes.length !== 1 ? 'es' : ''}`}
        />
        {quotes.length === 0 ? (
          <p className="text-xs text-gray-400 px-3 pb-3">No hay cotizaciones para este cliente.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Número', 'Estado', 'Total', 'Fecha'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr
                  key={q.id}
                  className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                  onClick={() => router.push('/dashboard/quotes')}
                >
                  <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{q.number}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{q.status}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">{formatCurrency(q.total)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{formatDate(q.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Invoices */}
      <Card padding="sm">
        <CardHeader
          title="Facturas"
          subtitle={`${invoices.length} factura${invoices.length !== 1 ? 's' : ''}`}
        />
        {invoices.length === 0 ? (
          <p className="text-xs text-gray-400 px-3 pb-3">No hay facturas para este cliente.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Número', 'Estado', 'Total', 'Fecha'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                >
                  <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{inv.number}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{inv.status}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">{formatCurrency(inv.total)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{formatDate(inv.issueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
