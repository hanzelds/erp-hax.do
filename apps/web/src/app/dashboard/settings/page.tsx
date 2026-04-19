'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, CheckCircle2, AlertCircle, FileText, Upload, Trash2, Play, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { openPdf } from '@/lib/utils'
import api from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, CardHeader } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

const TABS = ['Empresa', 'Usuarios', 'Facturación e-CF', 'Facturación General', 'Presupuestos', 'Activos Fijos', 'Nómina', 'Cuentas Contables', 'Correo', 'Plantillas PDF'] as const
type Tab = typeof TABS[number]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('Empresa')
  const { user } = useAuthStore()

  return (
    <div className="space-y-5">
      <PageHeader title="Configuración" subtitle="Ajustes del sistema" />

      <div className="flex items-center gap-1 border-b border-gray-100 overflow-x-auto scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap shrink-0',
              tab === t ? 'border-[#293c4f] text-[#293c4f]' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Empresa'              && <CompanyTab isAdmin={user?.role === 'ADMIN'} />}
      {tab === 'Usuarios'             && <UsersTab />}
      {tab === 'Facturación e-CF'     && <EcfTab isAdmin={user?.role === 'ADMIN'} />}
      {tab === 'Facturación General'  && <GeneralTab isAdmin={user?.role === 'ADMIN'} />}
      {tab === 'Presupuestos'         && <BudgetsTab isAdmin={user?.role === 'ADMIN'} />}
      {tab === 'Activos Fijos'        && <FixedAssetsTab isAdmin={user?.role === 'ADMIN'} />}
      {tab === 'Nómina'               && <PayrollTab isAdmin={user?.role === 'ADMIN'} />}
      {tab === 'Cuentas Contables'    && <AccountsTab isAdmin={user?.role === 'ADMIN'} />}
      {tab === 'Correo'               && <EmailTab isAdmin={user?.role === 'ADMIN'} />}
      {tab === 'Plantillas PDF'       && <PdfTemplatesTab isAdmin={user?.role === 'ADMIN'} />}
    </div>
  )
}

// ── Company tab ──────────────────────────────────────────────

interface CompanyConfig {
  companyName: string
  rnc: string
  address: string | null
  phone: string | null
  email: string | null
  logoUrl: string | null
}

function CompanyTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: config, isLoading } = useQuery<CompanyConfig>({
    queryKey: ['company-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/company')
      return data.data ?? data
    },
  })

  const [form, setForm] = useState<CompanyConfig | null>(null)
  if (config && form === null) setForm({ ...config })

  const save = useMutation({
    mutationFn: async (body: CompanyConfig) => api.put('/settings/company', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-config'] })
      setForm(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key: keyof CompanyConfig, value: string) =>
    setForm((f) => f ? { ...f, [key]: value } : f)

  if (isLoading || !form) return <div className="animate-pulse bg-gray-100 rounded-xl h-48" />

  const readOnly = !isAdmin

  return (
    <Card>
      <CardHeader title="Información de la empresa" subtitle="Datos fiscales y de contacto de la organización" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <F label="Razón social">
          <input type="text" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} className={ic} disabled={readOnly} />
        </F>
        <F label="RNC">
          <input type="text" value={form.rnc} onChange={(e) => set('rnc', e.target.value)} className={ic} disabled={readOnly} />
        </F>
        <F label="Dirección">
          <input type="text" value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} className={ic} disabled={readOnly} placeholder="Dirección fiscal" />
        </F>
        <F label="Teléfono">
          <input type="text" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} className={ic} disabled={readOnly} placeholder="(809) 000-0000" />
        </F>
        <F label="Email de contacto">
          <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} className={ic} disabled={readOnly} placeholder="facturacion@empresa.com" />
        </F>
        <F label="Sitio web (opcional)">
          <input type="url" value={(form as any).website ?? ''} onChange={(e) => set('website' as any, e.target.value)} className={ic} disabled={readOnly} placeholder="https://hax.com.do" />
        </F>
      </div>

      {isAdmin && (
        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-50">
          {saved && (
            <span className="flex items-center gap-1.5 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Guardado
            </span>
          )}
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(form)}>
            Guardar
          </Button>
        </div>
      )}
    </Card>
  )
}

// ── Users tab ─────────────────────────────────────────────────

function UsersTab() {
  const { user: me } = useAuthStore()
  const qc = useQueryClient()

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/auth/users')
      return data.data ?? data
    },
    enabled: me?.role === 'ADMIN',
  })

  const resetPw = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.post(`/auth/users/${id}/reset-password`, { newPassword: password })
    },
    onSuccess: () => alert('Contraseña reseteada'),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/auth/users/${id}`, { isActive: !isActive })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  if (me?.role !== 'ADMIN') {
    return (
      <Card>
        <p className="text-sm text-gray-500 text-center py-8">Solo los administradores pueden gestionar usuarios.</p>
      </Card>
    )
  }

  return (
    <Card padding="sm">
      <div className="px-1 pt-1 pb-3">
        <h3 className="font-semibold text-gray-900 text-sm">Usuarios del sistema</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Nombre', 'Email', 'Rol', 'Último acceso', 'Estado', ''].map((h) => (
              <th key={h} className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u: any) => (
            <tr key={u.id} className={cn('border-b border-gray-50', !u.isActive && 'opacity-50')}>
              <td className="px-3 py-3 text-xs font-medium text-gray-800">{u.name}</td>
              <td className="px-3 py-3 text-xs text-gray-500">{u.email}</td>
              <td className="px-3 py-3">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', u.role === 'ADMIN' ? 'bg-[#293c4f] text-white' : 'bg-gray-100 text-gray-600')}>
                  {u.role === 'ADMIN' ? 'Admin' : 'Contabilidad'}
                </span>
              </td>
              <td className="px-3 py-3 text-xs text-gray-400">{u.lastLogin ? formatDate(u.lastLogin) : 'Nunca'}</td>
              <td className="px-3 py-3">
                <span className={cn('text-xs font-medium', u.isActive ? 'text-green-600' : 'text-gray-400')}>
                  {u.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-3 py-3">
                {u.id !== me?.id && (
                  <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate({ id: u.id, isActive: u.isActive })}>
                    {u.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ── e-CF tab ──────────────────────────────────────────────────

interface EcfConfig {
  alanubeEnabled: boolean
  hasApiKey: boolean
  alanubeApiKeyMasked?: string
  alanubeEnv: string
  alanubeApiUrl: string
  ncfCreditoFiscal: number
  ncfConsumidor: number
  ncfNotaDebito: number
  ncfNotaCredito: number
  ncfCompras: number
  ncfRegimen: number
  itbisRate: number
  maxRetroactiveDays: number
  maxRetryCount: number
  autoJournalEntries: boolean
  requireRncB01: boolean
  pollIntervalSeconds: number
  pollTimeoutMinutes: number
}

function EcfTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved]     = useState(false)

  const { data: config, isLoading } = useQuery<EcfConfig>({
    queryKey: ['ecf-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/ecf')
      return data.data ?? data
    },
  })

  const [form, setForm] = useState<any>(null)
  if (config && form === null) {
    setForm({
      alanubeEnabled:      config.alanubeEnabled,
      alanubeApiKey:       '',
      alanubeEnv:          config.alanubeEnv,
      alanubeApiUrl:       config.alanubeApiUrl,
      ncfCreditoFiscal:    config.ncfCreditoFiscal,
      ncfConsumidor:       config.ncfConsumidor,
      ncfNotaDebito:       config.ncfNotaDebito,
      ncfNotaCredito:      config.ncfNotaCredito,
      ncfCompras:          config.ncfCompras,
      ncfRegimen:          config.ncfRegimen,
      itbisRate:           config.itbisRate,
      maxRetroactiveDays:  config.maxRetroactiveDays,
      maxRetryCount:       config.maxRetryCount,
      autoJournalEntries:  config.autoJournalEntries,
      requireRncB01:       config.requireRncB01,
      pollIntervalSeconds: config.pollIntervalSeconds,
      pollTimeoutMinutes:  config.pollTimeoutMinutes,
    })
  }

  const save = useMutation({
    mutationFn: async (body: any) => api.put('/settings/ecf', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ecf-config'] })
      setForm(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }))

  if (isLoading || !form) return <div className="animate-pulse bg-gray-100 rounded-xl h-48" />

  const readOnly = !isAdmin

  return (
    <div className="space-y-4">

      {/* Status banner */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm',
        form.alanubeEnabled
          ? 'bg-green-50 border-green-100 text-green-700'
          : 'bg-gray-50 border-gray-100 text-gray-500'
      )}>
        {form.alanubeEnabled
          ? <CheckCircle2 className="w-4 h-4 shrink-0" />
          : <AlertCircle className="w-4 h-4 shrink-0" />
        }
        <span>
          {form.alanubeEnabled
            ? `Facturación e-CF habilitada — ambiente ${form.alanubeEnv === 'production' ? 'PRODUCCIÓN' : 'sandbox'}`
            : 'Facturación e-CF deshabilitada — las facturas se emiten en modo simulación'
          }
        </span>
      </div>

      {/* Alanube connection */}
      <Card>
        <CardHeader title="Conexión Alanube" subtitle="Credenciales de integración con el proveedor e-CF" />
        <div className="space-y-4">
          <Toggle
            label="Habilitar facturación electrónica"
            description="Activa el envío real de comprobantes a la DGII a través de Alanube"
            value={form.alanubeEnabled}
            onChange={(v) => set('alanubeEnabled', v)}
            disabled={readOnly}
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <F label="API Key de Alanube">
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={form.alanubeApiKey}
                  onChange={(e) => set('alanubeApiKey', e.target.value)}
                  className={ic}
                  placeholder={config?.hasApiKey ? config.alanubeApiKeyMasked : 'Ingresa el API Key de Alanube'}
                  disabled={readOnly}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {config?.hasApiKey && !form.alanubeApiKey && (
                <p className="text-xs text-gray-400 mt-1">Deja vacío para mantener el API Key actual</p>
              )}
            </F>

            <F label="Ambiente">
              <select value={form.alanubeEnv} onChange={(e) => set('alanubeEnv', e.target.value)} className={ic} disabled={readOnly}>
                <option value="sandbox">Sandbox (pruebas)</option>
                <option value="production">Producción (DGII real)</option>
              </select>
            </F>

            <F label="URL de la API de Alanube">
              <input type="text" value={form.alanubeApiUrl} onChange={(e) => set('alanubeApiUrl', e.target.value)} className={ic} disabled={readOnly} />
            </F>
          </div>
        </div>
      </Card>

      {/* NCF sequences */}
      <Card>
        <CardHeader title="Secuencias NCF" subtitle="Próximo número a emitir por tipo de comprobante" />
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {([
            { key: 'ncfCreditoFiscal', label: 'B01 — Crédito Fiscal' },
            { key: 'ncfConsumidor',    label: 'B02 — Consumidor Final' },
            { key: 'ncfNotaDebito',    label: 'B03 — Nota de Débito' },
            { key: 'ncfNotaCredito',   label: 'B04 — Nota de Crédito' },
            { key: 'ncfCompras',       label: 'B11 — Comprobante Compras' },
            { key: 'ncfRegimen',       label: 'B14 — Régimen Especial' },
          ] as const).map(({ key, label }) => (
            <F key={key} label={label}>
              <input
                type="number" min="1" step="1"
                value={form[key]}
                onChange={(e) => set(key, parseInt(e.target.value) || 1)}
                className={ic}
                disabled={readOnly}
              />
            </F>
          ))}
        </div>
        {!readOnly && (
          <p className="text-xs text-amber-600 mt-3 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Modificar las secuencias manualmente puede causar rechazos por duplicación de NCF. Solo editar si es necesario para sincronizar con DGII.
          </p>
        )}
      </Card>

      {/* Emission rules */}
      <Card>
        <CardHeader title="Reglas de emisión" subtitle="Comportamiento del proceso de facturación electrónica" />
        <div className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <F label="Tasa ITBIS (%)">
              <input
                type="number" min="0" max="100" step="0.01"
                value={(form.itbisRate * 100).toFixed(2)}
                onChange={(e) => set('itbisRate', parseFloat(e.target.value) / 100 || 0)}
                className={ic}
                disabled={readOnly}
              />
              <p className="text-xs text-gray-400 mt-1">Actualmente: {(form.itbisRate * 100).toFixed(0)}% — Por defecto 18% según normativa DGII</p>
            </F>

            <F label="Días retroactivos permitidos">
              <input
                type="number" min="0" max="30"
                value={form.maxRetroactiveDays}
                onChange={(e) => set('maxRetroactiveDays', parseInt(e.target.value) || 0)}
                className={ic}
                disabled={readOnly}
              />
              <p className="text-xs text-gray-400 mt-1">Máximo de días hacia atrás para la fecha de emisión</p>
            </F>

            <F label="Máximo de reintentos ante error">
              <input
                type="number" min="1" max="10"
                value={form.maxRetryCount}
                onChange={(e) => set('maxRetryCount', parseInt(e.target.value) || 1)}
                className={ic}
                disabled={readOnly}
              />
              <p className="text-xs text-gray-400 mt-1">Intentos antes de marcar como FALLO definitivo</p>
            </F>

            <F label="Intervalo de consulta de estado (seg)">
              <input
                type="number" min="1" max="60"
                value={form.pollIntervalSeconds}
                onChange={(e) => set('pollIntervalSeconds', parseInt(e.target.value) || 3)}
                className={ic}
                disabled={readOnly}
              />
              <p className="text-xs text-gray-400 mt-1">Cada cuántos segundos se consulta el estado EN_PROCESO</p>
            </F>

            <F label="Timeout de respuesta DGII (min)">
              <input
                type="number" min="1" max="30"
                value={form.pollTimeoutMinutes}
                onChange={(e) => set('pollTimeoutMinutes', parseInt(e.target.value) || 5)}
                className={ic}
                disabled={readOnly}
              />
              <p className="text-xs text-gray-400 mt-1">Minutos máximos esperando respuesta antes de TIMEOUT</p>
            </F>
          </div>

          <div className="border-t border-gray-50 pt-4 space-y-3">
            <Toggle
              label="Asientos contables automáticos"
              description="Genera asientos de ingreso y ITBIS automáticamente al aprobar una factura"
              value={form.autoJournalEntries}
              onChange={(v) => set('autoJournalEntries', v)}
              disabled={readOnly}
            />
            <Toggle
              label="Exigir RNC en crédito fiscal (B01)"
              description="Rechaza el envío si el cliente no tiene RNC para facturas tipo B01"
              value={form.requireRncB01}
              onChange={(v) => set('requireRncB01', v)}
              disabled={readOnly}
            />
          </div>
        </div>
      </Card>

      {/* Save */}
      {isAdmin && (
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1.5 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Guardado
            </span>
          )}
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => save.mutate(form)}
          >
            Guardar configuración
          </Button>
        </div>
      )}
    </div>
  )
}

// ── General Invoicing Tab ────────────────────────────────────

interface GeneralConfig {
  invoiceDueDays: number
  defaultPaymentMethod: string
  budgetAlertThreshold: number
  budgetExceededThreshold: number
  fixedAssetThreshold: number
}

function GeneralTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: config, isLoading } = useQuery<GeneralConfig>({
    queryKey: ['general-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/general')
      return data.data ?? data
    },
  })

  const [form, setForm] = useState<GeneralConfig | null>(null)
  if (config && form === null) setForm({ ...config })

  const save = useMutation({
    mutationFn: async (body: GeneralConfig) => api.put('/settings/general', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['general-config'] })
      setForm(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key: keyof GeneralConfig, value: any) =>
    setForm((f) => f ? { ...f, [key]: value } : f)

  if (isLoading || !form) return <div className="animate-pulse bg-gray-100 rounded-xl h-48" />

  const readOnly = !isAdmin

  return (
    <Card>
      <CardHeader title="Parámetros de facturación" subtitle="Comportamiento general de facturas y cobros" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <F label="Días de vencimiento de facturas">
          <input
            type="number" min="0" max="365"
            value={form.invoiceDueDays}
            onChange={(e) => set('invoiceDueDays', parseInt(e.target.value) || 0)}
            className={ic} disabled={readOnly}
          />
          <p className="text-xs text-gray-400 mt-1">Días desde la emisión hasta el vencimiento por defecto</p>
        </F>
        <F label="Método de pago por defecto">
          <select
            value={form.defaultPaymentMethod}
            onChange={(e) => set('defaultPaymentMethod', e.target.value)}
            className={ic} disabled={readOnly}
          >
            <option value="TRANSFER">Transferencia bancaria</option>
            <option value="CASH">Efectivo</option>
            <option value="CHECK">Cheque</option>
            <option value="CARD">Tarjeta</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">Método de pago pre-seleccionado al crear cobros</p>
        </F>
      </div>
      {isAdmin && (
        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-50">
          {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm"><CheckCircle2 className="w-4 h-4" /> Guardado</span>}
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(form)}>Guardar</Button>
        </div>
      )}
    </Card>
  )
}

// ── Budgets Tab ───────────────────────────────────────────────

function BudgetsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: config, isLoading } = useQuery<GeneralConfig>({
    queryKey: ['general-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/general')
      return data.data ?? data
    },
  })

  const [form, setForm] = useState<GeneralConfig | null>(null)
  if (config && form === null) setForm({ ...config })

  const save = useMutation({
    mutationFn: async (body: GeneralConfig) => api.put('/settings/general', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['general-config'] })
      setForm(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key: keyof GeneralConfig, value: any) =>
    setForm((f) => f ? { ...f, [key]: value } : f)

  if (isLoading || !form) return <div className="animate-pulse bg-gray-100 rounded-xl h-48" />

  const readOnly = !isAdmin

  return (
    <Card>
      <CardHeader title="Umbrales de presupuesto" subtitle="Alertas automáticas al acercarse o superar el presupuesto asignado" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <F label={`Umbral de alerta: ${(form.budgetAlertThreshold * 100).toFixed(0)}%`}>
          <input
            type="range" min="50" max="100" step="5"
            value={form.budgetAlertThreshold * 100}
            onChange={(e) => set('budgetAlertThreshold', parseInt(e.target.value) / 100)}
            className="w-full accent-[#293c4f]" disabled={readOnly}
          />
          <p className="text-xs text-gray-400 mt-1">
            Alerta (naranja) cuando la ejecución alcanza el <strong>{(form.budgetAlertThreshold * 100).toFixed(0)}%</strong> del presupuesto
          </p>
        </F>
        <F label={`Umbral de exceso: ${(form.budgetExceededThreshold * 100).toFixed(0)}%`}>
          <input
            type="range" min="100" max="150" step="5"
            value={form.budgetExceededThreshold * 100}
            onChange={(e) => set('budgetExceededThreshold', parseInt(e.target.value) / 100)}
            className="w-full accent-[#293c4f]" disabled={readOnly}
          />
          <p className="text-xs text-gray-400 mt-1">
            Alerta (rojo) cuando la ejecución supera el <strong>{(form.budgetExceededThreshold * 100).toFixed(0)}%</strong> del presupuesto
          </p>
        </F>
      </div>

      {/* Visual preview */}
      <div className="mt-4 p-4 bg-gray-50 rounded-xl">
        <p className="text-xs font-medium text-gray-600 mb-3">Vista previa de indicadores</p>
        <div className="flex gap-4 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-green-400" />
            <span className="text-gray-600">Normal (&lt; {(form.budgetAlertThreshold * 100).toFixed(0)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-gray-600">Alerta ({(form.budgetAlertThreshold * 100).toFixed(0)}% – {(form.budgetExceededThreshold * 100).toFixed(0)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-600">Excedido (&gt; {(form.budgetExceededThreshold * 100).toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-50">
          {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm"><CheckCircle2 className="w-4 h-4" /> Guardado</span>}
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(form)}>Guardar</Button>
        </div>
      )}
    </Card>
  )
}

// ── Fixed Assets Tab ─────────────────────────────────────────

function FixedAssetsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: config, isLoading } = useQuery<GeneralConfig>({
    queryKey: ['general-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/general')
      return data.data ?? data
    },
  })

  const [form, setForm] = useState<GeneralConfig | null>(null)
  if (config && form === null) setForm({ ...config })

  const save = useMutation({
    mutationFn: async (body: GeneralConfig) => api.put('/settings/general', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['general-config'] })
      setForm(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key: keyof GeneralConfig, value: any) =>
    setForm((f) => f ? { ...f, [key]: value } : f)

  if (isLoading || !form) return <div className="animate-pulse bg-gray-100 rounded-xl h-48" />

  const readOnly = !isAdmin

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Umbral de capitalización" subtitle="Monto mínimo para capitalizar un bien como activo fijo" />
        <F label="Umbral de activo fijo (DOP)">
          <input
            type="number" min="0" step="500"
            value={form.fixedAssetThreshold}
            onChange={(e) => set('fixedAssetThreshold', parseFloat(e.target.value) || 0)}
            className={ic} disabled={readOnly}
          />
          <p className="text-xs text-gray-400 mt-1">
            Compras por debajo de <strong>DOP {form.fixedAssetThreshold.toLocaleString()}</strong> se registran como gasto directo, no como activo fijo
          </p>
        </F>
        {isAdmin && (
          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-50">
            {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm"><CheckCircle2 className="w-4 h-4" /> Guardado</span>}
            <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(form)}>Guardar</Button>
          </div>
        )}
      </Card>

      {/* Depreciation rates info */}
      <Card>
        <CardHeader title="Tasas de depreciación DGII" subtitle="Según el Código Tributario de la República Dominicana" />
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Categoría</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Método</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Tasa anual</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Vida útil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { cat: 'Equipos (Categoría A)', method: 'Línea recta', rate: '33.33%', life: '36 meses' },
                { cat: 'Software (Categoría A)', method: 'Línea recta', rate: '33.33%', life: '36 meses' },
                { cat: 'Vehículos (Categoría B)', method: 'Saldo decreciente', rate: '20%', life: '60 meses' },
                { cat: 'Mobiliario y enseres', method: 'Línea recta', rate: '10%', life: '120 meses' },
                { cat: 'Mejoras a propiedades', method: 'Personalizado', rate: 'Variable', life: 'Según contrato' },
              ].map((r) => (
                <tr key={r.cat} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-xs font-medium text-gray-800">{r.cat}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.method}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#293c4f]">{r.rate}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.life}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-3">Fuente: Art. 287 Ley 11-92 Código Tributario RD y sus modificaciones</p>
      </Card>
    </div>
  )
}

// ── Payroll / TSS Rates Tab ──────────────────────────────────

interface PayrollConfig {
  payrollAfpEmployee:   number
  payrollAfpEmployer:   number
  payrollSfsEmployee:   number
  payrollSfsEmployer:   number
  payrollRiesgoLaboral: number
}

function PayrollTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: config, isLoading } = useQuery<PayrollConfig>({
    queryKey: ['payroll-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/payroll')
      return data.data ?? data
    },
  })

  const [form, setForm] = useState<PayrollConfig | null>(null)
  if (config && form === null) setForm({ ...config })

  const save = useMutation({
    mutationFn: async (body: PayrollConfig) => api.put('/settings/payroll', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-config'] })
      setForm(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key: keyof PayrollConfig, value: number) =>
    setForm((f) => f ? { ...f, [key]: value } : f)

  if (isLoading || !form) return <div className="animate-pulse bg-gray-100 rounded-xl h-48" />

  const readOnly = !isAdmin

  const totalEmployee = form.payrollAfpEmployee + form.payrollSfsEmployee
  const totalEmployer = form.payrollAfpEmployer + form.payrollSfsEmployer + form.payrollRiesgoLaboral

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Tasas TSS — Empleado" subtitle="Deducciones del salario bruto del empleado" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <F label={`AFP Empleado — ${(form.payrollAfpEmployee * 100).toFixed(2)}%`}>
            <input type="number" min="0" max="20" step="0.01"
              value={(form.payrollAfpEmployee * 100).toFixed(2)}
              onChange={(e) => set('payrollAfpEmployee', parseFloat(e.target.value) / 100 || 0)}
              className={ic} disabled={readOnly} />
            <p className="text-xs text-gray-400 mt-1">Tasa oficial vigente: <strong>2.87%</strong> — Art. 33 Ley 87-01</p>
          </F>
          <F label={`SFS Empleado — ${(form.payrollSfsEmployee * 100).toFixed(2)}%`}>
            <input type="number" min="0" max="20" step="0.01"
              value={(form.payrollSfsEmployee * 100).toFixed(2)}
              onChange={(e) => set('payrollSfsEmployee', parseFloat(e.target.value) / 100 || 0)}
              className={ic} disabled={readOnly} />
            <p className="text-xs text-gray-400 mt-1">Tasa oficial vigente: <strong>3.04%</strong> — Seguro Familiar de Salud</p>
          </F>
        </div>
        <div className="mt-3 px-4 py-2.5 bg-blue-50 rounded-lg text-xs text-blue-700 font-medium">
          Total retención empleado: {(totalEmployee * 100).toFixed(2)}% del salario bruto
        </div>
      </Card>

      <Card>
        <CardHeader title="Tasas TSS — Empleador" subtitle="Costo adicional a cargo de la empresa" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <F label={`AFP Empleador — ${(form.payrollAfpEmployer * 100).toFixed(2)}%`}>
            <input type="number" min="0" max="30" step="0.01"
              value={(form.payrollAfpEmployer * 100).toFixed(2)}
              onChange={(e) => set('payrollAfpEmployer', parseFloat(e.target.value) / 100 || 0)}
              className={ic} disabled={readOnly} />
            <p className="text-xs text-gray-400 mt-1">Tasa oficial: <strong>7.10%</strong></p>
          </F>
          <F label={`SFS Empleador — ${(form.payrollSfsEmployer * 100).toFixed(2)}%`}>
            <input type="number" min="0" max="30" step="0.01"
              value={(form.payrollSfsEmployer * 100).toFixed(2)}
              onChange={(e) => set('payrollSfsEmployer', parseFloat(e.target.value) / 100 || 0)}
              className={ic} disabled={readOnly} />
            <p className="text-xs text-gray-400 mt-1">Tasa oficial: <strong>7.09%</strong></p>
          </F>
          <F label={`Riesgo Laboral — ${(form.payrollRiesgoLaboral * 100).toFixed(2)}%`}>
            <input type="number" min="0" max="10" step="0.01"
              value={(form.payrollRiesgoLaboral * 100).toFixed(2)}
              onChange={(e) => set('payrollRiesgoLaboral', parseFloat(e.target.value) / 100 || 0)}
              className={ic} disabled={readOnly} />
            <p className="text-xs text-gray-400 mt-1">Tasa oficial: <strong>1.20%</strong></p>
          </F>
        </div>
        <div className="mt-3 px-4 py-2.5 bg-amber-50 rounded-lg text-xs text-amber-700 font-medium">
          Total costo empleador TSS: {(totalEmployer * 100).toFixed(2)}% del salario bruto
        </div>
      </Card>

      {/* ISR brackets (read-only display) */}
      <Card>
        <CardHeader title="Escala ISR — Impuesto Sobre la Renta" subtitle="Tramos progresivos según Art. 296 Código Tributario RD (actualizado DGII)" />
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Renta anual desde', 'Renta anual hasta', 'Tasa marginal', 'Cuota fija'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { from: '0',             to: 'RD$ 416,220.01',  rate: '0%',   fixed: '—' },
                { from: 'RD$ 416,220.01', to: 'RD$ 624,329.01',  rate: '15%',  fixed: '0' },
                { from: 'RD$ 624,329.01', to: 'RD$ 867,123.01',  rate: '20%',  fixed: 'RD$ 31,216.00' },
                { from: 'RD$ 867,123.01', to: '∞',               rate: '25%',  fixed: 'RD$ 79,776.00' },
              ].map((r, i) => (
                <tr key={i} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-xs font-mono text-gray-700">{r.from}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-700">{r.to}</td>
                  <td className="px-4 py-3 text-xs font-bold text-[#293c4f]">{r.rate}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.fixed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-2">Los tramos ISR son fijados por la DGII y se actualizan con la inflación. Requiere actualización manual si la DGII publica nuevos valores.</p>
      </Card>

      {isAdmin && (
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm"><CheckCircle2 className="w-4 h-4" /> Guardado</span>}
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(form)}>Guardar tasas</Button>
        </div>
      )}
    </div>
  )
}

// ── Accounting Accounts Tab ──────────────────────────────────

interface AccountsConfig {
  acctCash:              string
  acctBank:              string
  acctReceivables:       string
  acctItbisReceivable:   string
  acctPayablesSuppliers: string
  acctPayablesEmployees: string
  acctPayablesTss:       string
  acctPayablesIsr:       string
  acctItbisPayable:      string
  acctIncomeHax:         string
  acctIncomeKoder:       string
  acctExpenseGeneral:    string
  acctExpenseSalaries:   string
  acctExpenseMarketing:  string
}

function AccountsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: config, isLoading } = useQuery<AccountsConfig>({
    queryKey: ['accounts-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/accounts')
      return data.data ?? data
    },
  })

  const [form, setForm] = useState<AccountsConfig | null>(null)
  if (config && form === null) setForm({ ...config })

  const save = useMutation({
    mutationFn: async (body: AccountsConfig) => api.put('/settings/accounts', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts-config'] })
      setForm(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key: keyof AccountsConfig, value: string) =>
    setForm((f) => f ? { ...f, [key]: value } : f)

  if (isLoading || !form) return <div className="animate-pulse bg-gray-100 rounded-xl h-48" />
  const readOnly = !isAdmin

  const groups: { title: string; subtitle: string; fields: { key: keyof AccountsConfig; label: string; hint: string }[] }[] = [
    {
      title: 'Activos', subtitle: 'Cuentas de activo (clase 1)',
      fields: [
        { key: 'acctCash',            label: 'Caja / Efectivo',          hint: 'Cuenta de efectivo en caja' },
        { key: 'acctBank',            label: 'Banco',                    hint: 'Cuenta corriente bancaria principal' },
        { key: 'acctReceivables',     label: 'Cuentas por Cobrar',       hint: 'CxC clientes (facturas aprobadas)' },
        { key: 'acctItbisReceivable', label: 'ITBIS Acreditable',        hint: 'ITBIS pagado en compras (crédito fiscal)' },
      ],
    },
    {
      title: 'Pasivos', subtitle: 'Cuentas de pasivo (clase 2)',
      fields: [
        { key: 'acctPayablesSuppliers', label: 'Cuentas por Pagar — Proveedores', hint: 'Gastos aprobados pendientes de pago' },
        { key: 'acctPayablesEmployees', label: 'Cuentas por Pagar — Empleados',   hint: 'Salarios netos pendientes de pago' },
        { key: 'acctPayablesTss',       label: 'TSS por Pagar',                   hint: 'AFP + SFS pendiente de remesa' },
        { key: 'acctPayablesIsr',       label: 'ISR Empleados por Pagar',         hint: 'ISR nómina pendiente de pago a DGII' },
        { key: 'acctItbisPayable',      label: 'ITBIS por Pagar',                 hint: 'ITBIS cobrado en ventas (IT-1)' },
      ],
    },
    {
      title: 'Ingresos', subtitle: 'Cuentas de ingreso (clase 4)',
      fields: [
        { key: 'acctIncomeHax',    label: 'Ingresos — HAX',    hint: 'Cuenta de ingresos para facturas HAX' },
        { key: 'acctIncomeKoder',  label: 'Ingresos — KODER',  hint: 'Cuenta de ingresos para facturas KODER' },
      ],
    },
    {
      title: 'Gastos', subtitle: 'Cuentas de gasto (clase 5)',
      fields: [
        { key: 'acctExpenseGeneral',   label: 'Gastos Generales',   hint: 'Operaciones, tecnología, alquiler, etc.' },
        { key: 'acctExpenseSalaries',  label: 'Gastos de Nómina',   hint: 'Salarios y carga social' },
        { key: 'acctExpenseMarketing', label: 'Gastos de Marketing', hint: 'Publicidad y mercadeo' },
      ],
    },
  ]

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Modificar los códigos de cuenta afecta los asientos automáticos de facturas, gastos y nómina. Solo cambiar si el plan de cuentas fue actualizado.
        </div>
      )}
      {groups.map((group) => (
        <Card key={group.title}>
          <CardHeader title={group.title} subtitle={group.subtitle} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {group.fields.map(({ key, label, hint }) => (
              <F key={key} label={label}>
                <input
                  type="text"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className={cn(ic, 'font-mono')}
                  disabled={readOnly}
                  placeholder="0000"
                  maxLength={10}
                />
                <p className="text-xs text-gray-400 mt-1">{hint}</p>
              </F>
            ))}
          </div>
        </Card>
      ))}
      {isAdmin && (
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm"><CheckCircle2 className="w-4 h-4" /> Guardado</span>}
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(form)}>Guardar códigos</Button>
        </div>
      )}
    </div>
  )
}

// ── Email / SMTP Tab ─────────────────────────────────────────

interface EmailConfig {
  smtpEnabled: boolean
  smtpHost:    string | null
  smtpPort:    number
  smtpUser:    string | null
  smtpFrom:    string | null
  smtpSsl:     boolean
  hasSmtpPass: boolean
}

function EmailTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [saved, setSaved]     = useState(false)
  const [showPass, setShowPass] = useState(false)

  const { data: config, isLoading } = useQuery<EmailConfig>({
    queryKey: ['email-config'],
    queryFn: async () => {
      const { data } = await api.get('/settings/email')
      return data.data ?? data
    },
  })

  const [form, setForm] = useState<any>(null)
  if (config && form === null) {
    setForm({
      smtpEnabled: config.smtpEnabled,
      smtpHost:    config.smtpHost    ?? '',
      smtpPort:    config.smtpPort    ?? 587,
      smtpUser:    config.smtpUser    ?? '',
      smtpPass:    '',
      smtpFrom:    config.smtpFrom    ?? '',
      smtpSsl:     config.smtpSsl     ?? false,
    })
  }

  const save = useMutation({
    mutationFn: async (body: any) => api.put('/settings/email', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-config'] })
      setForm(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }))

  if (isLoading || !form) return <div className="animate-pulse bg-gray-100 rounded-xl h-48" />
  const readOnly = !isAdmin

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm',
        form.smtpEnabled ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-500'
      )}>
        {form.smtpEnabled ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
        <span>{form.smtpEnabled ? `Correo habilitado — ${form.smtpFrom || 'sin remitente configurado'}` : 'Correo deshabilitado — las notificaciones por email no se enviarán'}</span>
      </div>

      <Card>
        <CardHeader title="Configuración SMTP" subtitle="Servidor de correo saliente para facturas, cotizaciones y alertas" />
        <div className="space-y-4">
          <Toggle
            label="Habilitar envío de correos"
            description="Activa el envío automático de facturas PDF y notificaciones por email"
            value={form.smtpEnabled}
            onChange={(v) => set('smtpEnabled', v)}
            disabled={readOnly}
          />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <F label="Servidor SMTP (host)">
              <input type="text" value={form.smtpHost} onChange={(e) => set('smtpHost', e.target.value)}
                className={ic} disabled={readOnly} placeholder="smtp.gmail.com" />
            </F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Puerto">
                <input type="number" min="1" max="65535" value={form.smtpPort}
                  onChange={(e) => set('smtpPort', parseInt(e.target.value) || 587)}
                  className={ic} disabled={readOnly} />
              </F>
              <F label="SSL/TLS">
                <div className="flex items-center h-[38px]">
                  <Toggle label="" description="" value={form.smtpSsl} onChange={(v) => set('smtpSsl', v)} disabled={readOnly} />
                  <span className="text-xs text-gray-500 ml-3">{form.smtpSsl ? 'SSL activo' : 'STARTTLS'}</span>
                </div>
              </F>
            </div>
            <F label="Usuario SMTP">
              <input type="text" value={form.smtpUser} onChange={(e) => set('smtpUser', e.target.value)}
                className={ic} disabled={readOnly} placeholder="facturacion@empresa.com" />
            </F>
            <F label="Contraseña SMTP">
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.smtpPass}
                  onChange={(e) => set('smtpPass', e.target.value)}
                  className={ic}
                  disabled={readOnly}
                  placeholder={config?.hasSmtpPass ? '••••••••' : 'Contraseña o App Password'}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {config?.hasSmtpPass && !form.smtpPass && (
                <p className="text-xs text-gray-400 mt-1">Deja vacío para mantener la contraseña actual</p>
              )}
            </F>
            <F label="Remitente (From)">
              <input type="email" value={form.smtpFrom} onChange={(e) => set('smtpFrom', e.target.value)}
                className={ic} disabled={readOnly} placeholder={'`"HAX Facturación" <facturacion@hax.com.do>`'} />
              <p className="text-xs text-gray-400 mt-1">Acepta formato: &quot;Nombre&quot; &lt;email@dominio.com&gt;</p>
            </F>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Guías de configuración" subtitle="Configuración para los proveedores más comunes" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          {[
            { name: 'Gmail', host: 'smtp.gmail.com', port: 587, ssl: false, note: 'Usar App Password (2FA requerido)' },
            { name: 'Outlook / Office 365', host: 'smtp.office365.com', port: 587, ssl: false, note: 'Usar contraseña de la cuenta' },
            { name: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: 587, ssl: false, note: 'Usar SMTP credentials de IAM' },
          ].map((p) => (
            <button
              key={p.name}
              type="button"
              disabled={readOnly}
              onClick={() => setForm((f: any) => ({ ...f, smtpHost: p.host, smtpPort: p.port, smtpSsl: p.ssl }))}
              className="text-left p-3 rounded-xl border border-gray-100 hover:border-[#293c4f]/30 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <p className="text-xs font-semibold text-gray-800">{p.name}</p>
              <p className="font-mono text-xs text-gray-500 mt-1">{p.host}:{p.port}</p>
              <p className="text-xs text-gray-400 mt-1">{p.note}</p>
            </button>
          ))}
        </div>
      </Card>

      {isAdmin && (
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="flex items-center gap-1.5 text-green-600 text-sm"><CheckCircle2 className="w-4 h-4" /> Guardado</span>}
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(form)}>Guardar configuración</Button>
        </div>
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function Toggle({ label, description, value, onChange, disabled }: {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors',
          value ? 'bg-[#293c4f]' : 'bg-gray-200',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-4' : 'translate-x-0'
        )} />
      </button>
    </div>
  )
}

const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f] disabled:bg-gray-50 disabled:text-gray-400'
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}

// ── PDF Templates tab ─────────────────────────────────────────

const TEMPLATE_TYPES = [
  { value: 'INVOICE',         label: 'Factura',           desc: 'Crédito fiscal y consumidor final' },
  { value: 'CREDIT_NOTE',     label: 'Nota de Crédito',   desc: 'Notas de crédito aprobadas' },
  { value: 'PAYROLL_SLIP',    label: 'Comprobante Nómina', desc: 'Recibo de pago por empleado' },
  { value: 'REPORT_PNL',      label: 'Reporte P&L',       desc: 'Estado de resultados' },
  { value: 'REPORT_BALANCE',  label: 'Balance General',   desc: 'Balance general del período' },
  { value: 'REPORT_CASHFLOW', label: 'Flujo de Caja',     desc: 'Flujo de efectivo mensual' },
]

const VARS: Record<string, { name: string; example: string }[]> = {
  INVOICE: [
    { name: '{{invoice.number}}',     example: 'INV-0001' },
    { name: '{{invoice.ncf}}',        example: 'E310000000001' },
    { name: '{{invoice.type}}',       example: 'FACTURA DE CRÉDITO FISCAL' },
    { name: '{{date invoice.issueDate}}', example: '19 de abril de 2026' },
    { name: '{{date invoice.dueDate}}',   example: '19 de mayo de 2026' },
    { name: '{{fmt invoice.subtotal}}',   example: 'RD$ 10,000.00' },
    { name: '{{fmt invoice.taxAmount}}',  example: 'RD$ 1,800.00' },
    { name: '{{fmt invoice.total}}',      example: 'RD$ 11,800.00' },
    { name: '{{client.name}}',        example: 'Empresa Ejemplo SRL' },
    { name: '{{client.rnc}}',         example: '1-31-12345-6' },
    { name: '{{client.email}}',       example: 'info@empresa.com' },
    { name: '{{client.address}}',     example: 'Av. Principal #1' },
    { name: '{{company.name}}',       example: 'HAX ESTUDIO CREATIVO EIRL' },
    { name: '{{company.rnc}}',        example: '133-290251' },
    { name: '{{#each items}}…{{/each}}', example: 'Loop de ítems' },
    { name: '{{description}}',        example: 'Dentro del loop de ítems' },
    { name: '{{fmt unitPrice}}',      example: 'Dentro del loop de ítems' },
    { name: '{{fmt total}}',          example: 'Dentro del loop de ítems' },
    { name: '{{#if isApproved}}',     example: 'Bloque condicional' },
    { name: '{{#if isCancelled}}',    example: 'Bloque condicional' },
    { name: '{{#if isPaid}}',         example: 'Bloque condicional' },
  ],
  CREDIT_NOTE: [
    { name: '{{invoice.number}}',     example: 'NC-0001' },
    { name: '{{invoice.ncf}}',        example: 'E340000000001' },
    { name: '{{originalNcf}}',        example: 'NCF de la factura original' },
    { name: '{{fmt invoice.total}}',  example: 'RD$ 5,900.00' },
    { name: '{{client.name}}',        example: 'Empresa Ejemplo SRL' },
  ],
  PAYROLL_SLIP: [
    { name: '{{employee.name}}',       example: 'Juan Pérez' },
    { name: '{{employee.position}}',   example: 'Diseñador Senior' },
    { name: '{{employee.cedula}}',     example: '001-1234567-8' },
    { name: '{{periodLabel}}',         example: 'Abril 2026' },
    { name: '{{fmt grossSalary}}',     example: 'RD$ 60,000.00' },
    { name: '{{fmt afpEmployee}}',     example: 'RD$ 1,722.00' },
    { name: '{{fmt sfsEmployee}}',     example: 'RD$ 1,824.00' },
    { name: '{{fmt isr}}',             example: 'RD$ 0.00' },
    { name: '{{fmt netSalary}}',       example: 'RD$ 56,454.00' },
    { name: '{{fmt totalDeductions}}', example: 'RD$ 3,546.00' },
    { name: '{{date payroll.paidAt}}', example: '19 de abril de 2026' },
    { name: '{{company.name}}',        example: 'HAX ESTUDIO CREATIVO EIRL' },
  ],
  REPORT_PNL: [
    { name: '{{periodLabel}}',          example: 'Abril 2026' },
    { name: '{{businessUnit}}',         example: 'HAX / Consolidado' },
    { name: '{{fmt grossRevenue}}',     example: 'RD$ 850,000.00' },
    { name: '{{fmt totalExpenses}}',    example: 'RD$ 320,000.00' },
    { name: '{{fmt netIncome}}',        example: 'RD$ 530,000.00' },
    { name: '{{fmt collectedRevenue}}', example: 'RD$ 720,000.00' },
    { name: '{{margin}}',               example: '62.4%' },
    { name: '{{company.name}}',         example: 'HAX ESTUDIO CREATIVO EIRL' },
  ],
  REPORT_BALANCE: [
    { name: '{{fmt assets.cash}}',              example: 'RD$ 450,000.00' },
    { name: '{{fmt assets.accountsReceivable}}',example: 'RD$ 180,000.00' },
    { name: '{{fmt assets.total}}',             example: 'RD$ 630,000.00' },
    { name: '{{fmt equity}}',                   example: 'RD$ 310,000.00' },
    { name: '{{generatedAt}}',                  example: '19 de abril de 2026' },
  ],
  REPORT_CASHFLOW: [
    { name: '{{periodLabel}}',         example: 'Abril 2026' },
    { name: '{{fmt totalInflows}}',    example: 'RD$ 720,000.00' },
    { name: '{{fmt totalOutflows}}',   example: 'RD$ 320,000.00' },
    { name: '{{fmt netCashFlow}}',     example: 'RD$ 400,000.00' },
    { name: '{{#each inflows}}…{{/each}}',  example: 'Loop de cobros' },
    { name: '{{#each outflows}}…{{/each}}', example: 'Loop de pagos' },
  ],
}

interface PdfTemplate { id: string; type: string; name: string; description?: string; isActive: boolean; createdAt: string }

function PdfTemplatesTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [selectedType, setSelectedType] = useState('INVOICE')
  const [showEditor, setShowEditor]     = useState(false)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', html: '' })
  const [showVars, setShowVars]         = useState(false)
  const [saving, setSaving]             = useState(false)
  const [msg, setMsg]                   = useState<{ ok: boolean; text: string } | null>(null)

  const { data: templates = [], isLoading } = useQuery<PdfTemplate[]>({
    queryKey: ['pdf-templates', selectedType],
    queryFn: async () => {
      const { data } = await api.get(`/pdf-templates?type=${selectedType}`)
      return data.data ?? []
    },
  })

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/pdf-templates/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdf-templates'] }),
  })

  const deactivate = useMutation({
    mutationFn: (type: string) => api.post(`/pdf-templates/type/${type}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdf-templates'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/pdf-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdf-templates'] }),
  })

  function startCreate() {
    setEditingId(null)
    setForm({ name: '', description: '', html: DEFAULT_HTML[selectedType] ?? '' })
    setShowEditor(true)
  }

  function startEdit(t: any) {
    setEditingId(t.id)
    setForm({ name: t.name, description: t.description ?? '', html: '' })
    // Load full html
    api.get(`/pdf-templates/${t.id}`).then(({ data }) => {
      setForm(f => ({ ...f, html: data.data?.html ?? '' }))
    })
    setShowEditor(true)
  }

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      if (editingId) {
        await api.put(`/pdf-templates/${editingId}`, form)
      } else {
        await api.post('/pdf-templates', { ...form, type: selectedType })
      }
      qc.invalidateQueries({ queryKey: ['pdf-templates'] })
      setShowEditor(false)
      setMsg({ ok: true, text: 'Plantilla guardada.' })
    } catch (e: any) {
      setMsg({ ok: false, text: e.response?.data?.error ?? 'Error al guardar' })
    } finally {
      setSaving(false) }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const html = await file.text()
    setForm(f => ({ ...f, html, name: f.name || file.name.replace('.html','') }))
    e.target.value = ''
  }

  const typeInfo = TEMPLATE_TYPES.find(t => t.value === selectedType)!
  const vars     = VARS[selectedType] ?? []
  const activeTemplate = templates.find(t => t.isActive)

  return (
    <div className="space-y-5">
      {/* Header info */}
      <Card padding="sm">
        <div className="px-4 py-3 flex items-start gap-3">
          <FileText className="w-5 h-5 text-[#293c4f] mt-0.5 shrink-0" />
          <div className="text-sm text-gray-600 leading-relaxed">
            <p className="font-semibold text-gray-800 mb-1">Plantillas HTML personalizadas</p>
            <p>Diseña tus plantillas en cualquier editor HTML (VS Code, Dreamweaver, etc.) e impórtalas aquí.
              El sistema inyecta los datos automáticamente usando variables <code className="bg-gray-100 px-1 rounded text-xs font-mono">{'{{variable}}'}</code>.
              Cuando no hay plantilla activa, se usa la plantilla integrada.</p>
          </div>
        </div>
      </Card>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      {/* Type selector */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_TYPES.map(t => (
          <button key={t.value} onClick={() => { setSelectedType(t.value); setShowEditor(false) }}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              selectedType === t.value ? 'bg-[#293c4f] text-white border-[#293c4f]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#293c4f]')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Active status for selected type */}
      <Card padding="sm">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-800 text-sm">{typeInfo.label}</p>
            <p className="text-xs text-gray-400">{typeInfo.desc}</p>
            {activeTemplate
              ? <p className="text-xs text-green-700 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Usando: <strong>{activeTemplate.name}</strong></p>
              : <p className="text-xs text-gray-400 mt-1">Usando plantilla integrada del sistema</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeTemplate && isAdmin && (
              <Button variant="secondary" size="sm"
                onClick={() => confirm('¿Desactivar y volver a la plantilla integrada?') && deactivate.mutate(selectedType)}>
                Usar integrada
              </Button>
            )}
            {isAdmin && (
              <Button variant="primary" size="sm" icon={<Upload className="w-3.5 h-3.5" />} onClick={startCreate}>
                Nueva plantilla
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Template list */}
      {isLoading ? (
        <div className="text-sm text-gray-400 px-1">Cargando…</div>
      ) : templates.length === 0 ? (
        <div className="text-sm text-gray-400 px-1 py-4 text-center border border-dashed border-gray-200 rounded-xl">
          No hay plantillas para este tipo. Crea una con el botón de arriba.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <Card key={t.id} padding="sm">
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', t.isActive ? 'bg-green-500' : 'bg-gray-300')} />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{t.name}</p>
                    {t.description && <p className="text-xs text-gray-400 truncate">{t.description}</p>}
                  </div>
                  {t.isActive && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">Activa</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button title="Vista previa PDF"
                    className="p-1.5 text-gray-400 hover:text-[#293c4f] rounded"
                    onClick={() => openPdf(`/pdf-templates/${t.id}/preview`, `preview-${t.name}.pdf`)}>
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin && (
                    <>
                      <button title="Editar" className="p-1.5 text-gray-400 hover:text-[#293c4f] rounded"
                        onClick={() => startEdit(t)}>
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      {!t.isActive && (
                        <button title="Activar" className="p-1.5 text-gray-400 hover:text-green-600 rounded"
                          onClick={() => activate.mutate(t.id)}>
                          <ToggleLeft className="w-4 h-4" />
                        </button>
                      )}
                      {t.isActive && (
                        <span title="Activa" className="p-1.5 text-green-600">
                          <ToggleRight className="w-4 h-4" />
                        </span>
                      )}
                      {!t.isActive && (
                        <button title="Eliminar" className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                          onClick={() => confirm(`¿Eliminar "${t.name}"?`) && remove.mutate(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Editor panel */}
      {showEditor && isAdmin && (
        <Card padding="sm">
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800 text-sm">
                {editingId ? 'Editar plantilla' : `Nueva plantilla — ${typeInfo.label}`}
              </p>
              <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600 text-xs">Cerrar</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <F label="Nombre de la plantilla">
                <input className={ic} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Plantilla corporativa 2026" />
              </F>
              <F label="Descripción (opcional)">
                <input className={ic} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descripción" />
              </F>
            </div>

            {/* File upload */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#293c4f] hover:text-[#293c4f] text-gray-500 transition-colors">
                <Upload className="w-4 h-4" />
                Cargar archivo .html
                <input type="file" accept=".html,.htm" className="hidden" onChange={handleFileUpload} />
              </label>
              <span className="text-xs text-gray-400">o escribe/pega el HTML directamente abajo</span>
            </div>

            {/* Variables reference */}
            <div className="border border-gray-200 rounded-lg">
              <button className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg"
                onClick={() => setShowVars(v => !v)}>
                <span>Variables disponibles para <strong>{typeInfo.label}</strong></span>
                {showVars ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showVars && (
                <div className="px-3 pb-3 grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
                  {vars.map(v => (
                    <div key={v.name} className="flex items-start gap-2 group">
                      <button title="Copiar" onClick={() => navigator.clipboard.writeText(v.name)}
                        className="shrink-0 mt-0.5 text-gray-300 hover:text-[#293c4f]">
                        <Copy className="w-3 h-3" />
                      </button>
                      <div className="min-w-0">
                        <code className="text-xs font-mono text-[#293c4f] break-all">{v.name}</code>
                        <p className="text-xs text-gray-400 truncate">{v.example}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* HTML editor */}
            <F label="HTML de la plantilla">
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#293c4f] resize-y"
                rows={22}
                value={form.html}
                onChange={e => setForm(f => ({ ...f, html: e.target.value }))}
                placeholder={`<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <style>\n    /* Tus estilos aquí */\n  </style>\n</head>\n<body>\n  <h1>{{company.name}}</h1>\n  <p>Factura: {{invoice.number}}</p>\n  <!-- ... -->\n</body>\n</html>`}
                spellCheck={false}
              />
            </F>

            <div className="flex items-center gap-2 pt-1">
              <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
                {editingId ? 'Guardar cambios' : 'Crear plantilla'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowEditor(false)}>Cancelar</Button>
              <span className="text-xs text-gray-400 ml-2">El sistema valida la sintaxis Handlebars al guardar.</span>
            </div>
          </div>
        </Card>
      )}

      {/* Variables legend always visible */}
      {!showEditor && (
        <Card padding="sm">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">Variables disponibles — {typeInfo.label}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
              {vars.slice(0, 18).map(v => (
                <div key={v.name} className="flex items-start gap-1.5">
                  <button title="Copiar" onClick={() => navigator.clipboard.writeText(v.name)}
                    className="shrink-0 mt-0.5 text-gray-300 hover:text-[#293c4f]">
                    <Copy className="w-3 h-3" />
                  </button>
                  <div className="min-w-0">
                    <code className="text-xs font-mono text-[#293c4f] break-all">{v.name}</code>
                    <p className="text-xs text-gray-400 truncate">{v.example}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Default HTML starters per type ────────────────────────────

const DEFAULT_HTML: Record<string, string> = {
  INVOICE: `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size:12px; color:#222; padding:40px; }
  .header { background:#293c4f; color:#fff; padding:24px 30px; display:flex; justify-content:space-between; align-items:flex-start; margin:-40px -40px 30px; }
  .header h1 { font-size:18px; font-weight:bold; }
  .header .meta { text-align:right; }
  .header .meta .num { font-size:16px; font-weight:bold; }
  .ncf-bar { background:#f0f2f4; padding:8px 0; display:flex; gap:20px; margin-bottom:20px; }
  .ncf-bar span { font-size:11px; color:#555; }
  .ncf-bar strong { color:#293c4f; }
  .bill-to { margin-bottom:20px; }
  .bill-to .label { font-size:10px; color:#888; font-weight:bold; margin-bottom:4px; }
  .bill-to .name { font-size:14px; font-weight:bold; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  thead tr { background:#293c4f; color:#fff; }
  thead th { padding:8px 10px; text-align:left; font-size:11px; }
  tbody tr:nth-child(even) { background:#f8f9fa; }
  tbody td { padding:8px 10px; font-size:11px; }
  .totals { float:right; width:260px; }
  .totals tr td { padding:5px 8px; }
  .totals .total-row td { background:#293c4f; color:#fff; font-weight:bold; font-size:14px; }
  .footer { position:fixed; bottom:0; left:0; right:0; background:#293c4f; color:rgba(255,255,255,0.7); font-size:10px; padding:10px 40px; display:flex; justify-content:space-between; }
  .legend { font-size:10px; color:#888; margin-top:30px; }
  .watermark { position:fixed; top:40%; left:10%; transform:rotate(35deg); font-size:80px; font-weight:bold; opacity:0.07; color:#c00; pointer-events:none; }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>{{company.name}}</h1>
    <div style="font-size:11px;opacity:0.8;">RNC: {{company.rnc}}</div>
    <div style="font-size:11px;opacity:0.8;">Santo Domingo, República Dominicana</div>
  </div>
  <div class="meta">
    <div>{{invoice.type}}</div>
    <div class="num">N° {{invoice.number}}</div>
    <div style="font-size:11px;opacity:0.8;">{{invoice.businessUnit}}</div>
  </div>
</div>

<div class="ncf-bar">
  <span><strong>e-CF:</strong> {{invoice.ncf}}</span>
  <span><strong>Emisión:</strong> {{date invoice.issueDate}}</span>
  {{#if invoice.dueDate}}<span><strong>Vence:</strong> {{date invoice.dueDate}}</span>{{/if}}
</div>

<div class="bill-to">
  <div class="label">FACTURAR A</div>
  <div class="name">{{client.name}}</div>
  {{#if client.rnc}}<div style="color:#555;">RNC / Cédula: {{client.rnc}}</div>{{/if}}
  {{#if client.email}}<div style="color:#555;">{{client.email}}</div>{{/if}}
  {{#if client.address}}<div style="color:#555;">{{client.address}}</div>{{/if}}
</div>

<table>
  <thead>
    <tr>
      <th>Descripción</th>
      <th style="width:60px;text-align:center;">Cant.</th>
      <th style="width:100px;text-align:right;">Precio Unit.</th>
      <th style="width:90px;text-align:right;">ITBIS</th>
      <th style="width:100px;text-align:right;">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{description}}</td>
      <td style="text-align:center;">{{quantity}}</td>
      <td style="text-align:right;">{{fmt unitPrice}}</td>
      <td style="text-align:right;">{{#if isExempt}}Exento{{else}}{{fmt taxAmount}}{{/if}}</td>
      <td style="text-align:right;font-weight:bold;">{{fmt total}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<table class="totals">
  <tr><td>Subtotal:</td><td style="text-align:right;">{{fmt invoice.subtotal}}</td></tr>
  <tr><td>ITBIS (18%):</td><td style="text-align:right;">{{fmt invoice.taxAmount}}</td></tr>
  <tr class="total-row"><td>TOTAL:</td><td style="text-align:right;">{{fmt invoice.total}}</td></tr>
</table>

{{#if invoice.notes}}
<div style="clear:both;margin-top:20px;">
  <div style="font-size:10px;font-weight:bold;color:#888;">NOTAS</div>
  <div style="font-size:11px;color:#555;">{{invoice.notes}}</div>
</div>
{{/if}}

{{#if isCancelled}}<div class="watermark">ANULADA</div>{{/if}}
{{#if isPaid}}<div class="watermark" style="color:#1a7a1a;">PAGADA</div>{{/if}}

<div class="legend">Este documento es una representación impresa del e-CF emitido ante la DGII. Conservar por 10 años.</div>

<div class="footer">
  <span>{{company.name}} · RNC: {{company.rnc}}</span>
  <span>Generado: {{generatedAt}}</span>
</div>
</body>
</html>`,

  PAYROLL_SLIP: `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size:12px; color:#222; padding:40px; max-width:700px; margin:0 auto; }
  .header { background:#293c4f; color:#fff; padding:20px 30px; margin:-40px -40px 30px; display:flex; justify-content:space-between; }
  .header h1 { font-size:16px; font-weight:bold; }
  .employee-name { font-size:20px; font-weight:bold; margin-bottom:4px; }
  .row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f0f0f0; }
  .row .label { color:#666; }
  .row .value { font-weight:bold; }
  .net { background:#293c4f; color:#fff; padding:12px 16px; display:flex; justify-content:space-between; font-size:16px; font-weight:bold; margin:20px 0; border-radius:8px; }
  .section-title { font-size:11px; font-weight:bold; color:#293c4f; text-transform:uppercase; margin:16px 0 8px; }
  .footer { margin-top:40px; font-size:10px; color:#888; text-align:center; }
</style>
</head>
<body>
<div class="header">
  <div><h1>{{company.name}}</h1><div style="opacity:0.8;font-size:11px;">RNC: {{company.rnc}}</div></div>
  <div style="text-align:right;"><div>COMPROBANTE DE NÓMINA</div><div style="font-size:14px;font-weight:bold;">{{periodLabel}}</div></div>
</div>

<div class="employee-name">{{employee.name}}</div>
{{#if employee.position}}<div style="color:#666;margin-bottom:16px;">{{employee.position}}</div>{{/if}}
{{#if employee.cedula}}<div style="color:#888;font-size:11px;margin-bottom:20px;">Cédula: {{employee.cedula}}</div>{{/if}}

<div class="section-title">Ingresos</div>
<div class="row"><span class="label">Salario bruto</span><span class="value">{{fmt grossSalary}}</span></div>

<div class="section-title">Deducciones</div>
<div class="row"><span class="label">AFP (empleado 2.87%)</span><span class="value">({{fmt afpEmployee}})</span></div>
<div class="row"><span class="label">SFS (empleado 3.04%)</span><span class="value">({{fmt sfsEmployee}})</span></div>
{{#if isr}}<div class="row"><span class="label">ISR retenido</span><span class="value">({{fmt isr}})</span></div>{{/if}}
<div class="row" style="font-weight:bold;"><span>Total deducciones</span><span>({{fmt totalDeductions}})</span></div>

<div class="net">
  <span>SALARIO NETO A PAGAR</span>
  <span>{{fmt netSalary}}</span>
</div>

{{#if payroll.paidAt}}<div style="font-size:11px;color:#555;">Fecha de pago: {{date payroll.paidAt}}</div>{{/if}}

<div class="footer">
  Comprobante generado el {{generatedAt}} · Este documento no tiene valor fiscal.
</div>
</body>
</html>`,
}
