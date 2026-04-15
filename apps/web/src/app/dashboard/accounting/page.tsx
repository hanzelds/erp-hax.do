'use client'

import { BookOpen } from 'lucide-react'
import { PageHeader, Card, EmptyState } from '@/components/ui'

export default function AccountingPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Contabilidad" subtitle="Asientos y plan de cuentas" />
      <Card>
        <EmptyState
          icon={<BookOpen className="w-5 h-5" />}
          title="Módulo en desarrollo"
          description="El módulo de contabilidad estará disponible próximamente. Incluirá el plan de cuentas, asientos contables y estados financieros."
        />
      </Card>
    </div>
  )
}
