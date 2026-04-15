'use client'

import { UserCheck } from 'lucide-react'
import { PageHeader, Card, EmptyState } from '@/components/ui'

export default function PayrollPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Nómina" subtitle="Gestión de empleados y quincenas" />
      <Card>
        <EmptyState
          icon={<UserCheck className="w-5 h-5" />}
          title="Módulo en desarrollo"
          description="El módulo de nómina estará disponible próximamente. Incluirá gestión de empleados, cálculo de quincenas, deducciones y reportes."
        />
      </Card>
    </div>
  )
}
