import { prisma } from '../../config/database'
import { InvoiceStatus, ExpenseStatus, BusinessUnit } from '@prisma/client'

function periodWhere(period: string) {
  const [year, month] = period.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59)
  return { start, end }
}

export async function getDashboard(businessUnit?: BusinessUnit) {
  const buWhere: any = businessUnit ? { businessUnit } : {}
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthWhere = { ...buWhere, issueDate: { gte: monthStart } }

  const [monthRevenue, receivable, monthExpenses, overdueInvoices] = await Promise.all([
    prisma.invoice.aggregate({
      where: { ...monthWhere, status: { not: InvoiceStatus.CANCELLED } },
      _sum: { total: true, amountPaid: true },
    }),
    prisma.invoice.aggregate({
      where: { ...buWhere, paymentStatus: { in: ['PENDING', 'PARTIAL'] }, status: { not: InvoiceStatus.CANCELLED } },
      _sum: { amountDue: true },
    }),
    prisma.expense.aggregate({
      where: { ...buWhere, expenseDate: { gte: monthStart }, status: { not: ExpenseStatus.CANCELLED } },
      _sum: { total: true },
    }),
    prisma.invoice.count({
      where: { ...buWhere, paymentStatus: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: now }, status: { not: InvoiceStatus.CANCELLED } },
    }),
  ])

  return {
    monthRevenue: monthRevenue._sum.total ?? 0,
    monthCollected: monthRevenue._sum.amountPaid ?? 0,
    accountsReceivable: receivable._sum.amountDue ?? 0,
    monthExpenses: monthExpenses._sum.total ?? 0,
    overdueInvoices,
  }
}

export async function getPnL(period: string, businessUnit?: BusinessUnit) {
  const { start, end } = periodWhere(period)
  const buWhere: any = businessUnit ? { businessUnit } : {}

  const [revenue, expenses, collected] = await Promise.all([
    prisma.invoice.aggregate({
      where: { ...buWhere, issueDate: { gte: start, lte: end }, status: { not: InvoiceStatus.CANCELLED } },
      _sum: { total: true, taxAmount: true },
    }),
    prisma.expense.aggregate({
      where: { ...buWhere, expenseDate: { gte: start, lte: end }, status: { not: ExpenseStatus.CANCELLED } },
      _sum: { total: true, taxAmount: true },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: start, lte: end }, invoice: buWhere },
      _sum: { amount: true },
    }),
  ])

  const grossRevenue = revenue._sum.total ?? 0
  const totalExpenses = expenses._sum.total ?? 0
  const netIncome = grossRevenue - totalExpenses

  return {
    period,
    businessUnit,
    grossRevenue,
    totalExpenses,
    netIncome,
    collectedRevenue: collected._sum.amount ?? 0,
    taxRevenue: revenue._sum.taxAmount ?? 0,
    taxExpenses: expenses._sum.taxAmount ?? 0,
  }
}

export async function getBalanceSheet(businessUnit?: BusinessUnit) {
  const buWhere: any = businessUnit ? { businessUnit } : {}

  const [receivable, bankBalances, totalRevenue, totalExpenses] = await Promise.all([
    prisma.invoice.aggregate({
      where: { ...buWhere, paymentStatus: { in: ['PENDING', 'PARTIAL'] }, status: { not: InvoiceStatus.CANCELLED } },
      _sum: { amountDue: true },
    }),
    prisma.bankAccount.aggregate({
      where: { ...buWhere, isActive: true },
      _sum: { balance: true },
    }),
    prisma.invoice.aggregate({
      where: { ...buWhere, status: { not: InvoiceStatus.CANCELLED } },
      _sum: { amountPaid: true },
    }),
    prisma.expense.aggregate({
      where: { ...buWhere, status: { not: ExpenseStatus.CANCELLED } },
      _sum: { total: true },
    }),
  ])

  const assets = {
    cash: bankBalances._sum.balance ?? 0,
    accountsReceivable: receivable._sum.amountDue ?? 0,
    total: (bankBalances._sum.balance ?? 0) + (receivable._sum.amountDue ?? 0),
  }
  const equity = (totalRevenue._sum.amountPaid ?? 0) - (totalExpenses._sum.total ?? 0)

  return { assets, equity }
}

export async function getCashFlow(period: string, businessUnit?: BusinessUnit) {
  const { start, end } = periodWhere(period)
  const buWhere: any = businessUnit ? { businessUnit } : {}

  const [inflows, outflows] = await Promise.all([
    prisma.payment.findMany({
      where: { paidAt: { gte: start, lte: end }, invoice: buWhere },
      select: { amount: true, method: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: { ...buWhere, paidAt: { gte: start, lte: end }, status: ExpenseStatus.PAID },
      select: { total: true, category: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    }),
  ])

  const totalInflows = inflows.reduce((s, p) => s + p.amount, 0)
  const totalOutflows = outflows.reduce((s, e) => s + e.total, 0)

  return {
    period,
    totalInflows,
    totalOutflows,
    netCashFlow: totalInflows - totalOutflows,
    inflows,
    outflows,
  }
}

export async function get606(period: string, businessUnit?: BusinessUnit) {
  const { start, end } = periodWhere(period)
  const buWhere: any = businessUnit ? { businessUnit } : {}

  const expenses = await prisma.expense.findMany({
    where: { ...buWhere, expenseDate: { gte: start, lte: end }, status: { not: ExpenseStatus.CANCELLED }, ncf: { not: null } },
    include: { supplierRef: { select: { name: true, rnc: true } } },
    orderBy: { expenseDate: 'asc' },
  })

  return {
    period,
    count: expenses.length,
    totalAmount: expenses.reduce((s, e) => s + e.amount, 0),
    totalItbis: expenses.reduce((s, e) => s + e.taxAmount, 0),
    records: expenses,
  }
}

export async function get607(period: string, businessUnit?: BusinessUnit) {
  const { start, end } = periodWhere(period)
  const buWhere: any = businessUnit ? { businessUnit } : {}

  const invoices = await prisma.invoice.findMany({
    where: { ...buWhere, issueDate: { gte: start, lte: end }, status: { not: InvoiceStatus.CANCELLED }, ncf: { not: null } },
    include: { client: { select: { name: true, rnc: true } } },
    orderBy: { issueDate: 'asc' },
  })

  return {
    period,
    count: invoices.length,
    totalAmount: invoices.reduce((s, i) => s + i.total, 0),
    totalItbis: invoices.reduce((s, i) => s + i.taxAmount, 0),
    records: invoices,
  }
}
