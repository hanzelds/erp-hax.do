'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Edit2, X } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { PageHeader, Button, Card, CardHeader, Skeleton, EmptyState } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

type BudgetCategory = 'OPERATIONS' | 'MARKETING' | 'TECHNOLOGY' | 'RENT' | 'UTILITIES' | 'SALARIES' | 'TAXES' | 'OTHER' | 'TOTAL'
type BusinessUnit   = 'HAX' | 'KODER'
type BudgetStatus   = 'ON_TRACK' | 'ALERT' | 'EXCEEDED'

interface BudgetLine {
  id: string
  category: BudgetCategory
  businessUnit: BusinessUnit
  period: string
  amountBudgeted: number
  amountExecuted: number
  status: BudgetStatus
}

interface BudgetSummary {
  period: string
  totalBudgeted: number
  totalExecuted: number
  status: BudgetStatus
}

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  OPERATIONS:  'Operaciones',
  MARKETING:   'Marketing',
  TECHNOLOGY:  'Tecnología',
  RENT:        'Alquiler',
  UTILITIES:   'Utilidades',
  SALARIES:    'Salarios',
  TAXES:       'Impuestos',
  OTHER:       'Otros',
  TOTAL:       'Total',
}

const STATUS_COLORS: Record<BudgetStatus, string> = {
  ON_TRACK: 'bg-green-500',
  ALERT:    'bg-amber-500',
  EXCEEDED: 'bg-red-500',
}

const STATUS_LABELS: Record<BudgetStatus, string> = {
  ON_TRACK: 'En presupuesto',
  ALERT:    'Alerta (>80%)',
  EXCEEDED: 'Excedido',
}

const STATUS_TEXT: Record<BudgetStatus, string> = {
  ON_TRACK: 'text-green-700',
  ALERT:    'text-amber-700',
  EXCEEDED: 'text-red-700',
}

const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] disabled:bg-gray-50 disabled:text-gray-400'
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7)
}

function pct(executed: number, budgeted: number): number {
  if (!budgeted) return 0
  return Math.min((executed / budgeted) * 100, 100)
}

function getStatus(executed: number, budgeted: number): BudgetStatus {
  if (!budgeted) return 'ON_TRACK'
  const ratio = executed / budgeted
  if (ratio > 1)    return 'EXCEEDED'
  if (ratio > 0.8)  return 'ALERT'
  return 'ON_TRACK'
}

export default function BudgetsPage() {
  const { user } = useAuthStore()
  const isAdmin  = user?.role === 'ADMIN'
  const qc       = useQueryClient()

  const [period, setPeriod]         = useState(currentPeriod())
  const [editModal, setEditModal]   = useState<BusinessUnit | null>(null)
  const [syncingBu, setSyncingBu]   = useState<BusinessUnit | null>(null)

  const { data: haxBudgets = [], isLoading: loadingHax } = useQuery<BudgetLine[]>({
    queryKey: ['budgets', period, 'HAX'],
    queryFn: async () => {
      const { data } = await api.get('/budgets', { params: { period, businessUnit: 'HAX' } })
      return data.data ?? data
    },
  })

  const { data: koderBudgets = [], isLoading: loadingKoder } = useQuery<BudgetLine[]>({
    queryKey: ['budgets', period, 'KODER'],
    queryFn: async () => {
      const { data } = await api.get('/budgets', { params: { period, businessUnit: 'KODER' } })
      return data.data ?? data
    },
  })

  const { data: summary } = useQuery<BudgetSummary>({
    queryKey: ['budgets-summary', period],
    queryFn: async () => {
      const { data } = await api.get('/budgets/summary', { params: { period } })
      return data.data ?? data
    },
  })

  const syncBudget = useMutation({
    mutationFn: async ({ bu }: { bu: BusinessUnit }) => {
      await api.post('/budgets/sync', { period, businessUnit: bu })
    },
    onSuccess: (_, { bu }) => {
      qc.invalidateQueries({ queryKey: ['budgets', period, bu] })
      qc.invalidateQueries({ queryKey: ['budgets-summary', period] })
      setSyncingBu(null)
    },
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Presupuestos"
        subtitle="Seguimiento de ejecución presupuestaria"
        actions={
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700"
            />
          </div>
        }
      />

      {/* Consolidated summary */}
      {summary && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-400">Consolidado {period}</p>
              <p className="text-lg font-bold text-[#293c4f] mt-0.5">
                {formatCurrency(summary.totalExecuted)} <span className="text-sm font-normal text-gray-400">/ {formatCurrency(summary.totalBudgeted)}</span>
              </p>
            </div>
            <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full',
              summary.status === 'ON_TRACK' ? 'bg-green-100 text-green-700' :
              summary.status === 'ALERT'    ? 'bg-amber-100 text-amber-700' :
                                              'bg-red-100 text-red-700')}>
              {STATUS_LABELS[summary.status]}
            </span>
          </div>
          <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', STATUS_COLORS[summary.status])}
              style={{ width: `${pct(summary.totalExecuted, summary.totalBudgeted)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {pct(summary.totalExecuted, summary.totalBudgeted).toFixed(1)}% ejecutado
          </p>
        </Card>
      )}

      {/* HAX */}
      <BudgetSection
        title="HAX"
        lines={haxBudgets}
        isLoading={loadingHax}
        isAdmin={isAdmin}
        isSyncing={syncingBu === 'HAX'}
        onSync={() => { setSyncingBu('HAX'); syncBudget.mutate({ bu: 'HAX' }) }}
        onEdit={() => setEditModal('HAX')}
      />

      {/* KODER */}
      <BudgetSection
        title="KODER"
        lines={koderBudgets}
        isLoading={loadingKoder}
        isAdmin={isAdmin}
        isSyncing={syncingBu === 'KODER'}
        onSync={() => { setSyncingBu('KODER'); syncBudget.mutate({ bu: 'KODER' }) }}
        onEdit={() => setEditModal('KODER')}
      />

      {editModal && (
        <EditBudgetModal
          bu={editModal}
          period={period}
          lines={editModal === 'HAX' ? haxBudgets : koderBudgets}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  )
}

// ── Budget Section ────────────────────────────────────────────

function BudgetSection({
  title, lines, isLoading, isAdmin, isSyncing, onSync, onEdit,
}: {
  title: string
  lines: BudgetLine[]
  isLoading: boolean
  isAdmin: boolean
  isSyncing: boolean
  onSync: () => void
  onEdit: () => void
}) {
  const displayLines = lines.filter((l) => l.category !== 'TOTAL')
  const totalLine    = lines.find((l) => l.category === 'TOTAL')
  const totalBudgeted = totalLine?.amountBudgeted ?? displayLines.reduce((s, l) => s + l.amountBudgeted, 0)
  const totalExecuted = totalLine?.amountExecuted ?? displayLines.reduce((s, l) => s + l.amountExecuted, 0)
  const totalStatus   = totalLine?.status ?? getStatus(totalExecuted, totalBudgeted)

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <CardHeader
          title={`Presupuesto ${title}`}
          subtitle={`${formatCurrency(totalExecuted)} ejecutado de ${formatCurrency(totalBudgeted)}`}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            loading={isSyncing}
            onClick={onSync}
          >
            Sincronizar
          </Button>
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Edit2 className="w-3.5 h-3.5" />}
              onClick={onEdit}
            >
              Editar presupuesto
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : displayLines.length === 0 ? (
        <EmptyState title="Sin líneas presupuestarias" description="No hay presupuesto configurado para este período." />
      ) : (
        <div className="space-y-3">
          {displayLines.map((line) => {
            const ratio  = pct(line.amountExecuted, line.amountBudgeted)
            const status = line.status ?? getStatus(line.amountExecuted, line.amountBudgeted)
            return (
              <div key={line.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{CATEGORY_LABELS[line.category]}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{formatCurrency(line.amountExecuted)} / {formatCurrency(line.amountBudgeted)}</span>
                    <span className={cn('text-xs font-medium', STATUS_TEXT[status])}>{ratio.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', STATUS_COLORS[status])}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              </div>
            )
          })}

          {/* Total row */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-800">Total</span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-700">{formatCurrency(totalExecuted)} / {formatCurrency(totalBudgeted)}</span>
                <span className={cn('text-xs font-bold', STATUS_TEXT[totalStatus])}>
                  {pct(totalExecuted, totalBudgeted).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', STATUS_COLORS[totalStatus])}
                style={{ width: `${pct(totalExecuted, totalBudgeted)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Edit Budget Modal ─────────────────────────────────────────

const EDITABLE_CATEGORIES: BudgetCategory[] = ['OPERATIONS', 'MARKETING', 'TECHNOLOGY', 'RENT', 'UTILITIES', 'SALARIES', 'TAXES', 'OTHER']

function EditBudgetModal({ bu, period, lines, onClose }: {
  bu: BusinessUnit
  period: string
  lines: BudgetLine[]
  onClose: () => void
}) {
  const qc = useQueryClient()

  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    EDITABLE_CATEGORIES.forEach((cat) => {
      const line = lines.find((l) => l.category === cat)
      map[cat] = line ? line.amountBudgeted.toFixed(2) : '0.00'
    })
    return map
  })

  const save = useMutation({
    mutationFn: async (entries: any[]) => {
      await Promise.all(entries.map((e) => api.post('/budgets', e)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets', period, bu] })
      qc.invalidateQueries({ queryKey: ['budgets-summary', period] })
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const entries = EDITABLE_CATEGORIES.map((cat) => ({
      category: cat,
      businessUnit: bu,
      period,
      amountBudgeted: parseFloat(amounts[cat]) || 0,
    }))
    save.mutate(entries)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Editar presupuesto — {bu} · {period}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {EDITABLE_CATEGORIES.map((cat) => (
            <F key={cat} label={CATEGORY_LABELS[cat]}>
              <input
                type="number" min="0" step="0.01"
                value={amounts[cat]}
                onChange={(e) => setAmounts((a) => ({ ...a, [cat]: e.target.value }))}
                className={ic}
                placeholder="0.00"
              />
            </F>
          ))}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={save.isPending}>Guardar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
