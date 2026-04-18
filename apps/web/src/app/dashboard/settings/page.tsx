'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, CardHeader } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

const TABS = ['Empresa', 'Usuarios', 'Facturación e-CF'] as const
type Tab = typeof TABS[number]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('Empresa')
  const { user } = useAuthStore()

  return (
    <div className="space-y-5">
      <PageHeader title="Configuración" subtitle="Ajustes del sistema" />

      <div className="flex items-center gap-1 border-b border-gray-100">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t ? 'border-[#293c4f] text-[#293c4f]' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Empresa'           && <CompanyTab isAdmin={user?.role === 'ADMIN'} />}
      {tab === 'Usuarios'          && <UsersTab />}
      {tab === 'Facturación e-CF'  && <EcfTab isAdmin={user?.role === 'ADMIN'} />}
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
