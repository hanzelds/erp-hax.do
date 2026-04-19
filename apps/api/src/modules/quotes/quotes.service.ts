import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { BusinessUnit, QuoteStatus } from '@prisma/client'

function generateQuoteNumber(bu: string, count: number) {
  const prefix = bu === 'HAX' ? 'COT-H' : 'COT-K'
  return `${prefix}-${String(count + 1).padStart(5, '0')}`
}

export async function listQuotes(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.status) where.status = query.status
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.clientId) where.clientId = query.clientId
  if (query.search) {
    where.OR = [
      { number: { contains: query.search, mode: 'insensitive' } },
      { client: { name: { contains: query.search, mode: 'insensitive' } } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.quote.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, rnc: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.quote.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getQuote(id: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      items: { orderBy: { sortOrder: 'asc' } },
      invoice: { select: { id: true, number: true, status: true } },
    },
  })
  if (!quote) throw new NotFoundError('Cotización')
  return quote
}

export async function createQuote(data: any) {
  const count = await prisma.quote.count({ where: { businessUnit: data.businessUnit } })
  const number = generateQuoteNumber(data.businessUnit, count)

  const { items = [], ...quoteData } = data

  const subtotal: number = items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0)
  const taxAmount: number = items.reduce((s: number, i: any) => {
    if (i.isExempt) return s
    return s + (i.quantity * i.unitPrice * (i.taxRate ?? 0.18))
  }, 0)
  const total = subtotal + taxAmount

  return prisma.quote.create({
    data: {
      ...quoteData,
      number,
      subtotal,
      taxAmount,
      total,
      status: QuoteStatus.DRAFT,
      validUntil: quoteData.validUntil ? new Date(quoteData.validUntil) : null,
      items: {
        create: items.map((item: any, idx: number) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate ?? 0.18,
          taxAmount: item.isExempt ? 0 : item.quantity * item.unitPrice * (item.taxRate ?? 0.18),
          subtotal: item.quantity * item.unitPrice,
          total: item.quantity * item.unitPrice * (1 + (item.isExempt ? 0 : (item.taxRate ?? 0.18))),
          isExempt: item.isExempt ?? false,
          sortOrder: idx,
        })),
      },
    },
    include: { client: true, items: { orderBy: { sortOrder: 'asc' } } },
  })
}

export async function updateQuote(id: string, data: any) {
  const quote = await prisma.quote.findUnique({ where: { id } })
  if (!quote) throw new NotFoundError('Cotización')
  if (quote.status === QuoteStatus.CONVERTED) throw new AppError('No se puede editar una cotización ya convertida', 400)

  const { items, ...quoteData } = data

  if (items) {
    await prisma.quoteItem.deleteMany({ where: { quoteId: id } })
    const subtotal: number = items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0)
    const taxAmount: number = items.reduce((s: number, i: any) => {
      if (i.isExempt) return s
      return s + (i.quantity * i.unitPrice * (i.taxRate ?? 0.18))
    }, 0)
    const total = subtotal + taxAmount

    return prisma.quote.update({
      where: { id },
      data: {
        ...quoteData,
        subtotal,
        taxAmount,
        total,
        validUntil: quoteData.validUntil ? new Date(quoteData.validUntil) : undefined,
        items: {
          create: items.map((item: any, idx: number) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate ?? 0.18,
            taxAmount: item.isExempt ? 0 : item.quantity * item.unitPrice * (item.taxRate ?? 0.18),
            subtotal: item.quantity * item.unitPrice,
            total: item.quantity * item.unitPrice * (1 + (item.isExempt ? 0 : (item.taxRate ?? 0.18))),
            isExempt: item.isExempt ?? false,
            sortOrder: idx,
          })),
        },
      },
      include: { client: true, items: { orderBy: { sortOrder: 'asc' } } },
    })
  }

  return prisma.quote.update({
    where: { id },
    data: { ...quoteData, validUntil: quoteData.validUntil ? new Date(quoteData.validUntil) : undefined },
  })
}

export async function sendQuote(id: string) {
  const quote = await prisma.quote.findUnique({ where: { id } })
  if (!quote) throw new NotFoundError('Cotización')
  if (quote.status !== QuoteStatus.DRAFT) throw new AppError('Solo se pueden enviar cotizaciones en borrador', 400)

  return prisma.quote.update({
    where: { id },
    data: { status: QuoteStatus.SENT, sentAt: new Date() },
  })
}

export async function acceptQuote(id: string) {
  const quote = await prisma.quote.findUnique({ where: { id } })
  if (!quote) throw new NotFoundError('Cotización')
  if (quote.status !== QuoteStatus.SENT && quote.status !== QuoteStatus.DRAFT) {
    throw new AppError('La cotización debe estar en borrador o enviada para aceptar', 400)
  }

  return prisma.quote.update({
    where: { id },
    data: { status: QuoteStatus.ACCEPTED, acceptedAt: new Date() },
  })
}

export async function rejectQuote(id: string, reason?: string) {
  const quote = await prisma.quote.findUnique({ where: { id } })
  if (!quote) throw new NotFoundError('Cotización')
  if (quote.status === QuoteStatus.CONVERTED) throw new AppError('Cotización ya convertida', 400)

  return prisma.quote.update({
    where: { id },
    data: { status: QuoteStatus.REJECTED, rejectedAt: new Date(), notes: reason ?? quote.notes },
  })
}

export async function convertToInvoice(id: string, invoiceData: any = {}) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: true, client: true },
  })
  if (!quote) throw new NotFoundError('Cotización')
  if (quote.status === QuoteStatus.CONVERTED) throw new AppError('Esta cotización ya fue convertida', 400)
  if (quote.status === QuoteStatus.REJECTED) throw new AppError('No se puede convertir una cotización rechazada', 400)

  const count = await prisma.invoice.count({ where: { businessUnit: quote.businessUnit } })
  const prefix = quote.businessUnit === 'HAX' ? 'H' : 'K'
  const invoiceNumber = `${prefix}-${String(count + 1).padStart(6, '0')}`

  const invoice = await prisma.invoice.create({
    data: {
      number: invoiceNumber,
      clientId: quote.clientId,
      businessUnit: quote.businessUnit,
      type: invoiceData.type ?? 'CREDITO_FISCAL',
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      total: quote.total,
      amountDue: quote.total,
      notes: quote.notes,
      fromQuoteId: quote.convertedInvoiceId ?? undefined,
      items: {
        create: quote.items.map((item, idx) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          subtotal: item.subtotal,
          total: item.total,
          isExempt: item.isExempt,
          sortOrder: idx,
        })),
      },
    },
    include: { client: true, items: true },
  })

  // Mark quote as converted and store the invoice reference
  await prisma.quote.update({
    where: { id },
    data: {
      status: QuoteStatus.CONVERTED,
      convertedAt: new Date(),
      convertedInvoiceId: invoice.id,
    },
  })

  return invoice
}

export async function getQuoteStats(businessUnit?: BusinessUnit) {
  const where: any = businessUnit ? { businessUnit } : {}
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [byStatus, monthTotal, conversionRate] = await Promise.all([
    prisma.quote.groupBy({ by: ['status'], where, _count: true, _sum: { total: true } }),
    prisma.quote.aggregate({
      where: { ...where, createdAt: { gte: monthStart } },
      _sum: { total: true }, _count: true,
    }),
    prisma.quote.count({ where: { ...where, status: QuoteStatus.CONVERTED } }),
  ])

  const totalQuotes = byStatus.reduce((s, r) => s + r._count, 0)

  return {
    byStatus,
    thisMonth: { count: monthTotal._count, total: monthTotal._sum.total ?? 0 },
    conversionRate: totalQuotes > 0 ? ((conversionRate / totalQuotes) * 100).toFixed(1) : '0.0',
  }
}
