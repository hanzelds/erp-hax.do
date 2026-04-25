'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronRight, Check, DollarSign, X, UserMinus, Users, FileDown, Pencil, Trash2, PlusCircle } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, cn, openPdf } from '@/lib/utils'
import { PageHeader, Button, Card, Skeleton, EmptyState } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

type Tab           = 'payrolls' | 'employees'
type PayrollStatus = 'CALCULATED' | 'APPROVED' | 'PAID'
type EmployeeType  = 'SALARIED' | 'CONTRACTOR'
type AdditionType  = 'COMMISSION' | 'OVERTIME' | 'INCENTIVE' | 'BONUS' | 'VACATION_PAY' | 'OTHER'

interface Employee {
  id: string; name: string; email: string; position?: string
  type: EmployeeType; businessUnit: 'HAX' | 'KODER'
  baseSalary: number; isActive: boolean; hiredAt: string
}

interface PayrollAddition {
  id: string; type: AdditionType; description?: string
  amount: number; hours?: number; rate?: number
}

interface PayrollItem {
  id: string; employeeId: string; grossSalary: number
  afpEmployee: number; sfsEmployee: number; isr: number
  netSalary: number; afpEmployer: number; sfsEmployer: number
  employee: { id: string; name: string; type: string; position?: string }
  additions: PayrollAddition[]
}

interface Payroll {
  id: string; businessUnit: 'HAX' | 'KODER'; period: string
  status: PayrollStatus; totalGross: number; totalNet: number
  totalIsr: number; totalAfpEmployee: number; totalSfsEmployee: number
  totalEmployerCost: number; approvedAt?: string; paidAt?: string
  _count?: { items: number }; items?: PayrollItem[]
}

const ADDITION_LABELS: Record<AdditionType, string> = {
  COMMISSION:   'Comisión',
  OVERTIME:     'Horas extras',
  INCENTIVE:    'Incentivo',
  BONUS:        'Bono',
  VACATION_PAY: 'Vacaciones',
  OTHER:        'Otro concepto',
}
const ADDITION_COLORS: Record<AdditionType, string> = {
  COMMISSION:   'bg-purple-100 text-purple-700',
  OVERTIME:     'bg-orange-100 text-orange-700',
  INCENTIVE:    'bg-blue-100 text-blue-700',
  BONUS:        'bg-emerald-100 text-emerald-700',
  VACATION_PAY: 'bg-teal-100 text-teal-700',
  OTHER:        'bg-gray-100 text-gray-600',
}

const STATUS_COLORS: Record<PayrollStatus, string> = {
  CALCULATED: 'bg-blue-100 text-blue-700',
  APPROVED:   'bg-amber-100 text-amber-700',
  PAID:       'bg-green-100 text-green-700',
}
const STATUS_LABELS: Record<PayrollStatus, string> = {
  CALCULATED: 'Calculada', APPROVED: 'Aprobada', PAID: 'Pagada',
}

const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] disabled:bg-gray-50'
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}
function currentPeriod() { return new Date().toISOString().slice(0, 7) }

export default function PayrollPage() {
  const [tab, setTab] = useState<Tab>('payrolls')
  return (
    <div className="space-y-5">
      <PageHeader title="Nómina" subtitle="Empleados · Cálculos · TSS · ISR · Conceptos variables" />
      <div className="flex gap-1 border-b border-gray-100">
        {([{ key: 'payrolls', label: 'Nóminas' }, { key: 'employees', label: 'Empleados' }] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === key ? 'border-[#293c4f] text-[#293c4f]' : 'border-transparent text-gray-400 hover:text-gray-600')}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'payrolls'  && <PayrollsTab />}
      {tab === 'employees' && <EmployeesTab />}
    </div>
  )
}

// ── Payrolls Tab ──────────────────────────────────────────────

function PayrollsTab() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [additionModal, setAdditionModal] = useState<{
    payrollItemId: string; employeeId: string; employeeName: string
    editingAddition?: PayrollAddition
  } | null>(null)

  const { data, isLoading } = useQuery<{ data: Payroll[] }>({
    queryKey: ['payrolls'],
    queryFn: async () => { const { data } = await api.get('/payroll', { params: { limit: 50 } }); return data.data ?? data },
  })

  const { data: detail, refetch: refetchDetail } = useQuery<Payroll>({
    queryKey: ['payroll', expanded],
    queryFn: async () => { const { data } = await api.get(`/payroll/${expanded}`); return data.data ?? data },
    enabled: !!expanded,
  })

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payrolls'] }),
  })
  const pay = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/${id}/pay`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payrolls'] }),
  })
  const payTss = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/${id}/pay-tss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payrolls'] }),
  })
  const payIsr = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/${id}/pay-isr`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payrolls'] }),
  })
  const removeAddition = useMutation({
    mutationFn: ({ payrollItemId, additionId }: { payrollItemId: string; additionId: string }) =>
      api.delete(`/payroll/items/${payrollItemId}/additions/${additionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll', expanded] })
      qc.invalidateQueries({ queryKey: ['payrolls'] })
    },
  })

  const payrolls = data?.data ?? (Array.isArray(data) ? data : [])

  // Find the current expanded payroll status
  const expandedPayroll = payrolls.find(p => p.id === expanded)
  const canEditAdditions = isAdmin && expandedPayroll?.status === 'CALCULATED'

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>
          Calcular nómina
        </Button>
      </div>

      <Card padding="sm">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : payrolls.length === 0 ? (
          <EmptyState icon={<DollarSign className="w-5 h-5" />} title="Sin nóminas" description="Calcula la primera nómina para comenzar." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-2.5 w-8" />
                {['BU', 'Período', 'Empleados', 'Bruto', 'Neto', 'ISR', 'Estado', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payrolls.map((p) => (
                <>
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer"
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                    <td className="px-3 py-3 text-gray-400">
                      {expanded === p.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                        style={p.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                        {p.businessUnit}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-600">{p.period}</td>
                    <td className="px-3 py-3 text-xs text-gray-500">{p._count?.items ?? '—'}</td>
                    <td className="px-3 py-3 text-xs font-medium text-gray-700">{formatCurrency(p.totalGross)}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-[#293c4f]">{formatCurrency(p.totalNet)}</td>
                    <td className="px-3 py-3 text-xs text-red-600">{formatCurrency(p.totalIsr)}</td>
                    <td className="px-3 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[p.status as PayrollStatus] ?? 'bg-gray-100 text-gray-600')}>
                        {STATUS_LABELS[p.status as PayrollStatus] ?? p.status}
                      </span>
                    </td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      {isAdmin && p.status === 'CALCULATED' && (
                        <Button variant="secondary" size="sm" loading={approve.isPending}
                          onClick={() => confirm('¿Aprobar nómina?') && approve.mutate(p.id)}>
                          Aprobar
                        </Button>
                      )}
                      {isAdmin && p.status === 'APPROVED' && (
                        <Button variant="primary" size="sm" loading={pay.isPending}
                          onClick={() => confirm('¿Registrar pago de nómina?') && pay.mutate(p.id)}>
                          Pagar
                        </Button>
                      )}
                      {isAdmin && p.status === 'PAID' && (
                        <div className="flex gap-1">
                          <Button variant="secondary" size="sm" loading={payTss.isPending}
                            onClick={() => confirm('¿Registrar pago TSS?') && payTss.mutate(p.id)}>
                            TSS
                          </Button>
                          <Button variant="secondary" size="sm" loading={payIsr.isPending}
                            onClick={() => confirm('¿Registrar pago ISR?') && payIsr.mutate(p.id)}>
                            ISR
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* ── Expanded employee detail ── */}
                  {expanded === p.id && detail && (
                    <tr key={`${p.id}-detail`}>
                      <td colSpan={9} className="bg-gray-50/50 px-6 py-4">

                        {/* Employee rows */}
                        <div className="space-y-3">
                          {detail.items?.map((item) => {
                            const additionsTotal = item.additions.reduce((s, a) => s + a.amount, 0)
                            return (
                              <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                {/* Employee header row */}
                                <div className="grid grid-cols-7 gap-2 px-4 py-3 border-b border-gray-50">
                                  <div className="col-span-2">
                                    <p className="text-xs font-semibold text-gray-800">{item.employee.name}</p>
                                    <p className="text-[10px] text-gray-400">{item.employee.position ?? item.employee.type}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-400">Salario bruto</p>
                                    <p className="text-xs font-medium text-gray-700">{formatCurrency(item.grossSalary)}</p>
                                    {additionsTotal > 0 && (
                                      <p className="text-[10px] text-purple-600">+{formatCurrency(additionsTotal)} variables</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-400">AFP + SFS</p>
                                    <p className="text-xs text-gray-600">{formatCurrency(item.afpEmployee + item.sfsEmployee)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-400">ISR</p>
                                    <p className="text-xs text-red-500">{formatCurrency(item.isr)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-400">Neto</p>
                                    <p className="text-xs font-bold text-[#293c4f]">{formatCurrency(item.netSalary)}</p>
                                  </div>
                                  <div className="flex items-center justify-end gap-2">
                                    {canEditAdditions && (
                                      <button
                                        title="Agregar concepto"
                                        onClick={() => setAdditionModal({ payrollItemId: item.id, employeeId: item.employeeId, employeeName: item.employee.name })}
                                        className="flex items-center gap-1 text-xs text-[#293c4f] hover:opacity-70 font-medium"
                                      >
                                        <PlusCircle className="w-3.5 h-3.5" /> Concepto
                                      </button>
                                    )}
                                    <button
                                      className="flex items-center gap-1 text-[#293c4f] hover:text-blue-700 text-xs"
                                      onClick={() => openPdf(`/payroll/${p.id}/slip/${item.employee.id}`, `nomina-${item.employee.name.replace(/\s+/g, '-')}.pdf`)}
                                    >
                                      <FileDown className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Additions */}
                                {item.additions.length > 0 && (
                                  <div className="px-4 py-2 flex flex-wrap gap-2">
                                    {item.additions.map((a) => (
                                      <div key={a.id}
                                        className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border', ADDITION_COLORS[a.type])}>
                                        <span>{ADDITION_LABELS[a.type]}</span>
                                        {a.description && <span className="text-opacity-70">· {a.description}</span>}
                                        {a.hours && <span className="opacity-60">({a.hours}h)</span>}
                                        <span className="font-bold">{formatCurrency(a.amount)}</span>
                                        {canEditAdditions && (
                                          <>
                                            <button
                                              onClick={() => setAdditionModal({ payrollItemId: item.id, employeeId: item.employeeId, employeeName: item.employee.name, editingAddition: a })}
                                              className="ml-1 opacity-50 hover:opacity-100"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => confirm('¿Eliminar concepto?') && removeAddition.mutate({ payrollItemId: item.id, additionId: a.id })}
                                              className="opacity-50 hover:opacity-100 hover:text-red-500"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Payroll summary footer */}
                        <div className="mt-3 flex items-center justify-end gap-6 text-xs text-gray-500 border-t border-gray-200 pt-3">
                          <span>Bruto total: <strong className="text-gray-700">{formatCurrency(detail.totalGross)}</strong></span>
                          <span>ISR total: <strong className="text-red-500">{formatCurrency(detail.totalIsr)}</strong></span>
                          <span>Neto total: <strong className="text-[#293c4f] text-sm">{formatCurrency(detail.totalNet)}</strong></span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showModal && <CalculateModal onClose={() => setShowModal(false)} />}

      {additionModal && (
        <AdditionModal
          payrollItemId={additionModal.payrollItemId}
          employeeName={additionModal.employeeName}
          editingAddition={additionModal.editingAddition}
          onClose={() => setAdditionModal(null)}
          onSaved={() => {
            setAdditionModal(null)
            qc.invalidateQueries({ queryKey: ['payroll', expanded] })
            qc.invalidateQueries({ queryKey: ['payrolls'] })
          }}
        />
      )}
    </div>
  )
}

// ── Addition Modal ────────────────────────────────────────────

function AdditionModal({
  payrollItemId, employeeName, editingAddition, onClose, onSaved,
}: {
  payrollItemId: string
  employeeName: string
  editingAddition?: PayrollAddition
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!editingAddition
  const [type, setType]               = useState<AdditionType>(editingAddition?.type ?? 'COMMISSION')
  const [description, setDescription] = useState(editingAddition?.description ?? '')
  const [amount, setAmount]           = useState(editingAddition?.amount?.toString() ?? '')
  const [hours, setHours]             = useState(editingAddition?.hours?.toString() ?? '')
  const [rate, setRate]               = useState(editingAddition?.rate?.toString() ?? '')
  const [err, setErr]                 = useState<string | null>(null)

  // Auto-compute amount from hours × rate for overtime
  const computedAmount = type === 'OVERTIME' && hours && rate
    ? (parseFloat(hours) * parseFloat(rate)).toFixed(2)
    : null

  const save = useMutation({
    mutationFn: async () => {
      const finalAmount = type === 'OVERTIME' && computedAmount
        ? parseFloat(computedAmount)
        : parseFloat(amount)

      const body = {
        type,
        description: description || undefined,
        amount: finalAmount,
        hours:  type === 'OVERTIME' && hours ? parseFloat(hours) : undefined,
        rate:   type === 'OVERTIME' && rate  ? parseFloat(rate)  : undefined,
      }

      if (isEdit) {
        return api.patch(`/payroll/items/${payrollItemId}/additions/${editingAddition!.id}`, body)
      }
      return api.post(`/payroll/items/${payrollItemId}/additions`, body)
    },
    onSuccess: onSaved,
    onError: (e: any) => setErr(e?.response?.data?.error ?? 'Error al guardar'),
  })

  const isOvertimeValid = type === 'OVERTIME' ? !!(hours && rate) : !!amount
  const isValid = isOvertimeValid

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{isEdit ? 'Editar concepto' : 'Agregar concepto'}</h2>
            <p className="text-xs text-gray-400">{employeeName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setErr(null); save.mutate() }} className="p-6 space-y-4">
          <F label="Tipo de concepto *">
            <select value={type} onChange={(e) => { setType(e.target.value as AdditionType); setAmount(''); setHours(''); setRate('') }} className={ic}>
              {(Object.keys(ADDITION_LABELS) as AdditionType[]).map(t => (
                <option key={t} value={t}>{ADDITION_LABELS[t]}</option>
              ))}
            </select>
          </F>

          <F label="Descripción">
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              className={ic} placeholder="Detalle opcional" />
          </F>

          {type === 'OVERTIME' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <F label="Horas extras *">
                  <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)}
                    className={ic} placeholder="8" />
                </F>
                <F label="Tarifa por hora *">
                  <input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)}
                    className={ic} placeholder="500.00" />
                </F>
              </div>
              {computedAmount && (
                <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-orange-700">Total calculado</span>
                  <span className="text-sm font-bold text-orange-700">RD$ {parseFloat(computedAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          ) : (
            <F label="Monto (RD$) *">
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                className={ic} placeholder="0.00" />
            </F>
          )}

          {err && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={save.isPending} disabled={!isValid}>
              {isEdit ? 'Guardar cambios' : 'Agregar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Employees Tab ─────────────────────────────────────────────

function EmployeesTab() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const [showModal, setShowModal] = useState(false)
  const [bu, setBu] = useState('')

  const { data, isLoading } = useQuery<{ data: Employee[] }>({
    queryKey: ['employees', bu],
    queryFn: async () => {
      const { data } = await api.get('/payroll/employees', { params: { businessUnit: bu || undefined, limit: 100 } })
      return data.data ?? data
    },
  })

  const terminate = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/employees/${id}/terminate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })

  const employees = data?.data ?? (Array.isArray(data) ? data : [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select value={bu} onChange={(e) => setBu(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700">
          <option value="">Ambas BU</option>
          <option value="HAX">HAX</option>
          <option value="KODER">KODER</option>
        </select>
        {isAdmin && (
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>
            Nuevo empleado
          </Button>
        )}
      </div>

      <Card padding="sm">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : employees.length === 0 ? (
          <EmptyState icon={<Users className="w-5 h-5" />} title="Sin empleados" description="Registra el primer empleado para calcular nóminas."
            action={isAdmin ? <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>Nuevo empleado</Button> : undefined} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Nombre', 'Puesto', 'BU', 'Tipo', 'Salario Base', 'Estado', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-3 text-xs font-medium text-gray-800">{emp.name}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{emp.position ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={emp.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {emp.businessUnit}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{emp.type === 'SALARIED' ? 'Asalariado' : 'Contratista'}</td>
                  <td className="px-3 py-3 text-xs font-semibold text-[#293c4f]">{formatCurrency(emp.baseSalary)}</td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                      emp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {emp.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {isAdmin && emp.isActive && (
                      <button title="Dar de baja" className="text-gray-400 hover:text-red-500"
                        onClick={() => confirm(`¿Dar de baja a ${emp.name}?`) && terminate.mutate(emp.id)}>
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showModal && <NewEmployeeModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

// ── Calculate Payroll Modal ───────────────────────────────────

function CalculateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [bu, setBu]           = useState('HAX')
  const [month, setMonth]     = useState(currentPeriod())
  const [quincena, setQuincena] = useState<'Q1' | 'Q2'>('Q1')

  // Period format: "YYYY-MM-Q1" or "YYYY-MM-Q2"
  const period = `${month}-${quincena}`

  const calc = useMutation({
    mutationFn: () => api.post('/payroll/calculate', { businessUnit: bu, period }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payrolls'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Calcular Nómina</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); calc.mutate() }} className="p-6 space-y-4">
          <F label="Unidad de Negocio *">
            <select required value={bu} onChange={(e) => setBu(e.target.value)} className={ic}>
              <option value="HAX">HAX</option>
              <option value="KODER">KODER</option>
            </select>
          </F>
          <F label="Mes *">
            <input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className={ic} />
          </F>
          <F label="Quincena *">
            <div className="flex gap-3">
              {(['Q1', 'Q2'] as const).map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuincena(q)}
                  className={cn(
                    'flex-1 py-2 rounded-lg border text-sm font-medium transition-colors',
                    quincena === q
                      ? 'border-[#293c4f] bg-[#293c4f]/5 text-[#293c4f]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  {q === 'Q1' ? '1ra quincena (1–15)' : '2da quincena (16–fin)'}
                </button>
              ))}
            </div>
          </F>
          <p className="text-xs text-gray-400">Período: <span className="font-mono font-medium text-gray-600">{period}</span></p>
          {calc.isError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {(calc.error as any)?.response?.data?.error ?? 'Error al calcular nómina'}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={calc.isPending}>Calcular</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── New Employee Modal ────────────────────────────────────────

function NewEmployeeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '', email: '', phone: '', position: '', cedula: '',
    type: 'SALARIED', businessUnit: 'HAX', baseSalary: '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: () => api.post('/payroll/employees', {
      ...form,
      baseSalary: parseFloat(form.baseSalary),
      cedula: form.cedula || undefined,
      phone:  form.phone  || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nuevo Empleado</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="p-6 space-y-4">
          <F label="Nombre completo *">
            <input required type="text" value={form.name} onChange={(e) => set('name', e.target.value)} className={ic} placeholder="Juan García" />
          </F>
          <div className="grid grid-cols-2 gap-4">
            <F label="Email *">
              <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={ic} />
            </F>
            <F label="Teléfono">
              <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={ic} placeholder="809-000-0000" />
            </F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Puesto">
              <input type="text" value={form.position} onChange={(e) => set('position', e.target.value)} className={ic} placeholder="Diseñador" />
            </F>
            <F label="Cédula">
              <input type="text" value={form.cedula} onChange={(e) => set('cedula', e.target.value)} className={ic} placeholder="001-0000000-0" />
            </F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Tipo *">
              <select required value={form.type} onChange={(e) => set('type', e.target.value)} className={ic}>
                <option value="SALARIED">Asalariado</option>
                <option value="CONTRACTOR">Contratista</option>
              </select>
            </F>
            <F label="Unidad *">
              <select required value={form.businessUnit} onChange={(e) => set('businessUnit', e.target.value)} className={ic}>
                <option value="HAX">HAX</option>
                <option value="KODER">KODER</option>
              </select>
            </F>
          </div>
          <F label="Salario base mensual (RD$) *">
            <input required type="number" min="0" step="0.01" value={form.baseSalary}
              onChange={(e) => set('baseSalary', e.target.value)} className={ic} placeholder="50000.00" />
          </F>
          {save.isError && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {(save.error as any)?.response?.data?.error ?? 'Error al guardar'}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={save.isPending} disabled={!form.name || !form.email || !form.baseSalary}>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
