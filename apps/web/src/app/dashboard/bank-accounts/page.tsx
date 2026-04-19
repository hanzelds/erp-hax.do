'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, ArrowUpCircle, ArrowDownCircle, Landmark, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, Button, Card, StatCard, Skeleton, EmptyState } from '@/components/ui'

interface BankAccount {
  id: string
  name: string
  accountNumber: string | null
  bank: string | null
  currency: string
  balance: number
  businessUnit?: 'HAX' | 'KODER' | null
  isActive: boolean
}

interface BankTransaction {
  id: string
  type: 'CREDIT' | 'DEBIT'
  amount: number
  description: string
  balance: number
  date: string
  reference: string | null
}

interface AddTxBody {
  type: 'CREDIT' | 'DEBIT'
  amount: number
  description: string
  reference?: string
  date: string
}

const EMPTY_ACCT = { name: '', accountNumber: '', bank: '', currency: 'DOP' }
const EMPTY_TX: AddTxBody = { type: 'CREDIT', amount: 0, description: '', reference: '', date: new Date().toISOString().slice(0, 10) }

export default function BankAccountsPage() {
  const qc = useQueryClient()
  const [selected, setSelected]     = useState<BankAccount | null>(null)
  const [newAcct, setNewAcct]       = useState<any | null>(null)
  const [addTx, setAddTx]           = useState<AddTxBody | null>(null)

  const { data: accounts = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/bank-accounts')
      return data.data ?? data
    },
  })

  const { data: transactions = [] } = useQuery<BankTransaction[]>({
    queryKey: ['bank-transactions', selected?.id],
    queryFn: async () => {
      const { data } = await api.get(`/bank-accounts/${selected!.id}/transactions`)
      return data.data ?? data
    },
    enabled: !!selected,
  })

  const saveAcct = useMutation({
    mutationFn: async (body: any) => api.post('/bank-accounts', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bank-accounts'] }); setNewAcct(null) },
  })

  const saveTx = useMutation({
    mutationFn: async (body: AddTxBody) => api.post(`/bank-accounts/${selected!.id}/transactions`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-accounts'] })
      qc.invalidateQueries({ queryKey: ['bank-transactions', selected?.id] })
      setAddTx(null)
    },
  })

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cuentas Bancarias"
        subtitle="Gestión de cuentas y transacciones"
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setNewAcct({ ...EMPTY_ACCT })}>
            Nueva cuenta
          </Button>
        }
      />

      {/* Summary */}
      {!isLoading && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Balance total" value={formatCurrency(totalBalance)} icon={<Landmark className="w-4 h-4" />} accent="#293c4f" />
          <StatCard label="Cuentas activas" value={accounts.filter((a) => a.isActive).length.toString()} accent="#293c4f" />
        </div>
      )}

      {/* Accounts grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState icon={<Landmark className="w-5 h-5" />} title="No hay cuentas bancarias" description="Agrega tus cuentas bancarias para hacer seguimiento de tu liquidez." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left hover:border-[#293c4f]/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{a.name}</p>
                  {a.bank && <p className="text-xs text-gray-500 mt-0.5">{a.bank}</p>}
                  {a.accountNumber && <p className="font-mono text-xs text-gray-400">{a.accountNumber}</p>}
                </div>
                {a.businessUnit && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={a.businessUnit === 'HAX' ? { backgroundColor: '#eef1f4', color: '#293c4f' } : { backgroundColor: '#f1f5f9', color: '#475569' }}>
                    {a.businessUnit}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-xs text-gray-400">Balance</p>
                <p className={cn('text-xl font-bold', a.balance >= 0 ? 'text-gray-900' : 'text-red-500')}>
                  {formatCurrency(a.balance)}
                </p>
                <p className="text-xs text-gray-400">{a.currency}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Transactions slide-over */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setSelected(null)} />
          <div className="w-full max-w-lg bg-white shadow-2xl overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{selected.name}</p>
                <p className="text-sm font-bold" style={{ color: '#293c4f' }}>{formatCurrency(selected.balance)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAddTx({ ...EMPTY_TX })}>
                  Transacción
                </Button>
                <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
            </div>
            <div className="flex-1 p-6">
              {transactions.length === 0 ? (
                <EmptyState title="No hay transacciones" description="Registra la primera transacción." />
              ) : (
                <div className="space-y-2">
                  {transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-3 border-b border-gray-50">
                      <div className="flex items-center gap-3">
                        {t.type === 'CREDIT'
                          ? <ArrowUpCircle className="w-4 h-4 text-green-500 shrink-0" />
                          : <ArrowDownCircle className="w-4 h-4 text-red-400 shrink-0" />
                        }
                        <div>
                          <p className="text-xs font-medium text-gray-800">{t.description}</p>
                          <p className="text-xs text-gray-400">{formatDate(t.date)}{t.reference ? ` · ${t.reference}` : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-xs font-semibold', t.type === 'CREDIT' ? 'text-green-600' : 'text-red-500')}>
                          {t.type === 'CREDIT' ? '+' : '-'}{formatCurrency(t.amount)}
                        </p>
                        <p className="text-xs text-gray-400">{formatCurrency(t.balance)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add transaction modal */}
      {addTx && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">Nueva transacción</h2>
              <button onClick={() => setAddTx(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <F label="Tipo">
                <select value={addTx.type} onChange={(e) => setAddTx({ ...addTx, type: e.target.value as 'CREDIT' | 'DEBIT' })} className={ic}>
                  <option value="CREDIT">Crédito (entrada)</option>
                  <option value="DEBIT">Débito (salida)</option>
                </select>
              </F>
              <F label="Monto (DOP) *"><input type="number" min="0" step="0.01" value={addTx.amount} onChange={(e) => setAddTx({ ...addTx, amount: parseFloat(e.target.value) || 0 })} className={ic} /></F>
              <F label="Descripción *"><input type="text" value={addTx.description} onChange={(e) => setAddTx({ ...addTx, description: e.target.value })} className={ic} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Fecha"><input type="date" value={addTx.date} onChange={(e) => setAddTx({ ...addTx, date: e.target.value })} className={ic} /></F>
                <F label="Referencia"><input type="text" value={addTx.reference ?? ''} onChange={(e) => setAddTx({ ...addTx, reference: e.target.value })} className={ic} /></F>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setAddTx(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" loading={saveTx.isPending} onClick={() => saveTx.mutate(addTx)}>Registrar</Button>
            </div>
          </div>
        </div>
      )}

      {/* New account modal */}
      {newAcct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">Nueva cuenta bancaria</h2>
              <button onClick={() => setNewAcct(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <F label="Nombre de la cuenta *"><input type="text" value={newAcct.name} onChange={(e) => setNewAcct({ ...newAcct, name: e.target.value })} className={ic} /></F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Banco"><input type="text" value={newAcct.bank} onChange={(e) => setNewAcct({ ...newAcct, bank: e.target.value })} className={ic} /></F>
                <F label="Número de cuenta"><input type="text" value={newAcct.accountNumber} onChange={(e) => setNewAcct({ ...newAcct, accountNumber: e.target.value })} className={ic} /></F>
              </div>
              <F label="Moneda"><select value={newAcct.currency} onChange={(e) => setNewAcct({ ...newAcct, currency: e.target.value })} className={ic}><option value="DOP">DOP</option><option value="USD">USD</option></select></F>
              <F label="Balance inicial (DOP)"><input type="number" min="0" step="0.01" defaultValue={0} onChange={(e) => setNewAcct({ ...newAcct, initialBalance: parseFloat(e.target.value) || 0 })} className={ic} /></F>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="sm" onClick={() => setNewAcct(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" loading={saveAcct.isPending} onClick={() => saveAcct.mutate(newAcct)}>Crear</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f]'
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}
