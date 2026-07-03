'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const { Bot, InputFile } = require('grammy')
const Anthropic           = require('@anthropic-ai/sdk')
const axios               = require('axios')
const fs                  = require('fs')
const path                = require('path')
const os                  = require('os')

// ── Config ─────────────────────────────────────────────────────────────────
const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN
const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY
const ERP_URL     = process.env.ERP_API_URL || 'http://localhost:4000/api'
const ERP_TOKEN   = process.env.ERP_API_TOKEN
const ALLOWED_IDS = (process.env.ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean).map(Number)

if (!BOT_TOKEN)  { console.error('❌ TELEGRAM_BOT_TOKEN no configurado'); process.exit(1) }
if (!CLAUDE_KEY) { console.error('❌ ANTHROPIC_API_KEY no configurado');   process.exit(1) }

const bot       = new Bot(BOT_TOKEN)
const anthropic = new Anthropic.Anthropic({ apiKey: CLAUDE_KEY })

// Whitelist dinámica
const whitelist = new Set(ALLOWED_IDS)
function isAllowed(chatId) {
  if (whitelist.size === 0) { whitelist.add(chatId); console.log(`✅ Chat ${chatId} auto-autorizado`); return true }
  return whitelist.has(chatId)
}

// Historial por chat (max 20 mensajes)
const histories     = new Map()
// Acciones pendientes de confirmación por chat
const pendingActions = new Map()

// ── ERP client ──────────────────────────────────────────────────────────────
const erp = axios.create({
  baseURL: ERP_URL,
  headers: { Authorization: `Bearer ${ERP_TOKEN}` },
  timeout: 30000,
})

// ── Helpers ─────────────────────────────────────────────────────────────────
function today()  { return new Date().toISOString().slice(0, 10) }
function monthRange(ago = 0) {
  const d = new Date(); d.setMonth(d.getMonth() - ago)
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0')
  const last = new Date(y, d.getMonth() + 1, 0).getDate()
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}`, period: `${y}-${m}` }
}
function fmt(n)  { return n == null ? '—' : 'RD$ ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 }) }
function fmtD(d) { return d ? new Date(d).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }
function sEmoji(s) {
  return ({ DRAFT:'📝', APPROVED:'✅', PAID:'💚', CANCELLED:'❌', SENT:'📨', ACCEPTED:'🤝', REJECTED:'❌',
            LEAD:'🔵', CONTACT:'🟡', PROPOSAL:'🟠', NEGOTIATION:'🔴', CLOSED_WON:'🏆', CLOSED_LOST:'💀' })[s] || '•'
}
function ncfLabel(t) {
  return ({ E31:'Crédito Fiscal', E32:'Consumo', E33:'Nota Débito', E34:'Nota Crédito',
            E44:'Régimen Especial', E45:'Gubernamental', PROFORMA:'Proforma' })[t] || t || 'E31'
}
function methodLabel(m) {
  return ({ TRANSFER:'Transferencia', CASH:'Efectivo', CHECK:'Cheque', CARD:'Tarjeta' })[m] || m
}

// ── System prompt ───────────────────────────────────────────────────────────
function systemPrompt() {
  const cur  = monthRange(0), prev = monthRange(1)
  return `Eres el asistente ERP de HAX Estudio Creativo / KODER. Respondes en español dominicano.

HOY: ${today()}
MES ACTUAL: from=${cur.from} to=${cur.to} period=${cur.period}
MES PASADO: from=${prev.from} to=${prev.to} period=${prev.period}

Responde SIEMPRE con un JSON válido (sin markdown, sin texto extra):
{"action":"<acción>","params":{<params>},"reply":"<mensaje en español o vacío>"}

ACCIONES DE LECTURA:
- list_invoices      params: {search?,status?,from?,to?,bu?,limit?}   status: DRAFT|APPROVED|PAID|CANCELLED
- get_invoice_pdf    params: {id:"<id>"}
- search_invoice_pdf params: {search:"<texto>",from?,to?,status?}
- list_clients       params: {search?,limit?}
- list_quotes        params: {search?,status?,from?,to?,limit?}        status: DRAFT|SENT|ACCEPTED|REJECTED
- get_quote_pdf      params: {id:"<id>"}
- search_quote_pdf   params: {search:"<texto>"}
- list_payments      params: {from?,to?,limit?}
- list_products      params: {search?,limit?}
- crm_pipeline       params: {bu?}
- crm_analytics      params: {bu?}
- list_expenses      params: {from?,to?,limit?}
- list_payroll       params: {period?}

ACCIONES DE ESCRITURA:
- create_invoice   params: {clientSearch,bu?,ncfType?,items:[{description,qty,unitPrice?}],notes?,dueDate?}
                   ncfType: E31=Crédito Fiscal | E32=Consumo | E44=Régimen Especial | PROFORMA
                   IMPORTANTE: si el usuario menciona un producto/servicio por nombre sin dar precio, omite unitPrice — el bot lo buscará en el catálogo automáticamente
- create_quote     params: {clientSearch,bu?,items:[{description,qty,unitPrice?}],notes?,validUntil?}
                   IMPORTANTE: igual que create_invoice, omite unitPrice si el usuario dice el nombre del producto/servicio
- create_client    params: {name,rnc?,email?,phone?,address?}
- register_payment params: {invoiceSearch,amount,method,reference?}    method: TRANSFER|CASH|CHECK|CARD
- emit_invoice     params: {invoiceSearch}
- confirm          params: {}
- cancel           params: {}

- help             params: {}
- unknown          params: {}

REGLAS:
1. Para PDFs sin ID exacto → usa search_invoice_pdf o search_quote_pdf
2. "este mes" = from=${cur.from} to=${cur.to}
3. "mes pasado" = from=${prev.from} to=${prev.to}
4. "reply" vacío si vas a ejecutar una acción que devuelve datos
5. bu por defecto: HAX (a menos que el usuario diga KODER)
6. ncfType por defecto para facturas: E31
7. "sí"/"dale"/"confirmar"/"ok"/"va"/"adelante" tras un resumen → acción: confirm
8. "no"/"cancelar"/"espera"/"para" → acción: cancel
9. Para acciones de escritura: reply vacío, el bot muestra el resumen
10. qty por defecto: 1 si no se especifica
11. Si el usuario nombra un producto/servicio del catálogo sin precio → incluirlo en items SIN unitPrice, el bot busca el precio`
}

// ── Buscar cliente en ERP ───────────────────────────────────────────────────
async function findClient(search) {
  const { data } = await erp.get('/clients', { params: { search, limit: 5 } })
  return data.data ?? data ?? []
}

// ── Buscar factura en ERP ───────────────────────────────────────────────────
async function findInvoice(search, status) {
  const p = { search, limit: 5, excludeProforma: 'true' }
  if (status) p.status = status
  const { data } = await erp.get('/invoices', { params: p })
  return data.data ?? data ?? []
}

// ── Buscar producto en catálogo ─────────────────────────────────────────────
async function findProduct(search) {
  const { data } = await erp.get('/products', { params: { search, limit: 5 } })
  return data.data ?? data ?? []
}

// ── Resolver ítems: busca en catálogo si falta el precio ────────────────────
function buildItem(description, qty, price, taxRate, isExempt, meta = {}) {
  const sub       = qty * price
  const tax       = isExempt ? 0 : sub * taxRate
  return {
    description,
    quantity:  qty,
    unitPrice: price,
    taxRate:   isExempt ? 0 : taxRate,
    taxAmount: tax,
    subtotal:  sub,
    total:     sub + tax,
    isExempt,
    ...meta,
  }
}

async function resolveItems(rawItems) {
  const resolved   = []
  const unresolved = []

  for (const i of rawItems) {
    const qty   = Number(i.qty) || 1
    const price = Number(i.unitPrice) || 0

    if (price > 0) {
      const exempt  = !!i.isExempt
      const taxRate = exempt ? 0 : (Number(i.taxRate) || 0.18)
      resolved.push(buildItem(i.description, qty, price, taxRate, exempt))
    } else {
      const products = await findProduct(i.description)
      if (!products.length) {
        unresolved.push(i.description)
      } else {
        const p      = products[0]
        const exempt = !!p.isExempt
        const rate   = exempt ? 0 : (Number(p.taxRate) || 0.18)
        resolved.push(buildItem(p.name, qty, Number(p.unitPrice), rate, exempt, {
          _fromCatalog:  p.name,
          _otherMatches: products.slice(1).map(x => x.name),
        }))
      }
    }
  }

  return { resolved, unresolved }
}

// ── Calcular totales de ítems (precio ya conocido) — ya no se usa directamente
// resolveItems maneja todos los casos; esta función queda por compatibilidad
function calcItems(items) {
  return items.map(i => buildItem(
    i.description,
    Number(i.qty) || 1,
    Number(i.unitPrice) || 0,
    Number(i.taxRate) || 0.18,
    !!i.isExempt,
  ))
}

// ── Ejecutar acción ─────────────────────────────────────────────────────────
async function executeAction(action, params, chatId) {
  switch (action) {

    // ── LECTURA ─────────────────────────────────────────────────────────────

    case 'list_invoices': {
      const p = { ...params, limit: params.limit || 10, excludeProforma: 'true' }
      const { data } = await erp.get('/invoices', { params: p })
      const list = data.data ?? data
      if (!list?.length) return { text: '📭 No se encontraron facturas.' }
      const total = list.reduce((s, i) => s + (i.total ?? 0), 0)
      const lines = list.map(i => `${sEmoji(i.status)} *${i.number}* — ${i.client?.name ?? '?'}\n   ${fmt(i.total)} · ${fmtD(i.issueDate)}`).join('\n')
      return { text: `📋 *Facturas (${list.length}) · Total: ${fmt(total)}*\n\n${lines}` }
    }

    case 'get_invoice_pdf': {
      const r = await erp.get(`/invoices/${params.id}/pdf`, { responseType: 'arraybuffer' })
      return { pdf: Buffer.from(r.data), filename: `factura-${params.id}.pdf` }
    }

    case 'search_invoice_pdf': {
      const p = { search: params.search, from: params.from, to: params.to, limit: 5, excludeProforma: 'true' }
      if (params.status) p.status = params.status
      const { data } = await erp.get('/invoices', { params: p })
      const list = data.data ?? data
      if (!list?.length) return { text: `📭 No encontré facturas con "*${params.search}*".` }
      const inv = list[0]
      const r = await erp.get(`/invoices/${inv.id}/pdf`, { responseType: 'arraybuffer' })
      return { pdf: Buffer.from(r.data), filename: `${inv.number}.pdf`, caption: `📄 *${inv.number}* — ${inv.client?.name}\n${fmt(inv.total)} · ${fmtD(inv.issueDate)}` }
    }

    case 'list_clients': {
      const { data } = await erp.get('/clients', { params: { ...params, limit: params.limit || 10 } })
      const list = data.data ?? data
      if (!list?.length) return { text: '📭 No se encontraron clientes.' }
      const lines = list.map(c => `• *${c.name}*${c.rnc ? ' · RNC ' + c.rnc : ''}${c.phone ? ' · ' + c.phone : ''}`).join('\n')
      return { text: `👥 *Clientes (${list.length}):*\n\n${lines}` }
    }

    case 'list_quotes': {
      const { data } = await erp.get('/quotes', { params: { ...params, limit: params.limit || 10 } })
      const list = data.data ?? data
      if (!list?.length) return { text: '📭 No se encontraron cotizaciones.' }
      const lines = list.map(q => `${sEmoji(q.status)} *${q.number}* — ${q.client?.name ?? '?'}\n   ${fmt(q.total)} · ${fmtD(q.createdAt)}`).join('\n')
      return { text: `💼 *Cotizaciones (${list.length}):*\n\n${lines}` }
    }

    case 'get_quote_pdf': {
      const r = await erp.get(`/quotes/${params.id}/pdf`, { responseType: 'arraybuffer' })
      return { pdf: Buffer.from(r.data), filename: `cotizacion-${params.id}.pdf` }
    }

    case 'search_quote_pdf': {
      const { data } = await erp.get('/quotes', { params: { search: params.search, limit: 5 } })
      const list = data.data ?? data
      if (!list?.length) return { text: `📭 No encontré cotizaciones con "*${params.search}*".` }
      const q = list[0]
      const r = await erp.get(`/quotes/${q.id}/pdf`, { responseType: 'arraybuffer' })
      return { pdf: Buffer.from(r.data), filename: `${q.number}.pdf`, caption: `📄 *${q.number}* — ${q.client?.name}\n${fmt(q.total)} · ${fmtD(q.createdAt)}` }
    }

    case 'list_payments': {
      const { data } = await erp.get('/payments', { params: { ...params, limit: params.limit || 15, excludeProforma: 'true' } })
      const list = data.data ?? data
      if (!list?.length) return { text: '📭 No se encontraron cobros.' }
      const total = list.reduce((s, p) => s + (p.amount ?? 0), 0)
      const lines = list.map(p => `• ${fmtD(p.paidAt)} — *${p.invoice?.client?.name ?? '?'}* → ${fmt(p.amount)}`).join('\n')
      return { text: `💰 *Cobros (${list.length}) — Total: ${fmt(total)}*\n\n${lines}` }
    }

    case 'crm_pipeline': {
      const { data } = await erp.get('/crm/pipeline', { params: params.bu ? { businessUnit: params.bu } : {} })
      const pipeline = data.data ?? data
      const stageNames = { LEAD:'Lead', CONTACT:'Contactado', PROPOSAL:'Propuesta', NEGOTIATION:'Negociación', CLOSED_WON:'Ganado', CLOSED_LOST:'Perdido' }
      const entries = Object.entries(pipeline)
      if (!entries.length) return { text: '📭 Pipeline CRM vacío.' }
      const lines = entries.map(([s, items]) => {
        const arr   = Array.isArray(items) ? items : []
        const total = arr.reduce((x, i) => x + (i.value ?? 0), 0)
        return `${sEmoji(s)} *${stageNames[s] || s}* (${arr.length})${total > 0 ? ' — ' + fmt(total) : ''}`
      }).join('\n')
      return { text: `🎯 *Pipeline CRM:*\n\n${lines}` }
    }

    case 'crm_analytics': {
      const { data } = await erp.get('/crm/analytics', { params: params.bu ? { businessUnit: params.bu } : {} })
      const a = data.data ?? data
      return { text: `📊 *CRM Analytics:*\n\n🏷 Pipeline total: ${fmt(a.totalPipeline)}\n📈 Forecast: ${fmt(a.weightedForecast)}\n🏆 Ganado este mes: ${fmt(a.wonThisMonth)}\n📉 Win rate: ${a.winRate ?? 0}%` }
    }

    case 'list_expenses': {
      const { data } = await erp.get('/expenses', { params: { ...params, limit: params.limit || 15 } })
      const list = data.data ?? data
      if (!list?.length) return { text: '📭 No se encontraron gastos.' }
      const total = list.reduce((s, e) => s + (e.amount ?? 0), 0)
      const lines = list.map(e => `• ${fmtD(e.date)} — *${e.description ?? e.category}* → ${fmt(e.amount)}`).join('\n')
      return { text: `🧾 *Gastos (${list.length}) — Total: ${fmt(total)}*\n\n${lines}` }
    }

    case 'list_payroll': {
      const { data } = await erp.get('/payroll', { params: params.period ? { period: params.period } : {} })
      const list = Array.isArray(data.data ?? data) ? (data.data ?? data) : [data.data ?? data].filter(Boolean)
      if (!list?.length) return { text: '📭 No se encontraron registros de nómina.' }
      const lines = list.map(p => `• *${p.period ?? p.month}* — ${p.employeeCount ?? '?'} empleados → ${fmt(p.totalNet ?? p.totalGross)}`).join('\n')
      return { text: `👨‍💼 *Nómina:*\n\n${lines}` }
    }

    // ── ESCRITURA ───────────────────────────────────────────────────────────

    case 'create_invoice': {
      const clients = await findClient(params.clientSearch)
      if (!clients.length) return { text: `❌ No encontré cliente *"${params.clientSearch}"*.\n\nPuedes crearlo con: _"crea cliente [nombre]"_` }

      const client  = clients[0]
      const bu      = params.bu || 'HAX'
      const ncfType = params.ncfType || 'E31'

      const { resolved: items, unresolved } = await resolveItems(params.items || [])
      if (unresolved.length) return { text: `❌ No encontré en el catálogo: *${unresolved.join(', ')}*\n\nEscribe el precio manualmente, ej: _"${unresolved[0]} $X,XXX"_` }
      if (!items.length)     return { text: '❌ No hay ítems para la factura. Dime qué servicios incluir.' }

      const subtotal  = items.reduce((s, i) => s + i.subtotal, 0)
      const tax       = items.reduce((s, i) => s + i.taxAmount, 0)
      const total     = subtotal + tax
      const itemLines = items.map(i => {
        const catalog = i._fromCatalog ? ` _[catálogo]_` : ''
        return `  • ${i.description} × ${i.quantity} = ${fmt(i.unitPrice * i.quantity)}${i.isExempt ? ' _(exento)_' : ''}${catalog}`
      }).join('\n')

      pendingActions.set(chatId, {
        type: 'invoice',
        data: {
          businessUnit: bu,
          clientId:     client.id,
          ncfType,
          items:        items.map(({ _fromCatalog, _otherMatches, ...rest }) => rest),
          notes:        params.notes,
          dueDate:      params.dueDate,
        },
      })

      return { text: `📋 *Nueva Factura — Confirmar*\n\n👤 *${client.name}*${client.rnc ? ' · RNC ' + client.rnc : ''}\n🏢 ${bu} · NCF: ${ncfLabel(ncfType)}\n${params.dueDate ? `📅 Vence: ${fmtD(params.dueDate)}\n` : ''}\n*Ítems:*\n${itemLines}\n\n💰 Subtotal: ${fmt(subtotal)}\n🧾 ITBIS: ${fmt(tax)}\n*Total: ${fmt(total)}*\n\n✅ Escribe *sí* para crear · ❌ *cancelar* para salir` }
    }

    case 'create_quote': {
      const clients = await findClient(params.clientSearch)
      if (!clients.length) return { text: `❌ No encontré cliente *"${params.clientSearch}"*.\n\nPuedes crearlo con: _"crea cliente [nombre]"_` }

      const client = clients[0]
      const bu     = params.bu || 'HAX'

      const { resolved: items, unresolved } = await resolveItems(params.items || [])
      if (unresolved.length) return { text: `❌ No encontré en el catálogo: *${unresolved.join(', ')}*\n\nEscribe el precio manualmente, ej: _"${unresolved[0]} $X,XXX"_` }
      if (!items.length)     return { text: '❌ No hay ítems para la cotización. Dime qué servicios incluir.' }

      const subtotal  = items.reduce((s, i) => s + i.subtotal, 0)
      const tax       = items.reduce((s, i) => s + i.taxAmount, 0)
      const total     = subtotal + tax
      const itemLines = items.map(i => {
        const catalog = i._fromCatalog ? ` _[catálogo]_` : ''
        return `  • ${i.description} × ${i.quantity} = ${fmt(i.unitPrice * i.quantity)}${i.isExempt ? ' _(exento)_' : ''}${catalog}`
      }).join('\n')

      pendingActions.set(chatId, {
        type: 'quote',
        data: {
          businessUnit: bu,
          clientId:     client.id,
          items:        items.map(({ _fromCatalog, _otherMatches, ...rest }) => rest),
          notes:        params.notes,
          validUntil:   params.validUntil,
        },
      })

      return { text: `💼 *Nueva Cotización — Confirmar*\n\n👤 *${client.name}*\n🏢 ${bu}${params.validUntil ? `\n📅 Válida hasta: ${fmtD(params.validUntil)}` : ''}\n\n*Ítems:*\n${itemLines}\n\n💰 Subtotal: ${fmt(subtotal)}\n🧾 ITBIS: ${fmt(tax)}\n*Total: ${fmt(total)}*\n\n✅ Escribe *sí* para crear · ❌ *cancelar* para salir` }
    }

    case 'list_products': {
      const { data } = await erp.get('/products', { params: { search: params.search, limit: params.limit || 15 } })
      const list = data.data ?? data
      if (!list?.length) return { text: '📭 No se encontraron productos/servicios.' }
      const lines = list.map(p => `• *${p.name}*${p.code ? ` (${p.code})` : ''}\n  ${fmt(p.unitPrice)}${p.isExempt ? ' · exento ITBIS' : ' + ITBIS'}`).join('\n')
      return { text: `🛍 *Catálogo (${list.length}):*\n\n${lines}` }
    }

    case 'create_client': {
      if (!params.name) return { text: '❌ El nombre del cliente es requerido.' }

      pendingActions.set(chatId, { type: 'client', data: { ...params } })

      const lines = [
        `👤 *Nombre:* ${params.name}`,
        params.rnc     ? `🆔 RNC: ${params.rnc}` : null,
        params.email   ? `📧 ${params.email}` : null,
        params.phone   ? `📞 ${params.phone}` : null,
        params.address ? `📍 ${params.address}` : null,
      ].filter(Boolean).join('\n')

      return { text: `👥 *Nuevo Cliente — Confirmar*\n\n${lines}\n\n✅ Escribe *sí* para crear · ❌ *cancelar* para salir` }
    }

    case 'register_payment': {
      const invoices = await findInvoice(params.invoiceSearch, 'APPROVED')
      if (!invoices.length) return { text: `❌ No encontré facturas aprobadas para *"${params.invoiceSearch}"*.` }

      if (invoices.length > 1) {
        const opts = invoices.map((i, n) => `${n + 1}. *${i.number}* — ${i.client?.name} — ${fmt(i.amountDue)} pendiente`).join('\n')
        return { text: `📋 Encontré varias facturas. ¿Cuál es?\n\n${opts}\n\nEscribe el número de la factura exacto.` }
      }

      const inv = invoices[0]
      const amount = Number(params.amount)
      if (amount <= 0) return { text: '❌ El monto debe ser mayor a 0.' }
      if (amount > inv.amountDue) return { text: `❌ El monto (${fmt(amount)}) supera el saldo pendiente (${fmt(inv.amountDue)}).` }

      pendingActions.set(chatId, {
        type: 'payment',
        data: { invoiceId: inv.id, amount, method: params.method || 'TRANSFER', reference: params.reference },
      })

      return { text: `💰 *Registrar Cobro — Confirmar*\n\n📄 Factura: *${inv.number}* — ${inv.client?.name}\n💵 Monto a cobrar: *${fmt(amount)}*\n🏦 Método: ${methodLabel(params.method || 'TRANSFER')}${params.reference ? `\n🔖 Ref: ${params.reference}` : ''}\n📊 Saldo pendiente: ${fmt(inv.amountDue)}\n\n✅ Escribe *sí* para registrar · ❌ *cancelar* para salir` }
    }

    case 'emit_invoice': {
      const invoices = await findInvoice(params.invoiceSearch, 'DRAFT')
      if (!invoices.length) return { text: `❌ No encontré borradores de factura para *"${params.invoiceSearch}"*.` }

      const inv = invoices[0]
      pendingActions.set(chatId, { type: 'emit', data: { invoiceId: inv.id, number: inv.number } })

      return { text: `📤 *Emitir Factura — Confirmar*\n\n📄 *${inv.number}* — ${inv.client?.name}\n💰 Total: ${fmt(inv.total)}\n\n⚠️ Esto asignará el NCF y generará los asientos contables.\n\n✅ Escribe *sí* para emitir · ❌ *cancelar* para salir` }
    }

    case 'confirm': {
      const pending = pendingActions.get(chatId)
      if (!pending) return { text: '❓ No hay ninguna acción pendiente de confirmar.' }
      pendingActions.delete(chatId)

      switch (pending.type) {
        case 'invoice': {
          const { data } = await erp.post('/invoices', pending.data)
          const inv = data.data ?? data
          return { text: `✅ *Factura creada: ${inv.number}*\n\n👤 ${inv.client?.name ?? ''}\n💰 Total: ${fmt(inv.total)}\n📝 Estado: Borrador\n\n¿Emitirla ahora? Escribe _"emite ${inv.number}"_ o _"la dejo en borrador"_` }
        }
        case 'quote': {
          const { data } = await erp.post('/quotes', pending.data)
          const q = data.data ?? data
          return { text: `✅ *Cotización creada: ${q.number}*\n\n👤 ${q.client?.name ?? ''}\n💰 Total: ${fmt(q.total)}\n📝 Estado: Borrador` }
        }
        case 'client': {
          const { data } = await erp.post('/clients', pending.data)
          const c = data.data ?? data
          return { text: `✅ *Cliente creado: ${c.name}*${c.rnc ? '\nRNC: ' + c.rnc : ''}` }
        }
        case 'payment': {
          const { invoiceId, ...payData } = pending.data
          const { data } = await erp.post(`/invoices/${invoiceId}/payments`, payData)
          const pmt = data.data ?? data
          return { text: `✅ *Cobro registrado: ${fmt(pmt.amount)}*\n🏦 Método: ${methodLabel(pmt.method)}${pmt.reference ? '\n🔖 Ref: ' + pmt.reference : ''}` }
        }
        case 'emit': {
          await erp.post(`/invoices/${pending.data.invoiceId}/emit`)
          return { text: `✅ *Factura ${pending.data.number} emitida/aprobada*\n\nYa tiene NCF asignado y está lista para cobro.` }
        }
        default:
          return { text: '❌ Tipo de acción desconocido.' }
      }
    }

    case 'cancel': {
      const had = pendingActions.has(chatId)
      pendingActions.delete(chatId)
      return { text: had ? '↩️ Acción cancelada.' : '↩️ No había nada pendiente.' }
    }

    case 'help':
      return { text: `🤖 *Asistente ERP HAX*\n\n*LECTURA:*\n📋 _"facturas de este mes"_\n📄 _"PDF de la factura de ACME"_\n💰 _"cuánto hemos cobrado este mes"_\n💼 _"cotizaciones enviadas"_\n👥 _"busca cliente La Estancia"_\n🛍 _"muéstrame los productos"_\n🎯 _"estado del pipeline CRM"_\n🧾 _"gastos de junio"_\n\n*CREACIÓN:*\n➕ _"crea factura para ACME: plan lite y diseño de flyer"_ ← busca precios del catálogo\n➕ _"factura para ACME por diseño web $50,000"_ ← precio manual\n💼 _"cotización para La Estancia: branding $80,000 y web $120,000"_\n👤 _"crea cliente Nuevo Corp RNC 123456789"_\n💳 _"registra cobro de $30,000 a la factura de ACME, transferencia"_\n📤 _"emite la factura H-000042"_` }

    default:
      return { text: '🤔 No entendí. Escribe *ayuda* para ver qué puedo hacer.' }
  }
}

// ── Claude ─────────────────────────────────────────────────────────────────
async function ask(chatId, userMsg) {
  if (!histories.has(chatId)) histories.set(chatId, [])
  const history = histories.get(chatId)
  history.push({ role: 'user', content: userMsg })
  if (history.length > 20) history.splice(0, 2)

  const res = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system:     systemPrompt(),
    messages:   history,
  })

  const text = res.content[0]?.text ?? ''
  history.push({ role: 'assistant', content: text })

  try {
    const match = text.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : text)
  } catch {
    return { action: 'unknown', params: {}, reply: text }
  }
}

// ── Handlers ────────────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const chatId = ctx.chat.id
  if (!isAllowed(chatId)) return ctx.reply('⛔ No tienes acceso.')
  return ctx.reply(
    '👋 ¡Hola! Soy el asistente ERP de HAX.\n\nPuedo *leer y crear* facturas, cotizaciones, clientes y cobros.\n\n_"crea factura para ACME por diseño web $50,000"_\n_"dame las facturas de este mes"_\n\nEscribe *ayuda* para ver todo.',
    { parse_mode: 'Markdown' }
  )
})

bot.on('message:text', async (ctx) => {
  const chatId = ctx.chat.id
  const text   = ctx.message.text?.trim()
  if (!text) return
  if (!isAllowed(chatId)) return ctx.reply('⛔ No tienes acceso.')

  await ctx.replyWithChatAction('typing')

  try {
    const { action, params = {}, reply } = await ask(chatId, text)

    const hasAction = action && action !== 'unknown'

    if (reply && !hasAction) await ctx.reply(reply, { parse_mode: 'Markdown' })

    if (hasAction) {
      await ctx.replyWithChatAction('typing')
      const result = await executeAction(action, params || {}, chatId)

      if (result.pdf) {
        const tmp = path.join(os.tmpdir(), `erp-${Date.now()}.pdf`)
        fs.writeFileSync(tmp, result.pdf)
        await ctx.replyWithDocument(new InputFile(tmp, result.filename ?? 'documento.pdf'), {
          caption:    result.caption ?? '',
          parse_mode: 'Markdown',
        })
        fs.unlinkSync(tmp)
      } else if (result.text) {
        await ctx.reply(result.text, { parse_mode: 'Markdown' })
      }
    }

  } catch (err) {
    console.error('Error:', err.message)
    const msg = err.response?.data?.error ?? err.message ?? 'Error desconocido'
    await ctx.reply(`❌ Error: ${msg}\n\nIntenta de nuevo o escribe *ayuda*.`, { parse_mode: 'Markdown' })
  }
})

bot.catch((err) => console.error('Bot error:', err.message))

bot.start()
console.log(`🤖 Bot ERP HAX activo | API: ${ERP_URL}`)
