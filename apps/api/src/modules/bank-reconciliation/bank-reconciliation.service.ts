import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'

export async function listReconciliations() {
  return prisma.bankReconciliation.findMany({
    orderBy: { period: 'desc' },
    include: {
      bankAccount: { select: { id: true, name: true, bank: true, accountNumber: true } },
      _count: { select: { transactions: true } },
    },
  })
}

export async function getReconciliation(id: string) {
  const rec = await prisma.bankReconciliation.findUnique({
    where: { id },
    include: {
      bankAccount: { select: { id: true, name: true, bank: true, accountNumber: true } },
      transactions: { orderBy: { txDate: 'asc' } },
    },
  })
  if (!rec) throw new NotFoundError('Conciliación bancaria')
  return rec
}

export async function createReconciliation(bankAccountId: string, period: string, notes?: string) {
  // Validate period format YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new AppError('El período debe tener el formato YYYY-MM', 400)
  }

  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } })
  if (!bankAccount) throw new NotFoundError('Cuenta bancaria')

  return prisma.bankReconciliation.upsert({
    where: {
      period_bankAccountId: { period, bankAccountId },
    },
    update: { notes },
    create: {
      bankAccountId,
      period,
      status: 'OPEN',
      notes,
    },
    include: {
      bankAccount: { select: { id: true, name: true, bank: true, accountNumber: true } },
    },
  })
}

export async function importTransactions(
  reconciliationId: string,
  transactions: { txDate: string; description: string; amount: number; reference?: string }[],
) {
  const rec = await prisma.bankReconciliation.findUnique({ where: { id: reconciliationId } })
  if (!rec) throw new NotFoundError('Conciliación bancaria')
  if (rec.status === 'CLOSED') throw new AppError('No se puede importar transacciones a una conciliación cerrada', 400)

  const created: any[] = []

  for (const tx of transactions) {
    const txDate = new Date(tx.txDate)

    // Attempt auto-match
    let matchedPaymentId: string | undefined
    let matchedExpenseId: string | undefined
    let status: 'UNMATCHED' | 'MATCHED' = 'UNMATCHED'

    const dateFrom = new Date(txDate)
    dateFrom.setDate(dateFrom.getDate() - 3)
    const dateTo = new Date(txDate)
    dateTo.setDate(dateTo.getDate() + 3)

    if (tx.amount > 0) {
      // Credit: look for Payment in ERP with same amount ±1
      const payment = await prisma.payment.findFirst({
        where: {
          amount: { gte: tx.amount - 1, lte: tx.amount + 1 },
          paidAt: { gte: dateFrom, lte: dateTo },
        },
      })
      if (payment) {
        matchedPaymentId = payment.id
        status = 'MATCHED'
      }
    } else {
      // Debit: look for Expense matching abs(amount) ±1
      const absAmount = Math.abs(tx.amount)
      const expense = await prisma.expense.findFirst({
        where: {
          total: { gte: absAmount - 1, lte: absAmount + 1 },
          expenseDate: { gte: dateFrom, lte: dateTo },
        },
      })
      if (expense) {
        matchedExpenseId = expense.id
        status = 'MATCHED'
      }
    }

    const row = await prisma.reconciliationTx.create({
      data: {
        reconciliationId,
        txDate,
        description: tx.description,
        amount: tx.amount,
        reference: tx.reference,
        status,
        matchedPaymentId,
        matchedExpenseId,
      },
    })
    created.push(row)
  }

  const matched = created.filter((t) => t.status === 'MATCHED').length
  return { imported: created.length, matched, unmatched: created.length - matched, transactions: created }
}

export async function matchTransaction(
  txId: string,
  opts: { matchedPaymentId?: string; matchedExpenseId?: string },
) {
  const tx = await prisma.reconciliationTx.findUnique({ where: { id: txId } })
  if (!tx) throw new NotFoundError('Transacción')
  if (tx.status === 'IGNORED') throw new AppError('La transacción está ignorada', 400)

  return prisma.reconciliationTx.update({
    where: { id: txId },
    data: {
      matchedPaymentId: opts.matchedPaymentId,
      matchedExpenseId: opts.matchedExpenseId,
      status: 'MATCHED_MANUAL',
    },
  })
}

export async function ignoreTransaction(txId: string, notes: string) {
  const tx = await prisma.reconciliationTx.findUnique({ where: { id: txId } })
  if (!tx) throw new NotFoundError('Transacción')

  return prisma.reconciliationTx.update({
    where: { id: txId },
    data: { status: 'IGNORED', notes },
  })
}

export async function closeReconciliation(id: string, userId: string) {
  const rec = await prisma.bankReconciliation.findUnique({
    where: { id },
    include: { transactions: true },
  })
  if (!rec) throw new NotFoundError('Conciliación bancaria')
  if (rec.status === 'CLOSED') throw new AppError('La conciliación ya está cerrada', 400)

  const unmatched = rec.transactions.filter((t) => t.status === 'UNMATCHED')
  if (unmatched.length > 0) {
    throw new AppError(
      `No se puede cerrar la conciliación: hay ${unmatched.length} transacción(es) sin conciliar`,
      400,
    )
  }

  return prisma.bankReconciliation.update({
    where: { id },
    data: { status: 'CLOSED', closedById: userId, closedAt: new Date() },
  })
}
