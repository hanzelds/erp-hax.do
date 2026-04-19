import { prisma } from '../../config/database'
import { AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'

export async function getChartOfAccounts() {
  const accounts = await prisma.account.findMany({ orderBy: { code: 'asc' } })

  // Compute running balance across ALL periods (cumulative)
  const result = await Promise.all(
    accounts.map(async (account) => {
      const [debitTotal, creditTotal] = await Promise.all([
        prisma.journalEntry.aggregate({ where: { debitAccountId: account.id }, _sum: { amount: true } }),
        prisma.journalEntry.aggregate({ where: { creditAccountId: account.id }, _sum: { amount: true } }),
      ])
      const debit = debitTotal._sum.amount ?? 0
      const credit = creditTotal._sum.amount ?? 0
      // For assets/expenses: debit balance; for liabilities/income: credit balance
      const balance = ['ASSET', 'EXPENSE'].includes(account.type) ? debit - credit : credit - debit
      return { ...account, debitTotal: debit, creditTotal: credit, balance }
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
      where.OR = [{ debitAccountId: account.id }, { creditAccountId: account.id }]
    }
  }

  const [data, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        debitAccount:  { select: { code: true, name: true } },
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

  const where: any = { OR: [{ debitAccountId: account.id }, { creditAccountId: account.id }] }
  if (period) where.period = period

  const entries = await prisma.journalEntry.findMany({
    where, orderBy: { createdAt: 'asc' },
    include: {
      debitAccount:  { select: { code: true, name: true } },
      creditAccount: { select: { code: true, name: true } },
    },
  })

  let balance = 0
  const ledger = entries.map((entry) => {
    const isDebit = entry.debitAccountId === account.id
    const debit   = isDebit ? entry.amount : 0
    const credit  = isDebit ? 0 : entry.amount
    balance += debit - credit
    return { ...entry, debit, credit, balance }
  })

  return { account, entries: ledger }
}

export async function getTrialBalance(period: string) {
  const accounts = await prisma.account.findMany({ orderBy: { code: 'asc' } })

  const lines = await Promise.all(
    accounts.map(async (account) => {
      const [debitAgg, creditAgg] = await Promise.all([
        prisma.journalEntry.aggregate({ where: { debitAccountId: account.id, period }, _sum: { amount: true } }),
        prisma.journalEntry.aggregate({ where: { creditAccountId: account.id, period }, _sum: { amount: true } }),
      ])
      const totalDebit  = debitAgg._sum.amount  ?? 0
      const totalCredit = creditAgg._sum.amount ?? 0
      const balance     = totalDebit - totalCredit
      return {
        accountCode: account.code,
        accountName: account.name,
        type:        account.type,
        totalDebit,
        totalCredit,
        balance,
      }
    }),
  )

  // Only return accounts with activity
  const activeLines = lines.filter((l) => l.totalDebit > 0 || l.totalCredit > 0)
  const totalDebit  = activeLines.reduce((s, r) => s + r.totalDebit, 0)
  const totalCredit = activeLines.reduce((s, r) => s + r.totalCredit, 0)

  return { period, lines: activeLines, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 }
}

export async function getBalanceSheet(upToPeriod?: string) {
  const accounts = await prisma.account.findMany({ orderBy: { code: 'asc' } })

  const balances = await Promise.all(
    accounts.map(async (account) => {
      const periodFilter = upToPeriod ? { period: { lte: upToPeriod } } : {}
      const [debitAgg, creditAgg] = await Promise.all([
        prisma.journalEntry.aggregate({ where: { debitAccountId: account.id, ...periodFilter }, _sum: { amount: true } }),
        prisma.journalEntry.aggregate({ where: { creditAccountId: account.id, ...periodFilter }, _sum: { amount: true } }),
      ])
      const debit  = debitAgg._sum.amount  ?? 0
      const credit = creditAgg._sum.amount ?? 0
      const balance = ['ASSET', 'EXPENSE'].includes(account.type) ? debit - credit : credit - debit
      return { ...account, balance }
    }),
  )

  const assets      = balances.filter((a) => a.type === 'ASSET' && a.balance !== 0)
  const liabilities = balances.filter((a) => a.type === 'LIABILITY' && a.balance !== 0)
  const equity      = balances.filter((a) => a.type === 'EQUITY' && a.balance !== 0)

  const totalAssets      = assets.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0)
  const totalEquity      = equity.reduce((s, a) => s + a.balance, 0)
  const netWorth         = totalAssets - totalLiabilities

  return {
    asOfPeriod: upToPeriod,
    assets: { items: assets, total: totalAssets },
    liabilities: { items: liabilities, total: totalLiabilities },
    equity: { items: equity, total: totalEquity, netWorth },
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + netWorth - totalEquity)) < 1,
  }
}

export async function getPnL(period: string, businessUnit?: string) {
  const accounts = await prisma.account.findMany({ orderBy: { code: 'asc' } })
  const buFilter = businessUnit ? { businessUnit: businessUnit as any } : {}

  const balances = await Promise.all(
    accounts.map(async (account) => {
      const [debitAgg, creditAgg] = await Promise.all([
        prisma.journalEntry.aggregate({ where: { debitAccountId: account.id, period, ...buFilter }, _sum: { amount: true } }),
        prisma.journalEntry.aggregate({ where: { creditAccountId: account.id, period, ...buFilter }, _sum: { amount: true } }),
      ])
      const debit  = debitAgg._sum.amount  ?? 0
      const credit = creditAgg._sum.amount ?? 0
      const balance = ['ASSET', 'EXPENSE'].includes(account.type) ? debit - credit : credit - debit
      return { ...account, balance }
    }),
  )

  const incomeAccounts  = balances.filter((a) => a.type === 'INCOME'  && a.balance !== 0)
  const expenseAccounts = balances.filter((a) => a.type === 'EXPENSE' && a.balance !== 0)

  const totalRevenue  = incomeAccounts.reduce((s, a) => s + a.balance, 0)
  const totalExpenses = expenseAccounts.reduce((s, a) => s + a.balance, 0)
  const netIncome     = totalRevenue - totalExpenses
  const netMargin     = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0

  return {
    period,
    businessUnit: businessUnit ?? 'ALL',
    income:   { items: incomeAccounts,  total: totalRevenue },
    expenses: { items: expenseAccounts, total: totalExpenses },
    netIncome,
    netMargin: parseFloat(netMargin.toFixed(2)),
  }
}

export async function getMargins(year: number, businessUnit?: string) {
  const buFilter = businessUnit ? { businessUnit: businessUnit as any } : {}
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  const rows = await Promise.all(
    months.map(async (month) => {
      const period = `${year}-${String(month).padStart(2, '0')}`
      const accounts = await prisma.account.findMany({ where: { type: { in: ['INCOME', 'EXPENSE'] } } })

      const data = await Promise.all(
        accounts.map(async (acc) => {
          const [d, c] = await Promise.all([
            prisma.journalEntry.aggregate({ where: { debitAccountId: acc.id, period, ...buFilter }, _sum: { amount: true } }),
            prisma.journalEntry.aggregate({ where: { creditAccountId: acc.id, period, ...buFilter }, _sum: { amount: true } }),
          ])
          const balance = acc.type === 'EXPENSE' ? (d._sum.amount ?? 0) - (c._sum.amount ?? 0) : (c._sum.amount ?? 0) - (d._sum.amount ?? 0)
          return { type: acc.type, balance }
        }),
      )

      const revenue  = data.filter((a) => a.type === 'INCOME').reduce((s, a) => s + a.balance, 0)
      const expenses = data.filter((a) => a.type === 'EXPENSE').reduce((s, a) => s + a.balance, 0)
      const net      = revenue - expenses
      return {
        period,
        month,
        revenue,
        expenses,
        net,
        margin: revenue > 0 ? parseFloat(((net / revenue) * 100).toFixed(2)) : 0,
      }
    }),
  )

  const totalRevenue  = rows.reduce((s, r) => s + r.revenue, 0)
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0)
  const totalNet      = totalRevenue - totalExpenses

  return {
    year,
    businessUnit: businessUnit ?? 'ALL',
    monthly: rows.filter((r) => r.revenue > 0 || r.expenses > 0),
    ytd: {
      revenue:  totalRevenue,
      expenses: totalExpenses,
      net:      totalNet,
      margin:   totalRevenue > 0 ? parseFloat(((totalNet / totalRevenue) * 100).toFixed(2)) : 0,
    },
  }
}

export async function getFiscalPeriods() {
  const periods = await prisma.fiscalPeriod.findMany({ orderBy: { period: 'desc' } })

  // Enrich with entry counts
  const enriched = await Promise.all(
    periods.map(async (p) => {
      const [entryCount, debitAgg] = await Promise.all([
        prisma.journalEntry.count({ where: { period: p.period } }),
        prisma.journalEntry.aggregate({ where: { period: p.period }, _sum: { amount: true } }),
      ])
      return {
        ...p,
        status: p.isClosed ? 'CLOSED' : 'OPEN',
        entryCount,
        totalDebit: debitAgg._sum.amount ?? 0,
      }
    }),
  )
  return enriched
}

export async function closePeriod(period: string, userId: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) throw new AppError('El período debe tener el formato YYYY-MM', 400)

  const existing = await prisma.fiscalPeriod.findUnique({ where: { period } })
  if (existing?.isClosed) throw new AppError(`El período ${period} ya está cerrado`, 400)

  return prisma.fiscalPeriod.upsert({
    where:  { period },
    update: { isClosed: true, closedAt: new Date(), closedBy: userId },
    create: { period, isClosed: true, closedAt: new Date(), closedBy: userId },
  })
}

// ── ITBIS Periods ─────────────────────────────────────────────

function getITBISDueDate(year: number, month: number): Date {
  // Due date: 20th of following month
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear  = month === 12 ? year + 1 : year
  return new Date(nextYear, nextMonth - 1, 20)
}

export async function listItbisPeriods() {
  return prisma.iTBISPeriod.findMany({ orderBy: { period: 'desc' } })
}

export async function getOrCreateItbisPeriod(period: string) {
  // period format: "202501"
  if (!/^\d{6}$/.test(period)) throw new AppError('Formato de período ITBIS debe ser YYYYMM', 400)

  const year  = parseInt(period.slice(0, 4))
  const month = parseInt(period.slice(4, 6))

  const existing = await prisma.iTBISPeriod.findUnique({ where: { period } })
  if (existing) return existing

  const startDate = new Date(year, month - 1, 1)
  const endDate   = new Date(year, month, 0)
  const dueDate   = getITBISDueDate(year, month)

  return prisma.iTBISPeriod.create({
    data: { period, year, month, startDate, endDate, dueDate },
  })
}

export async function calculateItbisPeriod(period: string) {
  if (!/^\d{6}$/.test(period)) throw new AppError('Formato de período ITBIS debe ser YYYYMM', 400)

  const year   = parseInt(period.slice(0, 4))
  const month  = parseInt(period.slice(4, 6))
  const dbPeriod = `${year}-${String(month).padStart(2, '0')}`

  // Get ITBIS accrued account (2201)
  const itbisAccount = await prisma.account.findUnique({ where: { code: '2201' } })

  let totalSalesItbis     = 0
  let totalPurchasesItbis = 0

  if (itbisAccount) {
    // Sales ITBIS: credits to 2201
    const salesAgg = await prisma.journalEntry.aggregate({
      where: { creditAccountId: itbisAccount.id, period: dbPeriod },
      _sum: { amount: true },
    })
    totalSalesItbis = salesAgg._sum.amount ?? 0

    // Purchases ITBIS: from expenses with taxAmount
    const expenses = await prisma.expense.aggregate({
      where: {
        expenseDate: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0, 23, 59, 59),
        },
        status: { not: 'CANCELLED' },
      },
      _sum: { taxAmount: true },
    })
    totalPurchasesItbis = expenses._sum.taxAmount ?? 0
  }

  // Get previous period carry forward
  const prevPeriodNum = month === 1
    ? `${year - 1}12`
    : `${year}${String(month - 1).padStart(2, '0')}`
  const prevPeriod = await prisma.iTBISPeriod.findUnique({ where: { period: prevPeriodNum } })
  const prevCarryForward = prevPeriod?.carryForwardBalance ?? 0

  const deductibleItbis = totalPurchasesItbis
  const grossPayable    = totalSalesItbis - deductibleItbis - prevCarryForward
  const payableItbis    = Math.max(0, grossPayable)
  const carryForwardBalance = grossPayable < 0 ? Math.abs(grossPayable) : 0

  const startDate = new Date(year, month - 1, 1)
  const endDate   = new Date(year, month, 0)
  const dueDate   = getITBISDueDate(year, month)

  return prisma.iTBISPeriod.upsert({
    where: { period },
    update: {
      status: 'PRE_CLOSED',
      totalSalesItbis,
      totalPurchasesItbis,
      deductibleItbis,
      payableItbis,
      carryForwardBalance,
      prevCarryForward,
    },
    create: {
      period, year, month, startDate, endDate, dueDate,
      status: 'PRE_CLOSED',
      totalSalesItbis, totalPurchasesItbis, deductibleItbis,
      payableItbis, carryForwardBalance, prevCarryForward,
    },
  })
}

export async function fileItbisPeriod(period: string) {
  const p = await prisma.iTBISPeriod.findUnique({ where: { period } })
  if (!p) throw new AppError('Período ITBIS no encontrado', 404)
  if (p.status !== 'PRE_CLOSED') throw new AppError('Calcule el período antes de declarar', 400)

  return prisma.iTBISPeriod.update({
    where: { period },
    data: { status: 'FILED', declaredAt: new Date() },
  })
}

export async function payItbisPeriod(period: string) {
  const p = await prisma.iTBISPeriod.findUnique({ where: { period } })
  if (!p) throw new AppError('Período ITBIS no encontrado', 404)
  if (p.status !== 'FILED') throw new AppError('Declare el período antes de pagar', 400)

  return prisma.iTBISPeriod.update({
    where: { period },
    data: { status: 'PAID', paidAt: new Date() },
  })
}

export async function checkOverduePeriods() {
  const now = new Date()
  const updated = await prisma.iTBISPeriod.updateMany({
    where: { status: 'OPEN', dueDate: { lt: now } },
    data: { status: 'OVERDUE' },
  })
  return { marked: updated.count }
}
