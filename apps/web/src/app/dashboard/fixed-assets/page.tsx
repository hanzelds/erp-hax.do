'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronRight, RefreshCw, X } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, CardHeader, Badge, Skeleton, EmptyState } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

type AssetStatus   = 'ACTIVE' | 'FULLY_DEPRECIATED' | 'RETIRED'
type AssetCategory = 'EQUIPMENT' | 'FURNITURE' | 'VEHICLE' | 'SOFTWARE' | 'IMPROVEMENTS'

interface DepreciationEntry {
  id: string
  period: string
  amount: number
  bookValueAfter: number
}

interface FixedAsset {
  id: string
  name: string
  category: AssetCategory
  businessUnit: 'HAX' | 'KODER'
  purchaseDate: string
  purchaseValue: number
  accumulatedDepreciation: number
  bookValue: number
  status: AssetStatus
  usefulLifeMonths: number
  salvageValue: number
  supplierId?: string | null
  ncfCompra?: string | null
  notes?: string | null
  depreciationEntries?: DepreciationEntry[]
}

interface AssetsResponse {
  data: FixedAsset[]
  stats: { totalAssets: number; totalValue: number; totalBookValue: number }
}

const STATUS_LABELS: Record<AssetStatus, string> = {
  ACTIVE:             'Activo',
  FULLY_DEPRECIATED:  'Totalmente Depreciado',
  RETIRED:            'Retirado',
}

const STATUS_COLORS: Record<AssetStatus, string> = {
  ACTIVE:             'bg-green-100 text-green-700',
  FULLY_DEPRECIATED:  'bg-gray-100 text-gray-600',
  RETIRED:            'bg-red-100 text-red-700',
}

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  EQUIPMENT:    'Equipos',
  FURNITURE:    'Mobiliario',
  VEHICLE:      'Vehículo',
  SOFTWARE:     'Software',
  IMPROVEMENTS: 'Mejoras',
}

const CATEGORY_RATE: Record<AssetCategory, string> = {
  EQUIPMENT:    '33.33%/año (36 meses)',
  FURNITURE:    '10%/año (120 meses)',
  VEHICLE:      '20%/año (60 meses)',
  SOFTWARE:     '33.33%/año (36 meses)',
  IMPROVEMENTS: '',
}

const CATEGORY_OPTIONS: AssetCategory[] = ['EQUIPMENT', 'FURNITURE', 'VEHICLE', 'SOFTWARE', 'IMPROVEMENTS']
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'FULLY_DEPRECIATED', label: 'Totalmente Depreciado' },
  { value: 'RETIRED', label: 'Retirado' },
]
const BU_OPTIONS = [
  { value: '', label: 'Ambas' },
  { value: 'HAX', label: 'HAX' },
  { value: 'KODER', label: 'KODER' },
]

const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] disabled:bg-gray-50 disabled:text-gray-400'
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}

export default function FixedAssetsPage() {
  const { user } = useAuthStore()
  const isAdmin  = user?.role === 'ADMIN'
  const qc       = useQueryClient()

  const [bu, setBu]                       = useState('')
  const [status, setStatus]               = useState('')
  const [category, setCategory]           = useState('')
  const [expanded, setExpanded]           = useState<string | null>(null)
  const [showModal, setShowModal]         = useState(false)
  const [showDepPreview, setShowDepPreview] = useState(false)

  const { data, isLoading, refetch, isFetching } = useQuery<AssetsResponse>({
    queryKey: ['fixed-assets', { bu, status, category }],
    queryFn: async () => {
      const { data } = await api.get('/fixed-assets', {
        params: {
          businessUnit: bu || undefined,
          status: status || undefined,
          category: category || undefined,
        },
      })
      return data
    },
  })

  const assets = data?.data ?? []
  const stats  = data?.stats

  const runDepreciation = useMutation({
    mutationFn: async () => api.post('/fixed-assets/depreciation/run'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
      setShowDepPreview(false)
    },
  })

  const { data: expandedAsset, isLoading: loadingExpanded } = useQuery<FixedAsset>({
    queryKey: ['fixed-asset', expanded],
    queryFn: async () => {
      const { data } = await api.get(`/fixed-assets/${expanded}`)
      return data.data ?? data
    },
    enabled: !!expanded,
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activos Fijos"
        subtitle="Gestión y depreciación de activos"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => refetch()} disabled={isFetching}>
              Actualizar
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDepPreview(true)}
                >
                  Calcular Depreciación
                </Button>
                <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>
                  Nuevo Activo
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Activos', value: stats.totalAssets.toString(), mono: true },
            { label: 'Valor de Compra', value: formatCurrency(stats.totalValue) },
            { label: 'Valor en Libros', value: formatCurrency(stats.totalBookValue) },
          ].map((s) => (
            <Card key={s.label}>
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className={cn('text-2xl font-bold text-[#293c4f] mt-1', s.mono && 'text-3xl')}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3 px-1 py-1">
          <select value={bu} onChange={(e) => setBu(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700">
            {BU_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#293c4f] bg-white text-gray-700">
            <option value="">Todas las categorías</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        {isLoading ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : assets.length === 0 ? (
          <EmptyState
            title="Sin activos fijos"
            description="Registra tu primer activo fijo para comenzar."
            action={isAdmin ? <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowModal(true)}>Nuevo Activo</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-3 py-2.5 w-8" />
                  {['Nombre', 'Categoría', 'Unidad', 'Valor Compra', 'Dep. Acumulada', 'Valor en Libros', 'Estado'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <>
                    <tr
                      key={asset.id}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                      onClick={() => setExpanded(expanded === asset.id ? null : asset.id)}
                    >
                      <td className="px-3 py-3 text-gray-400">
                        {expanded === asset.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-3 py-3 text-xs font-medium text-gray-800">{asset.name}</td>
                      <td className="px-3 py-3">
                        <div>
                          <span className="text-xs font-medium text-gray-700">{CATEGORY_LABELS[asset.category]}</span>
                          {CATEGORY_RATE[asset.category] && (
                            <p className="text-xs text-gray-400 mt-0.5">{CATEGORY_RATE[asset.category]}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                          style={asset.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                          {asset.businessUnit}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs font-medium text-gray-900">{formatCurrency(asset.purchaseValue)}</td>
                      <td className="px-3 py-3 text-xs text-red-600 font-medium">{formatCurrency(asset.accumulatedDepreciation)}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-[#293c4f]">{formatCurrency(asset.bookValue)}</td>
                      <td className="px-3 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[asset.status])}>
                          {STATUS_LABELS[asset.status]}
                        </span>
                      </td>
                    </tr>
                    {expanded === asset.id && (
                      <tr key={`${asset.id}-detail`} className="bg-gray-50/60">
                        <td colSpan={8} className="px-6 py-4">
                          {loadingExpanded ? (
                            <Skeleton className="h-24 w-full" />
                          ) : expandedAsset ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div><p className="text-xs text-gray-400">Fecha compra</p><p className="text-xs font-medium text-gray-800 mt-0.5">{formatDate(expandedAsset.purchaseDate)}</p></div>
                                <div><p className="text-xs text-gray-400">Vida útil</p><p className="text-xs font-medium text-gray-800 mt-0.5">{expandedAsset.usefulLifeMonths} meses</p></div>
                                <div><p className="text-xs text-gray-400">Valor residual</p><p className="text-xs font-medium text-gray-800 mt-0.5">{formatCurrency(expandedAsset.salvageValue)}</p></div>
                                {expandedAsset.ncfCompra && <div><p className="text-xs text-gray-400">NCF Compra</p><p className="font-mono text-xs text-gray-700 mt-0.5">{expandedAsset.ncfCompra}</p></div>}
                                {expandedAsset.notes && <div className="col-span-2 sm:col-span-4"><p className="text-xs text-gray-400">Notas</p><p className="text-xs text-gray-700 mt-0.5">{expandedAsset.notes}</p></div>}
                              </div>
                              {expandedAsset.depreciationEntries && expandedAsset.depreciationEntries.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 mb-2">Historial de Depreciación</p>
                                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-gray-100">
                                          {['Período', 'Monto', 'Valor en Libros'].map((h) => (
                                            <th key={h} className="text-left text-xs font-medium text-gray-500 px-3 py-2">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {expandedAsset.depreciationEntries.map((d) => (
                                          <tr key={d.id} className="border-t border-gray-100">
                                            <td className="px-3 py-2 font-mono text-gray-600">{d.period}</td>
                                            <td className="px-3 py-2 text-red-600 font-medium">{formatCurrency(d.amount)}</td>
                                            <td className="px-3 py-2 font-medium text-gray-800">{formatCurrency(d.bookValueAfter)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showModal && <NewAssetModal onClose={() => setShowModal(false)} />}
      {showDepPreview && (
        <DepreciationPreviewModal
          onClose={() => setShowDepPreview(false)}
          onApprove={() => runDepreciation.mutate()}
          approving={runDepreciation.isPending}
        />
      )}
    </div>
  )
}

// ── Depreciation Preview Modal ────────────────────────────────

interface DepreciationPreview {
  assetId: string
  name: string
  category: AssetCategory
  currentBookValue: number
  depreciationAmount: number
  newBookValue: number
  period: string
}

interface DepreciationPreviewResponse {
  period: string
  totalAmount: number
  count: number
  previews: DepreciationPreview[]
}

function DepreciationPreviewModal({
  onClose,
  onApprove,
  approving,
}: {
  onClose: () => void
  onApprove: () => void
  approving: boolean
}) {
  const { data, isLoading, isError } = useQuery<DepreciationPreviewResponse>({
    queryKey: ['depreciation-preview'],
    queryFn: async () => {
      const { data } = await api.get('/fixed-assets/depreciation/preview')
      return data.data ?? data
    },
    retry: false,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Vista previa de depreciación</h2>
            {data && (
              <p className="text-xs text-gray-400 mt-0.5">
                Período {data.period} · {data.count} activo{data.count !== 1 ? 's' : ''} · Total:{' '}
                <span className="font-semibold text-[#293c4f]">{formatCurrency(data.totalAmount)}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : isError ? (
            <div className="text-center py-10 text-sm text-red-500">
              Error al cargar la vista previa. No hay activos activos para depreciar en este período.
            </div>
          ) : !data || data.count === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">
              No hay activos activos pendientes de depreciación en el período actual.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Activo', 'Categoría', 'Valor actual', 'Depreciación', 'Valor nuevo'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-gray-400 px-2 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.previews.filter((p: any) => !p.skipped).map((p: any) => (
                  <tr key={p.assetId} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-2 py-3 text-xs font-medium text-gray-800">{p.name}</td>
                    <td className="px-2 py-3 text-xs text-gray-500">{CATEGORY_LABELS[p.category as AssetCategory] ?? p.category}</td>
                    <td className="px-2 py-3 text-xs text-gray-700">{formatCurrency(p.currentBookValue)}</td>
                    <td className="px-2 py-3 text-xs font-semibold text-red-600">− {formatCurrency(p.depreciationAmount)}</td>
                    <td className="px-2 py-3 text-xs font-semibold text-[#293c4f]">{formatCurrency(p.newBookValue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-2 py-2.5 text-xs font-semibold text-gray-600">Total depreciación del período</td>
                  <td className="px-2 py-2.5 text-xs font-bold text-red-600">− {formatCurrency(data.totalAmount)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Warning */}
        {data && data.count > 0 && (
          <div className="mx-6 mb-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 shrink-0">
            Al aprobar se generarán <strong>{data.count} asiento{data.count !== 1 ? 's' : ''} contable{data.count !== 1 ? 's' : ''}</strong> de depreciación por un total de{' '}
            <strong>{formatCurrency(data.totalAmount)}</strong>. Esta acción no se puede deshacer.
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <Button variant="secondary" onClick={onClose} disabled={approving}>Cancelar</Button>
          {data && data.count > 0 && (
            <Button
              variant="primary"
              loading={approving}
              onClick={onApprove}
            >
              Aprobar y generar asientos
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── New Asset Modal ───────────────────────────────────────────

function NewAssetModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    category: 'EQUIPMENT' as AssetCategory,
    businessUnit: 'HAX' as 'HAX' | 'KODER',
    purchaseDate: '',
    purchaseValue: '',
    usefulLifeMonths: '',
    salvageValue: '',
    supplierId: '',
    ncfCompra: '',
    notes: '',
  })

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const save = useMutation({
    mutationFn: async (body: any) => api.post('/fixed-assets', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-assets'] })
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    save.mutate({
      name: form.name,
      category: form.category,
      businessUnit: form.businessUnit,
      purchaseDate: form.purchaseDate,
      purchaseValue: parseFloat(form.purchaseValue),
      usefulLifeMonths: parseInt(form.usefulLifeMonths),
      salvageValue: parseFloat(form.salvageValue) || 0,
      supplierId: form.supplierId || undefined,
      ncfCompra: form.ncfCompra || undefined,
      notes: form.notes || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nuevo Activo Fijo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <F label="Nombre *">
            <input type="text" required value={form.name} onChange={(e) => set('name', e.target.value)} className={ic} placeholder="Laptop Dell XPS 15" />
          </F>
          <div className="grid grid-cols-2 gap-4">
            <F label="Categoría *">
              <select required value={form.category} onChange={(e) => set('category', e.target.value as AssetCategory)} className={ic}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}{CATEGORY_RATE[c] ? ` — ${CATEGORY_RATE[c]}` : ''}</option>
                ))}
              </select>
            </F>
            <F label="Unidad de Negocio *">
              <select required value={form.businessUnit} onChange={(e) => set('businessUnit', e.target.value as 'HAX' | 'KODER')} className={ic}>
                <option value="HAX">HAX</option>
                <option value="KODER">KODER</option>
              </select>
            </F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Fecha de Compra *">
              <input type="date" required value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} className={ic} />
            </F>
            <F label="Valor de Compra *">
              <input type="number" required min="0" step="0.01" value={form.purchaseValue} onChange={(e) => set('purchaseValue', e.target.value)} className={ic} placeholder="0.00" />
            </F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Vida Útil (meses) *">
              <input type="number" required min="1" value={form.usefulLifeMonths} onChange={(e) => set('usefulLifeMonths', e.target.value)} className={ic} placeholder="36" />
            </F>
            <F label="Valor Residual">
              <input type="number" min="0" step="0.01" value={form.salvageValue} onChange={(e) => set('salvageValue', e.target.value)} className={ic} placeholder="0.00" />
            </F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="ID Proveedor (opcional)">
              <input type="text" value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)} className={ic} />
            </F>
            <F label="NCF de Compra (opcional)">
              <input type="text" value={form.ncfCompra} onChange={(e) => set('ncfCompra', e.target.value)} className={ic} placeholder="B11XXXXXXXXXX" />
            </F>
          </div>
          <F label="Notas (opcional)">
            <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] resize-none" />
          </F>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" loading={save.isPending}>Guardar Activo</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
