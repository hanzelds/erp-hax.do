'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Users, Building2 } from 'lucide-react'
import api from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, CardHeader } from '@/components/ui'
import { useAuthStore } from '@/lib/auth-store'

const TABS = ['Empresa', 'Usuarios'] as const
type Tab = typeof TABS[number]

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('Empresa')

  return (
    <div className="space-y-5">
      <PageHeader title="Configuración" subtitle="Ajustes del sistema" />

      <div className="flex items-center gap-1 border-b border-gray-100">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px', tab === t ? 'border-[#293c4f] text-[#293c4f]' : 'border-transparent text-gray-500 hover:text-gray-700')}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Empresa' && <CompanyTab />}
      {tab === 'Usuarios' && <UsersTab />}
    </div>
  )
}

function CompanyTab() {
  return (
    <Card>
      <CardHeader title="Información de la empresa" />
      <div className="space-y-3 text-sm">
        <Row label="Nombre" value="HAX ESTUDIO CREATIVO EIRL" />
        <Row label="RNC" value="133290251" />
        <Row label="Dominio" value="erp.hax.com.do" />
        <Row label="Unidades de negocio" value="HAX · KODER" />
      </div>
    </Card>
  )
}

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
      <div className="px-1 pt-1 pb-3 flex items-center justify-between">
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive.mutate({ id: u.id, isActive: u.isActive })}
                  >
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="font-medium text-gray-800 text-xs">{value}</span>
    </div>
  )
}
