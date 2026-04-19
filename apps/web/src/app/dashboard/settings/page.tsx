'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, CardHeader } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

const TABS = ['Empresa', 'Usuarios', 'Facturación e-CF', 'Facturación General', 'Presupuestos', 'Activos Fijos', 'Nómina', 'Cuentas Contables', 'Correo'] as const
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
      return data
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
