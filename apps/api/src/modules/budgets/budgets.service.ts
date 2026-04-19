import { prisma } from '../../config/database'
import { NotFoundError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { ExpenseStatus } from '@prisma/client'

export async function listBudgets(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.period) where.period = query.period

  const [data, total] = await Promise.all([
    prisma.budget.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ period: 'desc' }, { businessUnit: 'asc' }, { category: 'asc' }],
    }),
    prisma.budget.count({ where }),
  ])

  return { data, total, page, limit }
}

export async function createBudget(data: any) {
  return prisma.budget.upsert({
    where: {
      businessUnit_period_category: {
        businessUnit: data.businessUnit,
        period: data.period,
        category: data.category,
      },
    },
    update: {
      amountBudgeted: data.amountBudgeted,
    },
    create: {
      businessUnit: data.businessUnit,
      period: data.period,
      category: data.category,
      amountBudgeted: data.amountBudgeted,
      amountExecuted: 0,
      status: 'ON_TRACK',
    },
  })
}

export async function updateBudget(id: string, data: any) {
  const budget = await prisma.budget.findUnique({ where: { id } })
  if (!budget) throw new NotFoundError('Presupuesto')

  const updateData: any = {}
  if (data.amountBudgeted !== undefined) updateData.amountBudgeted = data.amountBudgeted
  if (data.amountExecuted !== undefined) updateData.amountExecuted = data.amountExecuted

  if (updateData.amountExecuted !== undefined || updateData.amountBudgeted !== undefined) {
    const executed = updateData.amountExecuted ?? budget.amountExecuted
    const budgeted = updateData.amountBudgeted ?? budget.amountBudgeted
    const ratio = budgeted > 0 ? executed / budgeted : 0
    updateData.status = ratio >= 1 ? 'EXCEEDED' : ratio >= 0.8 ? 'ALERT' : 'ON_TRACK'
  }

  return prisma.budget.update({ where: { id }, data: updateData })
}

export async function syncBudgetExecution(period: string, businessUnit: string) {
  // Parse period to date range
  const [year, month] = period.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)

  // Get all budgets for this period and BU
  const budgets = await prisma.budget.findMany({
    where: { period, businessUnit: businessUnit as any },
  })

  const results: any[] = []

  for (const budget of budgets) {
    // Sum expenses for this category, period, and BU
    const agg = await prisma.expense.aggregate({
      where: {
        businessUnit: businessUnit as any,
        category: budget.category as any,
        expenseDate: { gte: start, lte: end },
        status: { not: ExpenseStatus.CANCELLED },
      },
      _sum: { total: true },
    })

    const amountExecuted = (agg._sum as any)?.total ?? 0
    const ratio = budget.amountBudgeted > 0 ? amountExecuted / budget.amountBudgeted : 0
    const status = ratio >= 1 ? 'EXCEEDED' : ratio >= 0.8 ? 'ALERT' : 'ON_TRACK'

    const updated = await prisma.budget.update({
      where: { id: budget.id },
      data: { amountExecuted, status: status as any },
    })

    results.push(updated)
  }

  return { period, businessUnit, synced: results.length, budgets: results }
}

export async function getBudgetSummary(period: string) {
  const [hax, koder] = await Promise.all([
    prisma.budget.findMany({ where: { period, businessUnit: 'HAX' } }),
    prisma.budget.findMany({ where: { period, businessUnit: 'KODER' } }),
  ])

  function summarize(budgets: typeof hax) {
    return {
      totalBudgeted: budgets.reduce((s, b) => s + b.amountBudgeted, 0),
      totalExecuted: budgets.reduce((s, b) => s + b.amountExecuted, 0),
      byCategory: budgets.map((b) => ({
        category: b.category,
        amountBudgeted: b.amountBudgeted,
        amountExecuted: b.amountExecuted,
        status: b.status,
        utilizationPct: b.amountBudgeted > 0 ? (b.amountExecuted / b.amountBudgeted) * 100 : 0,
      })),
    }
  }

  return { period, HAX: summarize(hax), KODER: summarize(koder) }
}
