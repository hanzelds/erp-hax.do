import { prisma } from '../../config/database'
import { parsePagination } from '../../utils/response'

export async function listPayments(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const method = query.method as string | undefined
  const from   = query.from   as string | undefined
  const to     = query.to     as string | undefined
  const bu     = query.businessUnit as string | undefined

  const where: any = { isReversed: false }
  if (method) where.method = method
  if (from || to) {
    where.paidAt = {}
    if (from) where.paidAt.gte = new Date(from)
    if (to)   where.paidAt.lte = new Date(to)
  }
  if (bu) where.invoice = { businessUnit: bu }

  const [data, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { paidAt: 'desc' },
      include: {
        invoice: {
          select: {
            id: true, number: true, businessUnit: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
  ])

  return { data, total, page, limit }
}

export async function getPaymentStats(query: any) {
  const bu = query.businessUnit as string | undefined
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const where: any = { isReversed: false }
  if (bu) where.invoice = { businessUnit: bu }

  const whereThisMonth = { ...where, paidAt: { gte: firstOfMonth } }

  const [total, totalAmount, thisMonth, thisMonthAmount, byMethod] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where, _sum: { amount: true } }),
    prisma.payment.count({ where: whereThisMonth }),
    prisma.payment.aggregate({ where: whereThisMonth, _sum: { amount: true } }),
    prisma.payment.groupBy({
      by: ['method'],
      where,
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    }),
  ])

  return {
    total,
    totalAmount: totalAmount._sum.amount ?? 0,
    thisMonth,
    thisMonthAmount: thisMonthAmount._sum.amount ?? 0,
    byMethod: byMethod.map((m) => ({
      method: m.method,
      count: m._count,
      amount: m._sum.amount ?? 0,
    })),
  }
}
