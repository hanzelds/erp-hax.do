'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, UserPlus, PackagePlus } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Button, Card, CardHeader } from '@/components/ui'
import NewContactPage from '@/components/NewContactPage'

interface Client { id: string; name: string; rnc: string | null }
// API stores taxRate as decimal (0.18), unitPrice as number
interface Product { id: string; name: string; unitPrice: number; taxRate: number; isExempt: boolean }

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
  const qc     = useQueryClient()

  const [showNewClient, setShowNewClient]   = useState(false)
  const [showNewProduct, setShowNewProduct] = useState(false)

  const [form, setForm] = useState({
    clientId: '',
    businessUnit: 'HAX' as 'HAX' | 'KODER',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    ncfType: 'E31',
    paymentTerms: 'NET_30',
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

  const [catalogPrompt, setCatalogPrompt] = useState<LineItem[]>([])
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null)

  // ── Initial payment (abono) state ──────────────────────────
  const [payEnabled, setPayEnabled] = useState(false)
  const [payAmount, setPayAmount]   = useState('')
  const [payMethod, setPayMethod]   = useState('TRANSFER')
  const [payRef, setPayRef]         = useState('')
  const [payDate, setPayDate]       = useState(new Date().toISOString().slice(0, 10))

  const create = useMutation({
    mutationFn: async () => {
      const resolvedItems = items.map((i) => {
        const base = isExemptType ? { ...i, isExempt: true, taxRate: 0 } : i
        const subtotal  = base.quantity * base.unitPrice
        const taxAmount = base.isExempt ? 0 : subtotal * (base.taxRate / 100)
        return { ...base, subtotal, taxAmount, total: subtotal + taxAmount }
      })
      const { data: invoiceResp } = await api.post('/invoices', {
        ...form,
        issueDate: form.issueDate || undefined,
        dueDate:   form.dueDate   || undefined,
        items: resolvedItems,
      })
      const invoiceId = invoiceResp.data?.id ?? invoiceResp.id

      // Register initial payment if enabled
      if (payEnabled && parseFloat(payAmount) > 0) {
        await api.post(`/invoices/${invoiceId}/payments`, {
          amount:    parseFloat(payAmount),
          method:    payMethod,
          reference: payRef || undefined,
          paidAt:    payDate || undefined,
          notes:     'Pago inicial al crear factura',
        })
      }
      return invoiceResp
    },
    onSuccess: (data) => {
      const invoiceId = data.data?.id ?? data.id
      // Check for items not in catalog
      const existingNames = new Set(products.map(p => p.name.toLowerCase().trim()))
      const newItems = items.filter(i => i.description.trim() && !existingNames.has(i.description.toLowerCase().trim()))
      if (newItems.length > 0) {
        setCatalogPrompt(newItems)
        setPendingInvoiceId(invoiceId)
      } else {
        router.push(`/dashboard/invoices/${invoiceId}`)
      }
    },
  })

  const isProforma   = form.ncfType === 'PROFORMA'
  const isExemptType = ['E44', 'E45', 'E46', 'E47', 'PROFORMA'].includes(form.ncfType)

  // Exempt types (44 Régimen Especial, 45 Gubernamental, 46 Exportaciones, 47 Pagos Exterior) force ITBIS exento
  const lines     = items.map(i => calcLine(isExemptType ? { ...i, isExempt: true, taxRate: 0 } : i))
  const subtotal  = lines.reduce((s, l) => s + l.subtotal, 0)
  const taxAmount = lines.reduce((s, l) => s + l.taxAmount, 0)
  const total     = subtotal + taxAmount

  function addItem() {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, taxRate: 18, isExempt: isExemptType }])
  }

  function removeItem(i: number) {
    if (items.length === 1) return
    setItems(items.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems(items.map((item, idx) => idx === i ? { ...item, ...patch } : item))
  }

  function applyProduct(i: number, p: Product) {
    // API taxRate is decimal (0.18) — LineItem.taxRate is percentage (18)
    updateItem(i, {
      description: p.name,
      unitPrice:   p.unitPrice,
      taxRate:     p.isExempt ? 0 : Math.round(p.taxRate * 100),
      isExempt:    p.isExempt,
    })
  }

  // ── Catalog confirmation popup ────────────────────────────────
  if (catalogPrompt.length > 0 && pendingInvoiceId) {
    return (
      <CatalogConfirmModal
        items={catalogPrompt}
        onDone={() => router.push(`/dashboard/invoices/${pendingInvoiceId}`)}
      />
    )
  }

  // ── Full-page new client view ────────────────────────────────
  if (showNewClient) {
    return (
      <NewContactPage
        mode="cliente"
        onCreated={(contact) => {
          qc.invalidateQueries({ queryKey: ['clients-list'] })
          setForm(f => ({ ...f, clientId: contact.id }))
          setShowNewClient(false)
        }}
        onBack={() => setShowNewClient(false)}
      />
    )
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
                  <div className="flex gap-2">
                    <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={ic + ' flex-1'}>
                      <option value="">Selecciona un cliente…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.rnc ? ` · ${c.rnc}` : ''}</option>
                      ))}
                    </select>
                    <button type="button" title="Nuevo cliente"
                      onClick={() => setShowNewClient(true)}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#293c4f] border border-[#293c4f] rounded-lg hover:bg-[#293c4f] hover:text-white transition-colors">
                      <UserPlus className="w-3.5 h-3.5" />
                      Nuevo
                    </button>
                  </div>
                </F>
              </div>
              <F label="Unidad de negocio">
                <select value={form.businessUnit} onChange={(e) => setForm({ ...form, businessUnit: e.target.value as 'HAX' | 'KODER' })} className={ic}>
                  <option value="HAX">HAX</option>
                  <option value="KODER">KODER</option>
                </select>
              </F>
              <F label="Tipo de documento">
                <select value={form.ncfType} onChange={(e) => setForm({ ...form, ncfType: e.target.value })} className={ic}>
                  <optgroup label="Fiscal (e-CF DGII)">
                    <option value="E31">31 — Factura Crédito Fiscal</option>
                    <option value="E32">32 — Factura Consumo</option>
                    <option value="E33">33 — Nota de Débito</option>
                    <option value="E34">34 — Nota de Crédito</option>
                    <option value="E41">41 — Comprobante de Compras</option>
                    <option value="E43">43 — Gastos Menores</option>
                    <option value="E44">44 — Regímenes Especiales (ITBIS exento)</option>
                    <option value="E45">45 — Gubernamental (ITBIS exento)</option>
                    <option value="E46">46 — Exportaciones (ITBIS exento)</option>
                    <option value="E47">47 — Pagos al Exterior (ITBIS exento)</option>
                  </optgroup>
                  <optgroup label="No fiscal">
                    <option value="PROFORMA">Proforma — Cotización sin efecto fiscal</option>
                  </optgroup>
                </select>
                {form.ncfType === 'PROFORMA' && (
                  <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                    <span>ℹ</span> Proforma: sin ITBIS · no reporta a DGII · no genera asientos contables
                  </p>
                )}
                {isExemptType && form.ncfType !== 'PROFORMA' && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <span>⚠</span> Tipo {form.ncfType.replace('E','')} — ITBIS exento en todos los ítems
                  </p>
                )}
              </F>
              <F label="Fecha de emisión *">
                <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className={ic} />
              </F>
              <F label="Condiciones de pago">
                <select value={form.paymentTerms} onChange={(e) => {
                  const terms = e.target.value
                  // Auto-calculate dueDate from issueDate + days
                  const dueDays: Record<string, number> = { NET_15: 15, NET_30: 30, NET_45: 45, NET_60: 60, NET_90: 90 }
                  const days = dueDays[terms]
                  const newDue = days && form.issueDate
                    ? new Date(new Date(form.issueDate).getTime() + days * 86400000).toISOString().slice(0, 10)
                    : form.dueDate
                  setForm({ ...form, paymentTerms: terms, dueDate: newDue || form.dueDate })
                }} className={ic}>
                  <option value="CONTADO">Contado (pago inmediato)</option>
                  <option value="NET_7">Net 7 — 7 días</option>
                  <option value="NET_15">Net 15 — 15 días</option>
                  <option value="NET_30">Net 30 — 30 días</option>
                  <option value="NET_45">Net 45 — 45 días</option>
                  <option value="NET_60">Net 60 — 60 días</option>
                  <option value="NET_90">Net 90 — 90 días</option>
                  <option value="ANTICIPADO">Pago anticipado</option>
                  <option value="PARCIAL">Pago parcial acordado</option>
                </select>
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
              <div className="flex items-center gap-2">
                <button type="button" title="Nuevo producto"
                  onClick={() => setShowNewProduct(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-[#293c4f] hover:text-[#293c4f] transition-colors">
                  <PackagePlus className="w-3.5 h-3.5" />
                  Nuevo producto
                </button>
                <Button variant="ghost" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={addItem}>
                  Agregar ítem
                </Button>
              </div>
            </div>

            {showNewProduct && (
              <div className="px-1 mb-3">
                <QuickCreateProduct
                  onCreated={(p) => {
                    qc.invalidateQueries({ queryKey: ['products-list'] })
                    addItem()
                    applyProduct(items.length, p)
                    setShowNewProduct(false)
                  }}
                  onClose={() => setShowNewProduct(false)}
                />
              </div>
            )}

            {/* Product quick-select */}
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
                  <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.unitPrice)}</option>
                ))}
              </select>
            </div>

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
                        {isExemptType ? (
                          <div className={`${ic} bg-amber-50 text-amber-700 font-medium cursor-not-allowed`}>
                            Exento (e-CF {form.ncfType.replace('E','')})
                          </div>
                        ) : (
                          <select value={item.isExempt ? 'exempt' : item.taxRate} onChange={(e) => {
                            if (e.target.value === 'exempt') updateItem(i, { isExempt: true, taxRate: 0 })
                            else updateItem(i, { isExempt: false, taxRate: parseInt(e.target.value) })
                          }} className={ic}>
                            <option value="exempt">Exento</option>
                            <option value="18">18%</option>
                            <option value="16">16%</option>
                          </select>
                        )}
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

          {/* Initial payment / abono */}
          <Card padding="sm">
            <div className="px-1 pt-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setPayEnabled(p => !p)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${payEnabled ? 'bg-[#293c4f]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${payEnabled ? 'translate-x-4' : ''}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">El cliente realizó un pago inicial</p>
                  <p className="text-xs text-gray-400">Registra un abono o anticipo al crear la factura</p>
                </div>
              </label>

              {payEnabled && (
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                  {/* Quick % buttons */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Monto del pago inicial</p>
                    <div className="flex gap-1.5 mb-2">
                      {[25, 50, 75, 100].map(pct => (
                        <button key={pct} type="button"
                          onClick={() => setPayAmount((total * pct / 100).toFixed(2))}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-colors font-medium
                            ${parseFloat(payAmount) === total * pct / 100
                              ? 'border-[#293c4f] bg-[#293c4f] text-white'
                              : 'border-gray-200 text-gray-600 hover:border-[#293c4f] hover:text-[#293c4f]'}`}>
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</span>
                      <input
                        type="number" min="0" step="0.01"
                        placeholder="0.00"
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        className={ic + ' pl-7'}
                      />
                    </div>
                    {parseFloat(payAmount) > total && (
                      <p className="text-xs text-red-500 mt-1">El monto supera el total de la factura</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <F label="Forma de pago">
                      <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={ic}>
                        <option value="TRANSFER">Transferencia</option>
                        <option value="CASH">Efectivo</option>
                        <option value="CHECK">Cheque</option>
                        <option value="CREDIT_CARD">Tarjeta</option>
                      </select>
                    </F>
                    <F label="Fecha del pago">
                      <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={ic} />
                    </F>
                  </div>

                  <F label="Referencia (opcional)">
                    <input type="text" placeholder="# cheque, transferencia, etc."
                      value={payRef} onChange={e => setPayRef(e.target.value)} className={ic} />
                  </F>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Resumen" />
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-gray-500">
                <span>ITBIS</span>
                {isProforma
                  ? <span className="text-purple-600 font-medium">No aplica</span>
                  : isExemptType
                    ? <span className="text-amber-600 font-medium">Exento</span>
                    : <span>{formatCurrency(taxAmount)}</span>}
              </div>
              {isProforma && (
                <div className="text-xs text-purple-600 bg-purple-50 rounded-lg px-2 py-1.5">
                  Proforma — no tiene efecto fiscal, no reporta impuestos.
                </div>
              )}
              {isExemptType && !isProforma && (
                <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">
                  e-CF {form.ncfType.replace('E','')} — ITBIS no aplica en este tipo de comprobante.
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2">
                <span>Total factura</span><span>{formatCurrency(total)}</span>
              </div>

              {payEnabled && parseFloat(payAmount) > 0 && (
                <>
                  <div className="flex justify-between text-green-700 font-medium border-t border-dashed border-gray-100 pt-2">
                    <span>Pago inicial ({payMethod === 'TRANSFER' ? 'Transf.' : payMethod === 'CASH' ? 'Efectivo' : payMethod === 'CHECK' ? 'Cheque' : 'Tarjeta'})</span>
                    <span>− {formatCurrency(parseFloat(payAmount) || 0)}</span>
                  </div>
                  <div className={`flex justify-between font-bold text-base rounded-lg px-3 py-2 ${
                    (total - (parseFloat(payAmount) || 0)) <= 0
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    <span>Saldo pendiente</span>
                    <span>{formatCurrency(Math.max(0, total - (parseFloat(payAmount) || 0)))}</span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-5 space-y-2">
              <Button
                variant="primary"
                className="w-full"
                loading={create.isPending}
                disabled={
                  !form.clientId ||
                  items.some((i) => !i.description) ||
                  (payEnabled && parseFloat(payAmount) > total)
                }
                onClick={() => create.mutate()}
              >
                {payEnabled && parseFloat(payAmount) > 0 ? 'Crear factura y registrar pago' : 'Emitir factura'}
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

// ── Quick-create inline components ────────────────────────────

function QuickCreateProduct({ onCreated, onClose }: {
  onCreated: (product: { id: string; name: string; unitPrice: number; taxRate: number; isExempt: boolean }) => void
  onClose:   () => void
}) {
  const [name, setName]         = useState('')
  const [price, setPrice]       = useState('')
  const [taxRate, setTaxRate]   = useState('18')
  const [isExempt, setIsExempt] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  async function handleSave() {
    if (!name.trim() || !price) { setErr('Nombre y precio son requeridos'); return }
    setSaving(true); setErr('')
    try {
      const taxRateDecimal = isExempt ? 0 : parseInt(taxRate) / 100
      const { data } = await api.post('/products', {
        name,
        unitPrice: parseFloat(price),
        taxRate:   taxRateDecimal,
        isExempt,
        isActive:  true,
        type:      'SERVICE',
        businessUnit: 'HAX',
      })
      onCreated(data.data ?? data)
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Error al crear producto')
    } finally { setSaving(false) }
  }

  return (
    <div className="p-3 border border-dashed border-[#293c4f]/30 rounded-xl bg-blue-50/40 space-y-2">
      <p className="text-xs font-semibold text-[#293c4f]">Nuevo producto / servicio</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3 sm:col-span-1">
          <input className={ic} placeholder="Nombre *" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <input className={ic} placeholder="Precio (DOP) *" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
        <select className={ic} value={isExempt ? 'exempt' : taxRate} onChange={e => {
          if (e.target.value === 'exempt') { setIsExempt(true); setTaxRate('0') }
          else { setIsExempt(false); setTaxRate(e.target.value) }
        }}>
          <option value="18">ITBIS 18%</option>
          <option value="16">ITBIS 16%</option>
          <option value="exempt">Exento</option>
        </select>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex gap-2">
        <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>Crear y agregar</Button>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  )
}

// ── Catalog confirm modal ─────────────────────────────────────
function CatalogConfirmModal({ items, onDone }: {
  items: LineItem[]
  onDone: () => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(items.map((_, i) => i)))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleConfirm() {
    setSaving(true); setErr('')
    try {
      const toCreate = items.filter((_, i) => selected.has(i))
      await Promise.all(toCreate.map(item =>
        api.post('/products', {
          name: item.description,
          unitPrice: item.unitPrice,
          taxRate: item.isExempt ? 0 : item.taxRate / 100,
          isExempt: item.isExempt,
          isActive: true,
          type: 'SERVICE',
          businessUnit: 'HAX',
        })
      ))
    } catch (e: any) {
      setErr(e.response?.data?.error ?? 'Error al guardar productos')
    } finally { setSaving(false); onDone() }
  }

  const toggle = (i: number) => {
    const next = new Set(selected)
    next.has(i) ? next.delete(i) : next.add(i)
    setSelected(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-[#293c4f] px-6 py-4">
          <h2 className="text-white font-semibold text-sm">Agregar ítems al catálogo</h2>
          <p className="text-white/70 text-xs mt-0.5">Estos ítems no están en tu catálogo de productos. ¿Cuáles deseas guardar?</p>
        </div>
        <div className="p-5 space-y-2">
          {items.map((item, i) => (
            <label key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={selected.has(i)}
                onChange={() => toggle(i)}
                className="w-4 h-4 rounded accent-[#293c4f]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.description}</p>
                <p className="text-xs text-gray-400">
                  {item.isExempt ? 'ITBIS exento' : `ITBIS ${item.taxRate}%`}
                </p>
              </div>
            </label>
          ))}
          {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="secondary" size="sm" onClick={onDone}>No agregar ninguno</Button>
          <Button variant="primary" size="sm" loading={saving}
            disabled={selected.size === 0}
            onClick={handleConfirm}>
            Agregar {selected.size > 0 ? `${selected.size} ítem${selected.size > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
