'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Button, Card, CardHeader } from '@/components/ui'

interface Client { id: string; name: string; rnc: string | null }
interface Product { id: string; name: string; price: number; taxRate: number; isExempt: boolean }

interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  isExempt: boolean
}

function calcLine(item: LineItem) {
  const subtotal  = item.quantity * item.unitPrice
  const taxAmount = item.isExempt ? 0 : subtotal * (item.taxRate / 100)
  return { subtotal, taxAmount, total: subtotal + taxAmount }
}

export default function NewInvoicePage() {
  const router = useRouter()

  const [form, setForm] = useState({
    clientId: '',
    businessUnit: 'HAX' as 'HAX' | 'KODER',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    ncfType: 'B01',
    notes: '',
  })

  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, taxRate: 18, isExempt: false },
  ])

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: async () => {
      const { data } = await api.get('/clients', { params: { limit: 200 } })
      return data.data ?? data
    },
  })

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-list'],
    queryFn: async () => {
      const { data } = await api.get('/products', { params: { limit: 200, isActive: true } })
      return data.data ?? data
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/invoices', {
        ...form,
        dueDate: form.dueDate || undefined,
        items: items.map((i) => ({ ...i })),
      })
      return data
    },
    onSuccess: (data) => router.push(`/dashboard/invoices/${data.id}`),
  })

  // Totals
  const lines     = items.map(calcLine)
  const subtotal  = lines.reduce((s, l) => s + l.subtotal, 0)
  const taxAmount = lines.reduce((s, l) => s + l.taxAmount, 0)
  const total     = subtotal + taxAmount

  function addItem() {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, taxRate: 18, isExempt: false }])
  }

  function removeItem(i: number) {
    if (items.length === 1) return
    setItems(items.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems(items.map((item, idx) => idx === i ? { ...item, ...patch } : item))
  }

  function applyProduct(i: number, p: Product) {
    updateItem(i, { description: p.name, unitPrice: p.price, taxRate: p.taxRate, isExempt: p.isExempt })
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/invoices">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Facturas
          </Button>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-600 text-sm">Nueva factura</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Main form */}
        <div className="xl:col-span-2 space-y-4">
          {/* Header info */}
          <Card>
            <CardHeader title="Datos de la factura" />
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <F label="Cliente *">
                  <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={ic}>
                    <option value="">Selecciona un cliente…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.rnc ? ` · ${c.rnc}` : ''}</option>
                    ))}
                  </select>
                </F>
              </div>
              <F label="Unidad de negocio">
                <select value={form.businessUnit} onChange={(e) => setForm({ ...form, businessUnit: e.target.value as 'HAX' | 'KODER' })} className={ic}>
                  <option value="HAX">HAX</option>
                  <option value="KODER">KODER</option>
                </select>
              </F>
              <F label="Tipo NCF">
                <select value={form.ncfType} onChange={(e) => setForm({ ...form, ncfType: e.target.value })} className={ic}>
                  <option value="B01">B01 - Crédito fiscal</option>
                  <option value="B02">B02 - Consumidor final</option>
                  <option value="B14">B14 - Regímenes especiales</option>
                  <option value="B15">B15 - Gubernamental</option>
                </select>
              </F>
              <F label="Fecha de emisión *">
                <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className={ic} />
              </F>
              <F label="Fecha de vencimiento">
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={ic} />
              </F>
            </div>
          </Card>

          {/* Line items */}
          <Card padding="sm">
            <div className="flex items-center justify-between px-1 pt-1 pb-3">
              <h3 className="font-semibold text-gray-900 text-sm">Ítems</h3>
              <Button variant="ghost" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addItem}>
                Agregar ítem
              </Button>
            </div>

            {/* Product quick-select */}
            {products.length > 0 && (
              <div className="px-1 mb-3">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const p = products.find((pr) => pr.id === e.target.value)
                    if (p) applyProduct(items.length - 1, p)
                    e.target.value = ''
                  }}
                  className="text-sm border border-dashed border-gray-300 rounded-lg px-3 py-1.5 text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#293c4f] w-full"
                >
                  <option value="">+ Agregar desde catálogo de productos…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              {items.map((item, i) => {
                const { subtotal: lineSubtotal, taxAmount: lineTax, total: lineTotal } = calcLine(item)
                return (
                  <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Descripción del servicio/producto…"
                        value={item.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        className={`flex-1 ${ic}`}
                      />
                      {items.length > 1 && (
                        <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <F label="Cantidad">
                        <input type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateItem(i, { quantity: parseInt(e.target.value) || 1 })} className={ic} />
                      </F>
                      <F label="Precio unit. (DOP)">
                        <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, { unitPrice: parseFloat(e.target.value) || 0 })} className={ic} />
                      </F>
                      <F label="ITBIS">
                        <select value={item.isExempt ? 'exempt' : item.taxRate} onChange={(e) => {
                          if (e.target.value === 'exempt') updateItem(i, { isExempt: true, taxRate: 0 })
                          else updateItem(i, { isExempt: false, taxRate: parseInt(e.target.value) })
                        }} className={ic}>
                          <option value="exempt">Exento</option>
                          <option value="18">18%</option>
                          <option value="16">16%</option>
                        </select>
                      </F>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Total línea</p>
                        <p className="text-sm font-semibold text-gray-800 py-2">{formatCurrency(lineTotal)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <F label="Notas internas (opcional)">
              <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={ic} placeholder="Términos de pago, instrucciones, etc." />
            </F>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Resumen" />
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>ITBIS</span><span>{formatCurrency(taxAmount)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <Button
                variant="primary"
                className="w-full"
                loading={create.isPending}
                disabled={!form.clientId || items.some((i) => !i.description)}
                onClick={() => create.mutate()}
              >
                Emitir factura
              </Button>
              <Link href="/dashboard/invoices">
                <Button variant="secondary" className="w-full">Cancelar</Button>
              </Link>
            </div>
            {create.isError && (
              <p className="text-xs text-red-500 mt-2">
                {(create.error as any)?.response?.data?.error ?? 'Error al crear la factura'}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

const ic = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#293c4f]'
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>{children}</div>
}
