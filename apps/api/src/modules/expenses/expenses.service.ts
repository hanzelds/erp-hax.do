import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { ExpenseStatus, BusinessUnit } from '@prisma/client'

/** Load account codes from DB config at runtime */
async function getExpenseAcctCodes() {
  const cfg = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  return {
    GENERAL:   cfg?.acctExpenseGeneral    ?? '5101',
    SALARIES:  cfg?.acctExpenseSalaries   ?? '5102',
    MARKETING: cfg?.acctExpenseMarketing  ?? '5103',
    SUPPLIERS: cfg?.acctPayablesSuppliers ?? '2101',
    BANK:      cfg?.acctBank              ?? '1102',
  }
}

/** Map expense category → code key */
function categoryToKey(category: string): 'GENERAL' | 'SALARIES' | 'MARKETING' {
  if (category === 'SALARIES')  return 'SALARIES'
  if (category === 'MARKETING') return 'MARKETING'
  return 'GENERAL'
}

async function autoJournalEntry(opts: {
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE'
  businessUnit: 'HAX' | 'KODER'
  description: string
  debitCode: string
  creditCode: string
  amount: number
  expenseId?: string
  period: string
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
      expenseId: opts.expenseId,
    },
  })
}

export async function listExpenses(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.status) where.status = query.status
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.category) where.category = query.category
  if (query.supplierId) where.supplierId = query.supplierId
  if (query.search) {
    where.OR = [
      { supplier: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
      { ncf: { contains: query.search, mode: 'insensitive' } },
    ]
  }
  if (query.from || query.to) {
    where.expenseDate = {}
    if (query.from) where.expenseDate.gte = new Date(query.from)
    if (query.to) where.expenseDate.lte = new Date(query.to)
  }

  const [data, total] = await Promise.all([
    prisma.expense.findMany({
      where, skip, take: limit, orderBy: { expenseDate: 'desc' },
      include: { supplierRef: { select: { id: true, name: true, rnc: true } } },
    }),
    prisma.expense.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getExpense(id: string) {
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { supplierRef: true },
  })
  if (!expense) throw new NotFoundError('Gasto')
  return expense
}

export async function createExpense(data: any) {
  const total = (data.amount ?? 0) + (data.taxAmount ?? 0)
  // Normalize expenseDate: convert YYYY-MM-DD string to Date object
  if (!data.expenseDate) delete data.expenseDate
  else data.expenseDate = new Date(data.expenseDate)
  return prisma.expense.create({ data: { ...data, total } })
}

export async function updateExpense(id: string, data: any) {
  const expense = await prisma.expense.findUnique({ where: { id } })
  if (!expense) throw new NotFoundError('Gasto')
  if (expense.status === ExpenseStatus.PAID) throw new AppError('No se puede editar un gasto pagado', 400)
  const total = ((data.amount ?? expense.amount) + (data.taxAmount ?? expense.taxAmount))
  if (!data.expenseDate) delete data.expenseDate
  else data.expenseDate = new Date(data.expenseDate)
  return prisma.expense.update({ where: { id }, data: { ...data, total } })
}

export async function approveExpense(id: string) {
  const expense = await prisma.expense.findUnique({ where: { id } })
  if (!expense) throw new NotFoundError('Gasto')
  if (expense.status !== ExpenseStatus.DRAFT) throw new AppError('Solo se pueden aprobar gastos en DRAFT', 400)

  const updated = await prisma.expense.update({ where: { id }, data: { status: ExpenseStatus.APPROVED, approvedAt: new Date() } })

  // Auto journal entry: Dr acctExpense* / Cr acctPayablesSuppliers
  const config = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (config?.autoJournalEntries) {
    const codes  = await getExpenseAcctCodes()
    const date   = expense.expenseDate ?? new Date()
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    // Use accountCode from expense if set, otherwise fall back to category mapping
    const debitCode = (expense as any).accountCode ?? codes[categoryToKey(expense.category)]
    await autoJournalEntry({
      type: 'INVOICE',
      businessUnit: expense.businessUnit as 'HAX' | 'KODER',
      description: `Gasto registrado: ${expense.description}`,
      debitCode,
      creditCode: codes.SUPPLIERS,
      amount: expense.total,
      expenseId: id,
      period,
    })
  }

  return updated
}

export async function markPaid(id: string) {
  const expense = await prisma.expense.findUnique({ where: { id } })
  if (!expense) throw new NotFoundError('Gasto')
  if (expense.status !== ExpenseStatus.APPROVED) throw new AppError('Solo se pueden pagar gastos APPROVED', 400)

  const updated = await prisma.expense.update({ where: { id }, data: { status: ExpenseStatus.PAID, paidAt: new Date() } })

  // Auto journal entry: Dr acctPayablesSuppliers / Cr acctBank
  const config = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (config?.autoJournalEntries) {
    const codes  = await getExpenseAcctCodes()
    const date   = expense.paidAt ?? new Date()
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    await autoJournalEntry({
      type: 'PAYMENT',
      businessUnit: expense.businessUnit as 'HAX' | 'KODER',
      description: `Pago gasto: ${expense.description}`,
      debitCode: codes.SUPPLIERS,
      creditCode: codes.BANK,
      amount: expense.total,
      expenseId: id,
      period,
    })
  }

  return updated
}

export async function deleteExpense(id: string) {
  const expense = await prisma.expense.findUnique({ where: { id } })
  if (!expense) throw new NotFoundError('Gasto')
  if (expense.status === ExpenseStatus.PAID) throw new AppError('No se puede eliminar un gasto pagado', 400)
  return prisma.expense.update({ where: { id }, data: { status: ExpenseStatus.CANCELLED } })
}

export async function getExpenseStats(businessUnit?: BusinessUnit) {
  const where: any = businessUnit ? { businessUnit } : {}
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [total, byCategory, monthTotal] = await Promise.all([
    prisma.expense.aggregate({ where, _sum: { total: true }, _count: true }),
    prisma.expense.groupBy({ by: ['category'], where, _sum: { total: true }, _count: true }),
    prisma.expense.aggregate({
      where: { ...where, expenseDate: { gte: monthStart }, status: { not: ExpenseStatus.CANCELLED } },
      _sum: { total: true },
    }),
  ])
  return { totalCount: total._count, totalAmount: total._sum.total ?? 0, byCategory, monthTotal: monthTotal._sum.total ?? 0 }
}
