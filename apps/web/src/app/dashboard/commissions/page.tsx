'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, Plus, Check, Send, X,
  ToggleLeft, ToggleRight, Calculator,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState, Select, useConfirm } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

// ── Types ─────────────────────────────────────────────────────

type CommissionBase   = 'TOTAL' | 'SUBTOTAL' | 'COLLECTED'
type EntryStatus      = 'DRAFT' | 'APPROVED' | 'PAID' | 'CANCELLED'

interface CommissionPlan {
  id: string
  name: string
  beneficiary: string
  employeeId: string | null
  businessUnit: 'HAX' | 'KODER'
  rate: number
  base: CommissionBase
  minAmount: number | null
  isActive: boolean
  notes: string | null
  employee: { id: string; name: string; position: string | null } | null
  _count: { entries: number }
}

interface CommissionEntry {
  id: string
  planId: string
  period: string
  baseAmount: number
  rate: number
  amount: number
  invoiceCount: number
  status: EntryStatus
  sentToPayroll: boolean
  calculatedAt: string
  approvedAt: string | null
  plan: {
    id: string; name: string; beneficiary: string
    businessUnit: 'HAX' | 'KODER'; base: CommissionBase; rate: number
    employee: { id: string; name: string } | null
  }
  meetsMinimum?: boolean
}

// ── Constants ─────────────────────────────────────────────────

const BASE_LABELS: Record<CommissionBase, string> = {
  TOTAL:     'Total factura',
  SUBTOTAL:  'Subtotal (sin ITBIS)',
  COLLECTED: 'Cobrado efectivamente',
}

const STATUS_STYLES: Record<EntryStatus, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  APPROVED:  'bg-blue-100 text-blue-700',
  PAID:      'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<EntryStatus, string> = {
  DRAFT:     'Pendiente',
  APPROVED:  'Aprobada',
  PAID:      'Pagada',
  CANCELLED: 'Cancelada',
}

const BU_OPTIONS = [
  { value: '', label: 'Ambas BU' },
  { value: 'HAX',   label: 'HAX' },
  { value: 'KODER', label: 'KODER' },
]

// ── Main Page ─────────────────────────────────────────────────

type Tab = 'calculator' | 'plans' | 'history'

export default function CommissionsPage() {
  const [tab, setTab] = useState<Tab>('calculator')
  const { mode } = useAuthStore()
  const isProforma = mode === 'proforma'

  const TABS: { key: Tab; label: string }[] = [
    { key: 'calculator', label: 'Calculadora' },
    { key: 'plans',      label: 'Planes'       },
    { key: 'history',    label: 'Historial'    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comisiones"
        subtitle={isProforma ? 'Calculadora de comisiones — Modo Proforma' : 'Calculadora de comisiones por ventas y cobranza'}
        actions={
          isProforma ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Calculando sobre proformas
            </span>
          ) : undefined
        }
      />

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key ? 'border-[#293c4f] text-[#293c4f]' : 'border-transparent text-gray-400 hover:text-gray-600'
            )}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'calculator' && <CalculatorTab />}
      {tab === 'plans'      && <PlansTab />}
      {tab === 'history'    && <HistoryTab />}
    </div>
  )
}

// ── Calculator Tab ────────────────────────────────────────────

function CalculatorTab() {
  const qc = useQueryClient()
  const { user, mode } = useAuthStore()
  const isAdmin    = user?.role === 'ADMIN'
  const isProforma = mode === 'proforma'

  const now = new Date()
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [bu, setBu]         = useState('')
  const [results, setResults] = useState<CommissionEntry[] | null>(null)
  const [calcErr, setCalcErr] = useState<string | null>(null)

  const calculate = useMutation({
    mutationFn: async () => {
      setCalcErr(null)
      const { data } = await api.post('/commissions/calculate', {
        period,
        businessUnit:  bu || undefined,
        proformaOnly:  isProforma,
      })
      return data.data ?? data
    },
    onSuccess: (data) => {
      setResults(Array.isArray(data) ? data : [])
      qc.invalidateQueries({ queryKey: ['commission-entries'] })
    },
    onError: (err: any) => {
      setCalcErr(err?.response?.data?.error ?? err?.message ?? 'Error al calcular comisiones')
    },
  })

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/commissions/entries/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-entries'] })
      // Re-run calculation to refresh local results
      calculate.mutate()
    },
  })

  const toPayroll = useMutation({
    mutationFn: (id: string) => api.post(`/commissions/entries/${id}/send-to-payroll`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-entries'] })
      calculate.mutate()
    },
  })

  const totalCommissions = useMemo(
    () => (results ?? []).reduce((s, r) => s + r.amount, 0),
    [results]
  )

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Período</label>
            <input
              type="month" value={period} onChange={e => setPeriod(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Unidad de negocio</label>
            <Select value={bu} onChange={e => setBu(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700 min-w-32">
              {BU_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <Button
            variant="primary"
            icon={<Calculator className="w-4 h-4" />}
            loading={calculate.isPending}
            onClick={() => calculate.mutate()}
          >
            Calcular comisiones
          </Button>
        </div>
        {calcErr && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{calcErr}</p>
        )}
      </Card>

      {/* Results */}
      {results !== null && (
        <>
          {results.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="w-5 h-5" />}
              title="Sin planes de comisión"
              description="No hay planes activos para los criterios seleccionados. Crea planes en la pestaña Planes."
            />
          ) : (
            <Card padding="sm">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Resultado — {period}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{results.length} plan{results.length !== 1 ? 'es' : ''} calculado{results.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Total comisiones</p>
                  <p className="text-xl font-bold text-[#293c4f]">{formatCurrency(totalCommissions)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    {['Beneficiario', 'BU', 'Base cálculo', 'Monto base', 'Tasa', 'Comisión', 'Docs', 'Estado', ''].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-3 py-3">
                          <p className="text-sm font-medium text-gray-800">{r.plan.beneficiary}</p>
                          <p className="text-xs text-gray-400">{r.plan.name}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                            r.plan.businessUnit === 'HAX' ? 'bg-[#293c4f]/10 text-[#293c4f]' : 'bg-slate-100 text-slate-600')}>
                            {r.plan.businessUnit}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">{BASE_LABELS[r.plan.base]}</td>
                        <td className="px-3 py-3 text-xs font-mono text-gray-700">{formatCurrency(r.baseAmount)}</td>
                        <td className="px-3 py-3 text-xs font-mono text-gray-700">{(r.rate * 100).toFixed(1)}%</td>
                        <td className="px-3 py-3">
                          <span className={cn('text-sm font-bold', r.amount > 0 ? 'text-[#293c4f]' : 'text-gray-300')}>
                            {formatCurrency(r.amount)}
                          </span>
                          {r.meetsMinimum === false && (
                            <p className="text-[10px] text-amber-500 mt-0.5">No alcanza mínimo</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-center text-gray-500">{r.invoiceCount}</td>
                        <td className="px-3 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[r.status])}>
                            {STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {isAdmin && r.status === 'DRAFT' && r.amount > 0 && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => approve.mutate(r.id)}
                                disabled={approve.isPending}
                                title="Aprobar comisión"
                                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-40"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {isAdmin && r.status === 'APPROVED' && !r.sentToPayroll && (
                            <button
                              onClick={() => toPayroll.mutate(r.id)}
                              disabled={toPayroll.isPending}
                              title="Enviar a nómina"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40 whitespace-nowrap"
                            >
                              <Send className="w-3 h-3" />
                              Nómina
                            </button>
                          )}
                          {r.status === 'PAID' && (
                            <span className="text-xs text-green-500 font-medium">✓ En nómina</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td colSpan={5} className="px-3 py-2.5 text-xs font-bold text-gray-600">TOTAL</td>
                      <td className="px-3 py-2.5 text-base font-bold text-[#293c4f]">{formatCurrency(totalCommissions)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {results === null && !calculate.isPending && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#293c4f]/5 border border-[#293c4f]/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-[#293c4f]/40" />
          </div>
          <p className="text-sm text-gray-400">Selecciona un período y haz clic en <strong>Calcular comisiones</strong></p>
        </div>
      )}
    </div>
  )
}

// ── Plans Tab ─────────────────────────────────────────────────

function PlansTab() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const router  = useRouter()

  const { data, isLoading } = useQuery<{ data: CommissionPlan[] }>({
    queryKey: ['commission-plans'],
    queryFn: async () => {
      const { data } = await api.get('/commissions/plans', { params: { limit: 100 } })
      return data
    },
  })

  const plans = data?.data ?? []

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/commissions/plans/${id}`, { isActive: !isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-plans'] }),
  })

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isAdmin && (
          <Button asChild variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
            <Link href="/dashboard/commissions/new">Nuevo plan</Link>
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="w-5 h-5" />}
          title="Sin planes de comisión"
          description="Crea el primer plan para comenzar a calcular comisiones."
        />
      ) : (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {['Plan', 'Beneficiario', 'BU', 'Base', 'Tasa', 'Mínimo', 'Cálculos', 'Estado', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {plans.map(plan => (
                  <tr key={plan.id} className={cn('border-b border-gray-50 hover:bg-gray-50/60', !plan.isActive && 'opacity-50')}>
                    <td className="px-3 py-3">
                      <p className="text-sm font-medium text-gray-800">{plan.name}</p>
                      {plan.employee && <p className="text-xs text-gray-400">{plan.employee.name}</p>}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{plan.beneficiary}</td>
                    <td className="px-3 py-3">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                        plan.businessUnit === 'HAX' ? 'bg-[#293c4f]/10 text-[#293c4f]' : 'bg-slate-100 text-slate-600')}>
                        {plan.businessUnit}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">{BASE_LABELS[plan.base]}</td>
                    <td className="px-3 py-3 text-sm font-mono font-semibold text-[#293c4f]">{(plan.rate * 100).toFixed(1)}%</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{plan.minAmount ? formatCurrency(plan.minAmount) : '—'}</td>
                    <td className="px-3 py-3 text-xs text-center text-gray-500">{plan._count.entries}</td>
                    <td className="px-3 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                        plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {plan.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleActive.mutate({ id: plan.id, isActive: plan.isActive })}
                            title={plan.isActive ? 'Desactivar' : 'Activar'}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#293c4f] hover:bg-gray-100 transition-colors"
                          >
                            {plan.isActive
                              ? <ToggleRight className="w-3.5 h-3.5 text-green-500" />
                              : <ToggleLeft className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  )
}

// ── History Tab ───────────────────────────────────────────────

function HistoryTab() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const confirm = useConfirm()

  const now = new Date()
  const [period, setPeriod] = useState('')
  const [status, setStatus] = useState('')
  const [bu, setBu]         = useState('')

  const { data, isLoading } = useQuery<{ data: CommissionEntry[]; total: number }>({
    queryKey: ['commission-entries', period, status, bu],
    queryFn: async () => {
      const { data } = await api.get('/commissions/entries', {
        params: {
          period:       period || undefined,
          status:       status || undefined,
          businessUnit: bu     || undefined,
          limit: 100,
        },
      })
      return data
    },
  })

  const approve = useMutation({
    mutationFn: (id: string) => api.patch(`/commissions/entries/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-entries'] }),
  })

  const toPayroll = useMutation({
    mutationFn: (id: string) => api.post(`/commissions/entries/${id}/send-to-payroll`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-entries'] }),
    onError: (err: any) => alert(err?.response?.data?.error ?? 'Error al enviar a nómina'),
  })

  const cancel = useMutation({
    mutationFn: (id: string) => api.delete(`/commissions/entries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commission-entries'] }),
  })

  const entries = data?.data ?? []

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3 px-1 py-1">
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700" />
          <Select value={status} onChange={e => setStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700">
            <option value="">Todos los estados</option>
            <option value="DRAFT">Pendiente</option>
            <option value="APPROVED">Aprobada</option>
            <option value="PAID">Pagada</option>
            <option value="CANCELLED">Cancelada</option>
          </Select>
          <Select value={bu} onChange={e => setBu(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700">
            {BU_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="w-5 h-5" />}
          title="Sin entradas"
          description="Usa la Calculadora para generar comisiones."
        />
      ) : (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {['Período', 'Beneficiario', 'Plan', 'BU', 'Base', 'Tasa', 'Comisión', 'Estado', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-3 py-3 text-xs font-mono text-gray-600">{entry.period}</td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-800">{entry.plan.beneficiary}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{entry.plan.name}</td>
                    <td className="px-3 py-3">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium',
                        entry.plan.businessUnit === 'HAX' ? 'bg-[#293c4f]/10 text-[#293c4f]' : 'bg-slate-100 text-slate-600')}>
                        {entry.plan.businessUnit}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">{BASE_LABELS[entry.plan.base]}</td>
                    <td className="px-3 py-3 text-xs font-mono">{(entry.rate * 100).toFixed(1)}%</td>
                    <td className="px-3 py-3 text-sm font-bold text-[#293c4f]">{formatCurrency(entry.amount)}</td>
                    <td className="px-3 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[entry.status])}>
                        {STATUS_LABELS[entry.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          {entry.status === 'DRAFT' && entry.amount > 0 && (
                            <button onClick={() => approve.mutate(entry.id)} title="Aprobar"
                              className="p-1.5 rounded text-blue-500 hover:bg-blue-50 transition-colors">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {entry.status === 'APPROVED' && !entry.sentToPayroll && (
                            <button onClick={() => toPayroll.mutate(entry.id)} title="Enviar a nómina"
                              className="p-1.5 rounded text-green-500 hover:bg-green-50 transition-colors">
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {entry.status !== 'PAID' && entry.status !== 'CANCELLED' && (
                            <button
                              onClick={async () => {
                                const ok = await confirm({ title: '¿Cancelar comisión?', message: 'Esta acción no se puede deshacer.', variant: 'danger' })
                                if (ok) cancel.mutate(entry.id)
                              }}
                              title="Cancelar"
                              className="p-1.5 rounded text-red-400 hover:bg-red-50 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">{entries.length} entrada{entries.length !== 1 ? 's' : ''}</p>
            <p className="text-sm font-bold text-[#293c4f]">
              Total: {formatCurrency(entries.filter(e => e.status !== 'CANCELLED').reduce((s, e) => s + e.amount, 0))}
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
