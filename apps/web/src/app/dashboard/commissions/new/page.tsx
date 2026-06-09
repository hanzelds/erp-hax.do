'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Select } from '@/components/ui'

type CommissionBase = 'TOTAL' | 'SUBTOTAL' | 'COLLECTED'

interface PlanForm {
  name: string
  beneficiary: string
  employeeId: string
  businessUnit: string
  rate: string
  base: CommissionBase
  minAmount: string
  notes: string
}

const EMPTY: PlanForm = {
  name: '', beneficiary: '', employeeId: '',
  businessUnit: 'HAX', rate: '', base: 'COLLECTED',
  minAmount: '', notes: '',
}

const ic = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#293c4f]/15 focus:border-[#293c4f] bg-white'

export default function NewCommissionPlanPage() {
  const router = useRouter()
  const qc     = useQueryClient()
  const [form, setForm] = useState<PlanForm>(EMPTY)
  const [err, setErr]   = useState<string | null>(null)

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['employees-active'],
    queryFn: async () => {
      const { data } = await api.get('/payroll/employees', { params: { isActive: true, limit: 200 } })
      return data.data ?? data
    },
  })

  const f = (key: keyof PlanForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const save = useMutation({
    mutationFn: async () => {
      setErr(null)
      if (!form.name.trim())        throw new Error('El nombre del plan es requerido')
      if (!form.beneficiary.trim()) throw new Error('El beneficiario es requerido')
      if (!form.rate || parseFloat(form.rate) <= 0) throw new Error('La tasa debe ser mayor a 0')
      if (parseFloat(form.rate) > 100) throw new Error('La tasa no puede superar 100%')

      await api.post('/commissions/plans', {
        name:         form.name.trim(),
        beneficiary:  form.beneficiary.trim(),
        employeeId:   form.employeeId || undefined,
        businessUnit: form.businessUnit,
        rate:         parseFloat(form.rate) / 100,
        base:         form.base,
        minAmount:    form.minAmount ? parseFloat(form.minAmount) : undefined,
        notes:        form.notes.trim() || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-plans'] })
      router.push('/dashboard/commissions?tab=plans')
    },
    onError: (e: any) => {
      setErr(e?.response?.data?.error ?? e?.message ?? 'Error al guardar el plan')
    },
  })

  return (
    <div className="min-h-screen bg-[#f4f6f8]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[#f4f6f8] px-6 pt-5 pb-3 flex items-center justify-between">
        <Link href="/dashboard/commissions"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a Comisiones
        </Link>
        <h1 className="text-base font-semibold text-gray-800">Nuevo plan de comisión</h1>
        <div className="w-40" />
      </div>

      <div className="px-6 pb-28 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Configurar plan</h2>
            <p className="text-sm text-gray-400 mt-1">
              Define quién recibe la comisión, sobre qué base y a qué tasa.
            </p>
          </div>

          <div className="px-8 py-7 space-y-6">
            {err && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{err}</div>
            )}

            {/* Nombre y beneficiario */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Nombre del plan <span className="text-red-400">*</span>
                </label>
                <input value={form.name} onChange={f('name')} placeholder="Plan Vendedores HAX" className={ic} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Beneficiario <span className="text-red-400">*</span>
                </label>
                <input value={form.beneficiary} onChange={f('beneficiary')} placeholder="Carlos Pérez" className={ic} />
              </div>
            </div>

            {/* BU y base */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Unidad de negocio <span className="text-red-400">*</span>
                </label>
                <Select value={form.businessUnit} onChange={f('businessUnit')} className={ic}>
                  <option value="HAX">HAX</option>
                  <option value="KODER">KODER</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Base de cálculo
                </label>
                <Select value={form.base} onChange={f('base')} className={ic}>
                  <option value="COLLECTED">Cobrado efectivamente</option>
                  <option value="TOTAL">Total factura (con ITBIS)</option>
                  <option value="SUBTOTAL">Subtotal (sin ITBIS)</option>
                </Select>
                <p className="text-xs text-gray-400 mt-1">
                  {form.base === 'COLLECTED' && 'Suma de pagos recibidos en el período'}
                  {form.base === 'TOTAL'     && 'Total de facturas emitidas (incluye ITBIS)'}
                  {form.base === 'SUBTOTAL'  && 'Subtotal de facturas emitidas (sin ITBIS)'}
                </p>
              </div>
            </div>

            {/* Tasa y mínimo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Tasa (%) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input type="number" min="0" max="100" step="0.1"
                    value={form.rate} onChange={f('rate')} placeholder="5.00"
                    className={cn(ic, 'pr-8')} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">%</span>
                </div>
                {form.rate && (
                  <p className="text-xs text-[#293c4f] mt-1 font-medium">
                    = {(parseFloat(form.rate) / 100).toFixed(4)} sobre el monto base
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Monto mínimo para activar
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">RD$</span>
                  <input type="number" min="0" step="1"
                    value={form.minAmount} onChange={f('minAmount')} placeholder="0"
                    className={cn(ic, 'pl-10')} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Si las ventas no alcanzan este monto, la comisión es 0</p>
              </div>
            </div>

            {/* Empleado vinculado */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Vinculado a empleado de nómina (opcional)
              </label>
              <Select value={form.employeeId} onChange={f('employeeId')} className={ic}>
                <option value="">— Sin vincular —</option>
                {employees.map((e: any) => (
                  <option key={e.id} value={e.id}>
                    {e.name}{e.position ? ` · ${e.position}` : ''} ({e.businessUnit})
                  </option>
                ))}
              </Select>
              <p className="text-xs text-gray-400 mt-1">
                Si está vinculado, "Enviar a nómina" añade la comisión directamente al recibo del empleado
              </p>
            </div>

            {/* Notas */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Notas
              </label>
              <textarea value={form.notes} onChange={f('notes')}
                rows={3} placeholder="Observaciones o condiciones del plan…"
                className={cn(ic, 'resize-none')} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/commissions')}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          Crear plan
        </Button>
      </div>
    </div>
  )
}
