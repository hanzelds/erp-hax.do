import { prisma } from '../../config/database'
import { NotFoundError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { RecurringFrequency } from '@prisma/client'
import { addWeeks, addMonths, addQuarters, addYears } from 'date-fns'

function nextDate(current: Date, freq: RecurringFrequency): Date {
  switch (freq) {
    case RecurringFrequency.WEEKLY:    return addWeeks(current, 1)
    case RecurringFrequency.BIWEEKLY:  return addWeeks(current, 2)
    case RecurringFrequency.MONTHLY:   return addMonths(current, 1)
    case RecurringFrequency.QUARTERLY: return addQuarters(current, 1)
    case RecurringFrequency.YEARLY:    return addYears(current, 1)
  }
}

export async function listRecurring(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.isActive !== undefined) where.isActive = query.isActive === 'true'

  const now = new Date()
  const [data, total, overdue] = await Promise.all([
    prisma.recurringPayment.findMany({ where, skip, take: limit, orderBy: { nextDueDate: 'asc' } }),
    prisma.recurringPayment.count({ where }),
    prisma.recurringPayment.count({ where: { ...where, isActive: true, nextDueDate: { lt: now } } }),
  ])
  return { data, total, page, limit, overdue }
}

export async function getRecurring(id: string) {
  const rp = await prisma.recurringPayment.findUnique({ where: { id } })
  if (!rp) throw new NotFoundError('Pago recurrente')
  return rp
}

export async function createRecurring(data: any) {
  return prisma.recurringPayment.create({ data })
}

export async function updateRecurring(id: string, data: any) {
  const rp = await prisma.recurringPayment.findUnique({ where: { id } })
  if (!rp) throw new NotFoundError('Pago recurrente')
  return prisma.recurringPayment.update({ where: { id }, data })
}

export async function payRecurring(id: string) {
  const rp = await prisma.recurringPayment.findUnique({ where: { id } })
  if (!rp) throw new NotFoundError('Pago recurrente')

  const newNextDue = nextDate(rp.nextDueDate, rp.frequency)

  // Auto-generate expense
  const [updated, expense] = await prisma.$transaction([
    prisma.recurringPayment.update({
      where: { id },
      data: { lastPaidAt: new Date(), nextDueDate: newNextDue },
    }),
    prisma.expense.create({
      data: {
        businessUnit: rp.businessUnit,
        supplier: rp.supplier,
        description: `${rp.name} — ${rp.nextDueDate.toISOString().slice(0, 7)}`,
        amount: rp.amount,
        taxAmount: 0,
        total: rp.amount,
        category: rp.category,
        status: 'APPROVED',
        expenseDate: new Date(),
      },
    }),
  ])
  return { recurringPayment: updated, expense }
}

export async function deleteRecurring(id: string) {
  const rp = await prisma.recurringPayment.findUnique({ where: { id } })
  if (!rp) throw new NotFoundError('Pago recurrente')
  return prisma.recurringPayment.update({ where: { id }, data: { isActive: false } })
}
