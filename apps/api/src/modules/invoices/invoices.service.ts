import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { InvoiceStatus, PaymentStatus, BusinessUnit } from '@prisma/client'

function generateInvoiceNumber(bu: string, count: number) {
  const prefix = bu === 'HAX' ? 'H' : 'K'
  return `${prefix}-${String(count + 1).padStart(6, '0')}`
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

  const { items, ...invoiceData } = data
  const subtotal: number = items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0)
  const taxAmount: number = items.reduce((s: number, i: any) => s + (i.taxAmount ?? 0), 0)
  const total = subtotal + taxAmount

  return prisma.invoice.create({
    data: {
      ...invoiceData,
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
  return prisma.invoice.update({
    where: { id },
    data: { status: InvoiceStatus.CANCELLED, cancelledAt: new Date() },
  })
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

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId,
        amount,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
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
  return payment
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
