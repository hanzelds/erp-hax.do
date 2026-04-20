import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { BankTransactionType, BusinessUnit } from '@prisma/client'

export async function listAccounts(query: any) {
  const where: any = {}
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.isActive !== undefined) where.isActive = query.isActive === 'true'

  return prisma.bankAccount.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { transactions: true } } },
  })
}

export async function getAccount(id: string) {
  const account = await prisma.bankAccount.findUnique({
    where: { id },
    include: {
      transactions: { orderBy: { transactionDate: 'desc' }, take: 50 },
    },
  })
  if (!account) throw new NotFoundError('Cuenta bancaria')
  return account
}

export async function createAccount(data: any) {
  return prisma.bankAccount.create({ data })
}

export async function updateAccount(id: string, data: any) {
  const exists = await prisma.bankAccount.findUnique({ where: { id } })
  if (!exists) throw new NotFoundError('Cuenta bancaria')
  return prisma.bankAccount.update({ where: { id }, data })
}

export async function addTransaction(accountId: string, data: any) {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new NotFoundError('Cuenta bancaria')

  const amount = parseFloat(data.amount)
  const isCredit = data.type === BankTransactionType.CREDIT
  const newBalance = isCredit ? account.balance + amount : account.balance - amount

  if (!isCredit && newBalance < 0) throw new AppError('Saldo insuficiente', 400)

  const [tx] = await prisma.$transaction([
    prisma.bankTransaction.create({
      data: {
        bankAccountId: accountId,
        type: data.type,
        amount,
        balance: newBalance,
        description: data.description,
        reference: data.reference,
        transactionDate: data.transactionDate ? new Date(data.transactionDate) : new Date(),
      },
    }),
    prisma.bankAccount.update({
      where: { id: accountId },
      data: { balance: newBalance },
    }),
  ])
  return tx
}

export async function getTransactions(accountId: string, query: any) {
  const account = await prisma.bankAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new NotFoundError('Cuenta bancaria')

  const { page, limit, skip } = parsePagination(query)
  const where: any = { bankAccountId: accountId }
  if (query.type) where.type = query.type
  if (query.status) where.status = query.status

  const [data, total] = await Promise.all([
    prisma.bankTransaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.bankTransaction.count({ where }),
  ])
  return { data, total, page, limit, account }
}

export async function getAccountSummary(businessUnit?: BusinessUnit) {
  const where: any = businessUnit ? { businessUnit } : {}
  const accounts = await prisma.bankAccount.findMany({
    where: { ...where, isActive: true },
    select: { id: true, name: true, bank: true, balance: true, currency: true, businessUnit: true },
  })
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  return { accounts, totalBalance }
}
