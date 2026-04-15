'use client'

import { useQuery } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PageHeader, Card, CardHeader, Skeleton, EmptyState } from '@/components/ui'

interface Payment {
  id: string
  amount: number
  method: string
  reference: string | null
  paidAt: string
  invoice: { id: string; number: string; client: { name: string } }
}

export default function PaymentsPage() {
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data } = await api.get('/payments')
      return data.data ?? data
    },
  })

  return (
    <div className="space-y-5">
      <PageHeader title="Cobros" subtitle="Historial de pagos recibidos" />
      <Card padding="sm">
        {isLoading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState icon={<CreditCard className="w-5 h-5" />} title="No hay cobros registrados" description="Los cobros se registran al marcar facturas como pagadas." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Factura', 'Cliente', 'Fecha', 'Método', 'Referencia', 'Monto'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-3 py-3 font-mono text-xs text-[#293c4f]">{p.invoice.number}</td>
                  <td className="px-3 py-3 text-xs text-gray-800">{p.invoice.client.name}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{formatDate(p.paidAt)}</td>
                  <td className="px-3 py-3 text-xs text-gray-600">{p.method}</td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-400">{p.reference ?? '—'}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
