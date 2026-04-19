import { prisma } from '../../config/database'
import { AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'

export async function getChartOfAccounts() {
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const accounts = await prisma.account.findMany({ orderBy: { code: 'asc' } })

  // For each account, compute debit/credit totals for current month
  const result = await Promise.all(
    accounts.map(async (account) => {
      const [debitTotal, creditTotal] = await Promise.all([
        prisma.journalEntry.aggregate({
          where: { debitAccountId: account.id, period },
          _sum: { amount: true },
        }),
        prisma.journalEntry.aggregate({
          where: { creditAccountId: account.id, period },
          _sum: { amount: true },
        }),
      ])
      return {
        ...account,
        debitTotal: debitTotal._sum.amount ?? 0,
        creditTotal: creditTotal._sum.amount ?? 0,
      }
    }),
  )

  return result
}

export async function getJournalEntries(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}

  if (query.period) where.period = query.period
  if (query.type) where.type = query.type
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.accountCode) {
    const account = await prisma.account.findUnique({ where: { code: query.accountCode } })
    if (account) {
      where.OR = [
        { debitAccountId: account.id },
        { creditAccountId: account.id },
      ]
    }
  }

  const [data, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        debitAccount: { select: { code: true, name: true } },
        creditAccount: { select: { code: true, name: true } },
      },
    }),
    prisma.journalEntry.count({ where }),
  ])

  return { data, total, page, limit }
}

export async function getLedger(accountCode: string, period?: string) {
  const account = await prisma.account.findUnique({ where: { code: accountCode } })
  if (!account) throw new AppError(`Cuenta ${accountCode} no encontrada`, 404)

  const where: any = {
    OR: [
      { debitAccountId: account.id },
      { creditAccountId: account.id },
    ],
  }
  if (period) where.period = period

  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      debitAccount: { select: { code: true, name: true } },
      creditAccount: { select: { code: true, name: true } },
    },
  })

  // Compute running balance
  let balance = 0
  const ledger = entries.map((entry) => {
    const isDebit = entry.debitAccountId === account.id
    const debit = isDebit ? entry.amount : 0
    const credit = isDebit ? 0 : entry.amount
    balance += debit - credit
    return { ...entry, debit, credit, balance }
  })

  return { account, entries: ledger }
}

export async function getTrialBalance(period: string) {
  const accounts = await prisma.account.findMany({ orderBy: { code: 'asc' } })

  const rows = await Promise.all(
    accounts.map(async (account) => {
      const [debitAgg, creditAgg] = await Promise.all([
        prisma.journalEntry.aggregate({
          where: { debitAccountId: account.id, period },
          _sum: { amount: true },
        }),
        prisma.journalEntry.aggregate({
          where: { creditAccountId: account.id, period },
          _sum: { amount: true },
        }),
      ])
      const debit = debitAgg._sum.amount ?? 0
      const credit = creditAgg._sum.amount ?? 0
      return { ...account, debit, credit, net: debit - credit }
    }),
  )

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)

  return { period, rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 }
}

export async function getFiscalPeriods() {
  return prisma.fiscalPeriod.findMany({ orderBy: { period: 'desc' } })
}

export async function closePeriod(period: string, userId: string) {
  // Validate period format YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new AppError('El período debe tener el formato YYYY-MM', 400)
  }

  const existing = await prisma.fiscalPeriod.findUnique({ where: { period } })
  if (existing?.isClosed) {
    throw new AppError(`El período ${period} ya está cerrado`, 400)
  }

  return prisma.fiscalPeriod.upsert({
    where: { period },
    update: { isClosed: true, closedAt: new Date(), closedBy: userId },
    create: { period, isClosed: true, closedAt: new Date(), closedBy: userId },
  })
}
