import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { InvoiceStatus, PaymentStatus, BusinessUnit } from '@prisma/client'
import { invoiceEmitQueue } from '../../queues/invoice.queue'
import { logger } from '../../config/logger'

function generateInvoiceNumber(bu: string, count: number) {
  const prefix = bu === 'HAX' ? 'H' : 'K'
  return `${prefix}-${String(count + 1).padStart(6, '0')}`
}

/** Map e-CF type code from frontend → InvoiceType enum
 *  Accepts both new e-CF codes (E31, 31) and legacy B-codes for backward compat
 */
const NCF_TO_INVOICE_TYPE: Record<string, string> = {
  // New e-CF codes
  'E31': 'CREDITO_FISCAL',
  'E32': 'CONSUMO',
  'E33': 'NOTA_DEBITO',
  'E34': 'NOTA_CREDITO',
  'E41': 'COMPRAS',
  'E43': 'GASTOS_MENORES',
  'E44': 'REGIMEN_ESPECIAL',
  'E45': 'GUBERNAMENTAL',
  'E46': 'EXPORTACIONES',
  'E47': 'PAGOS_EXTERIOR',
  // Short codes (without E prefix, from selects)
  '31': 'CREDITO_FISCAL',
  '32': 'CONSUMO',
  '33': 'NOTA_DEBITO',
  '34': 'NOTA_CREDITO',
  '41': 'COMPRAS',
  '43': 'GASTOS_MENORES',
  '44': 'REGIMEN_ESPECIAL',
  '45': 'GUBERNAMENTAL',
  '46': 'EXPORTACIONES',
  '47': 'PAGOS_EXTERIOR',
  // Legacy B-codes (backward compat)
  'B01': 'CREDITO_FISCAL',
  'B02': 'CONSUMO',
  'B03': 'NOTA_DEBITO',
  'B04': 'NOTA_CREDITO',
  'B11': 'COMPRAS',
  'B14': 'REGIMEN_ESPECIAL',
  'B15': 'GUBERNAMENTAL',
}

/** Tipos con ITBIS exento: e-CF 44 (Régimen Especial), 45 (Gubernamental), 46 (Exportaciones), 47 (Pagos Exterior) */
const ITBIS_EXEMPT_TYPES = new Set([
  'REGIMEN_ESPECIAL', 'GUBERNAMENTAL', 'EXPORTACIONES', 'PAGOS_EXTERIOR',
  'B14', 'B15', 'E44', 'E45', 'E46', 'E47',
])

async function autoJournalEntry(opts: {
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE'
  businessUnit: 'HAX' | 'KODER'
  description: string
  debitCode: string
  creditCode: string
  amount: number
  invoiceId?: string
  paymentId?: string
  period: string // "YYYY-MM"
}) {
  if (opts.amount <= 0) return null
  const [debit, credit] = await Promise.all([
    prisma.account.findUnique({ where: { code: opts.debitCode } }),
    prisma.account.findUnique({ where: { code: opts.creditCode } }),
  ])
  if (!debit || !credit) return null
  return prisma.journalEntry.create({
    data: {
      type: opts.type,
      businessUnit: opts.businessUnit as any,
      description: opts.description,
      debitAccountId: debit.id,
      creditAccountId: credit.id,
      amount: opts.amount,
      period: opts.period,
      invoiceId: opts.invoiceId,
      paymentId: opts.paymentId,
    },
  })
}

export async function listInvoices(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.status) where.status = query.status
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.clientId) where.clientId = query.clientId
  if (query.search) {
    where.OR = [
      { number: { contains: query.search, mode: 'insensitive' } },
      { ncf: { contains: query.search, mode: 'insensitive' } },
      { client: { name: { contains: query.search, mode: 'insensitive' } } },
    ]
  }
  if (query.from || query.to) {
    where.issueDate = {}
    if (query.from) where.issueDate.gte = new Date(query.from)
    if (query.to) where.issueDate.lte = new Date(query.to)
  }

  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, rnc: true } },
        _count: { select: { payments: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      items: { orderBy: { sortOrder: 'asc' } },
      payments: { orderBy: { paidAt: 'desc' } },
      alanubeRequests: { orderBy: { sentAt: 'desc' }, take: 5 },
      creditNotes: { select: { id: true, number: true, total: true, status: true } },
    },
  })
  if (!invoice) throw new NotFoundError('Factura')
  return invoice
}

export async function createInvoice(data: any) {
  const count = await prisma.invoice.count({ where: { businessUnit: data.businessUnit } })
  const number = generateInvoiceNumber(data.businessUnit, count)

  // Normalize DateTime fields: convert YYYY-MM-DD strings to Date objects
  // Prisma rejects date-only strings — needs full DateTime or native Date
  if (!data.issueDate) delete data.issueDate
  else data.issueDate = new Date(data.issueDate)
  if (!data.dueDate)   delete data.dueDate
  else data.dueDate   = new Date(data.dueDate)

  // Map ncfType (B01/B02/B14) → InvoiceType enum and set on data
  const { items: rawItems, ncfType, type: rawType, ...invoiceData } = data
  const resolvedType = NCF_TO_INVOICE_TYPE[ncfType] ?? rawType ?? 'CONSUMO'
  const isExemptType = ITBIS_EXEMPT_TYPES.has(resolvedType)

  // For B14 (Régimen Especial): force all items to ITBIS exento
  const items = rawItems.map((i: any) => {
    if (isExemptType) return { ...i, isExempt: true, taxRate: 0, taxAmount: 0 }
    return i
  })

  const subtotal: number  = items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0)
  const taxAmount: number = items.reduce((s: number, i: any) => s + (i.taxAmount ?? 0), 0)
  const total = subtotal + taxAmount

  return prisma.invoice.create({
    data: {
      ...invoiceData,
      type: resolvedType as any,
      number,
      subtotal,
      taxAmount,
      total,
      amountDue: total,
      items: { create: items.map((item: any, idx: number) => ({ ...item, sortOrder: idx })) },
    },
    include: {
      client: true,
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })
}

export async function updateInvoice(id: string, data: any) {
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) throw new NotFoundError('Factura')
  if (invoice.status !== InvoiceStatus.DRAFT) throw new AppError('Solo se pueden editar facturas en DRAFT', 400)

  // Normalize DateTime fields
  if (!data.issueDate) delete data.issueDate
  else data.issueDate = new Date(data.issueDate)
  if (!data.dueDate)   delete data.dueDate
  else data.dueDate   = new Date(data.dueDate)

  const { items, ...invoiceData } = data

  if (items) {
    const subtotal: number = items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0)
    const taxAmount: number = items.reduce((s: number, i: any) => s + (i.taxAmount ?? 0), 0)
    const total = subtotal + taxAmount

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } })
    return prisma.invoice.update({
      where: { id },
      data: {
        ...invoiceData,
        subtotal,
        taxAmount,
        total,
        amountDue: total - invoice.amountPaid,
        items: { create: items.map((item: any, idx: number) => ({ ...item, sortOrder: idx })) },
      },
      include: { client: true, items: { orderBy: { sortOrder: 'asc' } } },
    })
  }

  return prisma.invoice.update({ where: { id }, data: invoiceData })
}

export async function cancelInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) throw new NotFoundError('Factura')
  if (invoice.status === InvoiceStatus.PAID) throw new AppError('No se puede cancelar una factura pagada', 400)

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date() },
  })

  // Reverse journal entry only if invoice was already APPROVED by DGII
  if (invoice.status === InvoiceStatus.APPROVED && invoice.subtotal > 0) {
    const config = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
    if (config?.autoJournalEntries) {
      const now = new Date()
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const creditCode = invoice.businessUnit === 'HAX' ? '4101' : '4102'
      // Reverso: Dr Ingresos / Cr CxC
      await autoJournalEntry({
        type: 'CREDIT_NOTE',
        businessUnit: invoice.businessUnit as 'HAX' | 'KODER',
        description: `Anulación factura ${invoice.number}`,
        debitCode: creditCode,
        creditCode: '1201',
        amount: invoice.subtotal,
        invoiceId: id,
        period,
      })
    }
  }

  return updated
}

export async function addPayment(invoiceId: string, data: any) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) throw new NotFoundError('Factura')
  if (invoice.status === InvoiceStatus.CANCELLED) throw new AppError('Factura cancelada', 400)

  const amount = parseFloat(data.amount)
  if (amount <= 0) throw new AppError('Monto inválido', 400)
  if (amount > invoice.amountDue) throw new AppError(`Monto supera el saldo pendiente (${invoice.amountDue})`, 400)

  const newAmountPaid = invoice.amountPaid + amount
  const newAmountDue = invoice.total - newAmountPaid
  const isPaid = newAmountDue <= 0
  const paymentStatus = isPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL

  const paidAt = data.paidAt ? new Date(data.paidAt) : new Date()

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId,
        amount,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        paidAt,
      },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        amountDue: Math.max(0, newAmountDue),
        paymentStatus,
        paidAt: isPaid ? new Date() : null,
        status: isPaid ? InvoiceStatus.PAID : invoice.status,
      },
    }),
  ])

  // Auto bank deposit: TRANSFER or CHECK → credit active bank account
  const BANK_METHODS = ['TRANSFER', 'CHECK', 'TRANSFERENCIA', 'CHEQUE']
  if (BANK_METHODS.includes((data.method ?? '').toUpperCase())) {
    try {
      // Find first active bank account (prefer same BU, fallback to any)
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { isActive: true, businessUnit: invoice.businessUnit as any },
      }) ?? await prisma.bankAccount.findFirst({ where: { isActive: true } })

      if (bankAccount) {
        await prisma.$transaction([
          prisma.bankTransaction.create({
            data: {
              bankAccountId: bankAccount.id,
              type: 'CREDIT',
              amount,
              description: `Cobro factura ${invoice.number}`,
              reference: data.reference ?? `PAY-${payment.id.slice(-6).toUpperCase()}`,
              transactionDate: paidAt,
              status: 'MATCHED',
              matchedAt: new Date(),
            },
          }),
          prisma.bankAccount.update({
            where: { id: bankAccount.id },
            data: { balance: { increment: amount } },
          }),
        ])
      }
    } catch { /* non-critical — don't fail payment */ }
  }

  // Auto journal entry: Dr Banco / Cr CxC
  const ecfConfig = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (ecfConfig?.autoJournalEntries) {
    const bankCode = ecfConfig.acctBank ?? '1102'
    const period = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}`
    await autoJournalEntry({
      type: 'PAYMENT',
      businessUnit: invoice.businessUnit as 'HAX' | 'KODER',
      description: `Pago factura ${invoice.number}`,
      debitCode: bankCode,
      creditCode: '1201',
      amount,
      invoiceId,
      paymentId: payment.id,
      period,
    })
  }

  return payment
}

export async function emitInvoice(id: string) {
  // Load invoice with items and client for validation
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: true,
      client: true,
    },
  })
  if (!invoice) throw new NotFoundError('Factura')
  if (invoice.status !== InvoiceStatus.DRAFT) {
    throw new AppError(`No se puede emitir una factura en estado ${invoice.status}`, 400)
  }

  // Validate items
  if (!invoice.items || invoice.items.length === 0) {
    throw new AppError('La factura debe tener al menos un ítem', 400)
  }
  if (invoice.items.some((i: any) => i.unitPrice <= 0)) {
    throw new AppError('Todos los ítems deben tener precio mayor a cero', 400)
  }
  if (invoice.items.some((i: any) => i.quantity <= 0)) {
    throw new AppError('Las cantidades deben ser mayores a cero', 400)
  }

  // Load EcfConfig for validations
  const ecfConfig = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (ecfConfig) {
    // Validate RNC for B01 (CREDITO_FISCAL) invoices
    if (ecfConfig.requireRncB01 && invoice.type === 'CREDITO_FISCAL' && !invoice.client?.rnc) {
      throw new AppError('Factura B01 requiere RNC del cliente', 400)
    }

    // Validate retroactive days
    if (ecfConfig.maxRetroactiveDays > 0) {
      const maxRetro = ecfConfig.maxRetroactiveDays
      const issueDate = new Date(invoice.issueDate)
      issueDate.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const diffDays = Math.floor((today.getTime() - issueDate.getTime()) / 86400000)
      if (diffDays > maxRetro) {
        throw new AppError(`La fecha de emisión supera los ${maxRetro} días retroactivos permitidos`, 400)
      }
    }
  }

  // Validate issue date is not more than 1 day in the future
  const issueDate = new Date(invoice.issueDate)
  issueDate.setHours(0, 0, 0, 0)
  const tomorrow = new Date()
  tomorrow.setHours(0, 0, 0, 0)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (issueDate > tomorrow) {
    throw new AppError('La fecha de emisión no puede ser más de 1 día en el futuro', 400)
  }

  // Transition to SENDING
  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.SENDING, sentAt: new Date() },
  })

  // Enqueue emission job
  await invoiceEmitQueue.add('emit', { invoiceId: id }, {
    jobId: `emit-${id}`,
    removeOnComplete: true,
  })

  return updated
}

export async function retryEmission(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) throw new NotFoundError('Factura')
  if (invoice.status !== InvoiceStatus.REJECTED) {
    throw new AppError('Solo se pueden reintentar facturas rechazadas', 400)
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.SENDING, rejectionReason: null, sentAt: new Date() },
  })

  await invoiceEmitQueue.add('emit', { invoiceId: id }, {
    jobId: `emit-${id}-retry-${Date.now()}`,
    removeOnComplete: true,
  })

  return updated
}

export async function createCreditNote(id: string, data: any) {
  const original = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, client: true },
  })
  if (!original) throw new NotFoundError('Factura original')
  if (original.status !== InvoiceStatus.APPROVED && original.status !== InvoiceStatus.PAID) {
    throw new AppError('Solo se pueden crear notas de crédito para facturas aprobadas o pagadas', 400)
  }

  const count = await prisma.invoice.count({ where: { businessUnit: original.businessUnit } })
  const prefix = original.businessUnit === 'HAX' ? 'H' : 'K'
  const number = `${prefix}-${String(count + 1).padStart(6, '0')}`

  const items = data.items ?? original.items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    taxRate: i.taxRate,
    taxAmount: i.taxAmount,
    subtotal: i.subtotal,
    total: i.total,
    isExempt: i.isExempt,
    sortOrder: i.sortOrder,
  }))

  const subtotal: number = items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0)
  const taxAmount: number = items.reduce((s: number, i: any) => s + (i.taxAmount ?? 0), 0)
  const total = subtotal + taxAmount

  return prisma.invoice.create({
    data: {
      number,
      clientId: original.clientId,
      businessUnit: original.businessUnit,
      type: 'NOTA_CREDITO',
      status: InvoiceStatus.DRAFT,
      issueDate: new Date(),
      subtotal,
      taxAmount,
      total,
      amountDue: total,
      originalInvoiceId: id,
      notes: data.notes ?? `Nota de crédito para factura ${original.number}`,
      items: {
        create: items.map((item: any, idx: number) => ({ ...item, sortOrder: idx })),
      },
    },
    include: { client: true, items: { orderBy: { sortOrder: 'asc' } } },
  })
}

export async function getInvoiceStats(businessUnit?: BusinessUnit) {
  const where: any = businessUnit ? { businessUnit } : {}
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [total, byStatus, monthRevenue, overdue] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.groupBy({ by: ['status'], where, _count: true, _sum: { total: true } }),
    prisma.invoice.aggregate({
      where: { ...where, issueDate: { gte: monthStart }, status: { not: InvoiceStatus.CANCELLED } },
      _sum: { total: true, amountPaid: true },
    }),
    prisma.invoice.count({
      where: {
        ...where,
        paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
        dueDate: { lt: now },
        status: { not: InvoiceStatus.CANCELLED },
      },
    }),
  ])

  return {
    total,
    byStatus,
    monthRevenue: monthRevenue._sum.total ?? 0,
    monthCollected: monthRevenue._sum.amountPaid ?? 0,
    overdue,
  }
}
