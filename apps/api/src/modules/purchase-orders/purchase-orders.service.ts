import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { PurchaseOrderStatus } from '@prisma/client'

async function nextPONumber(businessUnit: string) {
  const prefix = businessUnit === 'HAX' ? 'OC-H' : businessUnit === 'KODER' ? 'OC-K' : 'OC-A'
  const last = await prisma.purchaseOrder.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  })
  const lastNum = last ? parseInt(last.number.replace(`${prefix}-`, ''), 10) : 0
  return `${prefix}-${String(lastNum + 1).padStart(5, '0')}`
}

export async function listPOs(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.status) where.status = query.status
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.supplierId) where.supplierId = query.supplierId
  if (query.isCredit === 'true') where.isCredit = true
  const [data, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, rnc: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getPO(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!po) throw new NotFoundError('Orden de compra')

  let expense = null
  if (po.expenseId) {
    expense = await prisma.expense.findUnique({
      where: { id: po.expenseId },
      select: { id: true, status: true, paidAt: true, total: true, description: true },
    })
  }
  return { ...po, expense }
}

export async function createPO(data: any) {
  const { items, ...poData } = data
  const number = await nextPONumber(poData.businessUnit)
  const subtotal: number = items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0)
  const taxAmount: number = items.reduce((s: number, i: any) => s + (i.taxAmount ?? 0), 0)
  const total = subtotal + taxAmount
  return prisma.purchaseOrder.create({
    data: {
      ...poData, number, subtotal, taxAmount, total,
      items: { create: items.map((item: any, idx: number) => ({ ...item, sortOrder: idx })) },
    },
    include: { supplier: true, items: { orderBy: { sortOrder: 'asc' } } },
  })
}

export async function updatePO(id: string, data: any) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } })
  if (!po) throw new NotFoundError('Orden de compra')
  if (!([PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.SENT] as PurchaseOrderStatus[]).includes(po.status)) {
    throw new AppError('Solo se pueden editar órdenes en DRAFT o SENT', 400)
  }
  const { items, ...poData } = data
  if (items) {
    const subtotal: number = items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0)
    const taxAmount: number = items.reduce((s: number, i: any) => s + (i.taxAmount ?? 0), 0)
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } })
    return prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...poData, subtotal, taxAmount, total: subtotal + taxAmount,
        items: { create: items.map((item: any, idx: number) => ({ ...item, sortOrder: idx })) },
      },
      include: { supplier: true, items: { orderBy: { sortOrder: 'asc' } } },
    })
  }
  return prisma.purchaseOrder.update({ where: { id }, data: poData })
}

const TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus> = {
  DRAFT:     PurchaseOrderStatus.SENT,
  SENT:      PurchaseOrderStatus.CONFIRMED,
  CONFIRMED: PurchaseOrderStatus.RECEIVED,
  RECEIVED:  PurchaseOrderStatus.RECEIVED,
  CANCELLED: PurchaseOrderStatus.CANCELLED,
}

export async function advanceStatus(id: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { supplier: true } })
  if (!po) throw new NotFoundError('Orden de compra')
  if (po.status === PurchaseOrderStatus.CANCELLED) throw new AppError('OC cancelada', 400)
  if (po.status === PurchaseOrderStatus.RECEIVED)  throw new AppError('OC ya fue recibida', 400)

  const nextStatus = TRANSITIONS[po.status]
  const statusDates: any = {}
  if (nextStatus === PurchaseOrderStatus.SENT)      statusDates.sentAt      = new Date()
  if (nextStatus === PurchaseOrderStatus.CONFIRMED)  statusDates.confirmedAt = new Date()
  if (nextStatus === PurchaseOrderStatus.RECEIVED) {
    const receivedAt = new Date()
    statusDates.receivedAt = receivedAt

    if ((po as any).isCredit) {
      const terms   = (po as any).paymentTerms ?? 30
      const dueDate = new Date(receivedAt)
      dueDate.setDate(dueDate.getDate() + terms)

      const expense = await prisma.expense.create({
        data: {
          businessUnit:  po.businessUnit,
          supplierId:    po.supplierId,
          supplier:      po.supplier.name,
          description:   `OC ${po.number} — ${po.supplier.name}`,
          amount:        po.subtotal,
          taxAmount:     po.taxAmount,
          total:         po.total,
          status:        'APPROVED',
          approvedAt:    receivedAt,
          expenseDate:   receivedAt,
          category:      po.supplier.category,
          accountCode:   po.supplier.categoryCode ?? null,
          paymentMethod: 'TRANSFER',
        } as any,
      })

      const config = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
      if (config?.autoJournalEntries) {
        const period      = `${receivedAt.getFullYear()}-${String(receivedAt.getMonth() + 1).padStart(2, '0')}`
        const debitCode   = po.supplier.categoryCode ?? (config as any).acctExpenseGeneral ?? '5101'
        const creditCode  = (config as any).acctPayablesSuppliers ?? '2101'
        const [debitAcct, creditAcct] = await Promise.all([
          prisma.account.findUnique({ where: { code: debitCode } }),
          prisma.account.findUnique({ where: { code: creditCode } }),
        ])
        if (debitAcct && creditAcct) {
          await prisma.journalEntry.create({
            data: {
              type:            'INVOICE',
              businessUnit:    po.businessUnit as any,
              description:     `OC crédito ${po.number} — ${po.supplier.name}`,
              debitAccountId:  debitAcct.id,
              creditAccountId: creditAcct.id,
              amount:          po.total,
              period,
              expenseId:       expense.id,
            },
          })
        }
      }

      return prisma.purchaseOrder.update({
        where: { id },
        data: { status: nextStatus, ...statusDates, expenseId: expense.id, dueDate },
      })
    }
  }

  return prisma.purchaseOrder.update({ where: { id }, data: { status: nextStatus, ...statusDates } })
}

export async function cancelPO(id: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } })
  if (!po) throw new NotFoundError('Orden de compra')
  if (po.status === PurchaseOrderStatus.RECEIVED) throw new AppError('No se puede cancelar una OC recibida', 400)
  return prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.CANCELLED, cancelledAt: new Date() } })
}

export async function registerPayment(poId: string, data: { bankAccountId?: string; reference?: string }) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
  if (!po) throw new NotFoundError('Orden de compra')
  if (!po.expenseId) throw new AppError('Esta OC no tiene cuenta por pagar registrada', 400)
  if (po.status !== PurchaseOrderStatus.RECEIVED) throw new AppError('Solo se pueden pagar OC recibidas', 400)

  const expense = await prisma.expense.findUnique({ where: { id: po.expenseId } })
  if (!expense) throw new NotFoundError('Cuenta por pagar')
  if (expense.status === 'PAID') throw new AppError('Esta cuenta por pagar ya fue pagada', 400)

  const paidAt = new Date()
  const period = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}`

  await prisma.expense.update({ where: { id: po.expenseId }, data: { status: 'PAID', paidAt } })

  const config = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (config?.autoJournalEntries) {
    const debitCode  = (config as any).acctPayablesSuppliers ?? '2101'
    const creditCode = (config as any).acctBank ?? '1102'
    const [debitAcct, creditAcct] = await Promise.all([
      prisma.account.findUnique({ where: { code: debitCode } }),
      prisma.account.findUnique({ where: { code: creditCode } }),
    ])
    if (debitAcct && creditAcct) {
      await prisma.journalEntry.create({
        data: {
          type:            'PAYMENT',
          businessUnit:    po.businessUnit as any,
          description:     `Pago OC ${po.number} — ${expense.supplier}`,
          debitAccountId:  debitAcct.id,
          creditAccountId: creditAcct.id,
          amount:          po.total,
          period,
          expenseId:       po.expenseId,
        },
      })
    }
  }

  try {
    const bankWhere: any = { isActive: true, businessUnit: po.businessUnit as any }
    if (data.bankAccountId) bankWhere.id = data.bankAccountId
    const account = await prisma.bankAccount.findFirst({ where: bankWhere, orderBy: { createdAt: 'asc' } })
    if (account) {
      const newBalance = account.balance - po.total
      await prisma.bankAccount.update({ where: { id: account.id }, data: { balance: newBalance } })
      await prisma.bankTransaction.create({
        data: {
          bankAccountId:   account.id,
          type:            'DEBIT',
          amount:          po.total,
          balance:         newBalance,
          description:     `OC ${po.number}: ${expense.supplier}`,
          reference:       data.reference ?? po.number,
          transactionDate: paidAt,
          status:          'UNMATCHED',
        },
      })
    }
  } catch (e: any) {
    console.error(`[PurchaseOrders] Bank debit error for PO ${poId}:`, e.message)
  }

  return prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { supplier: true, items: { orderBy: { sortOrder: 'asc' } } },
  })
}

export async function getCxPList(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {
    isCredit:  true,
    status:    PurchaseOrderStatus.RECEIVED,
    expenseId: { not: null },
  }
  if (query.businessUnit) where.businessUnit = query.businessUnit

  const [pos, total] = await Promise.all([
    (prisma.purchaseOrder as any).findMany({
      where, skip, take: limit, orderBy: { dueDate: 'asc' },
      include: { supplier: { select: { id: true, name: true } } },
    }),
    prisma.purchaseOrder.count({ where }),
  ])

  const posAny: any[] = pos
  const expenseIds = posAny.map((p: any) => p.expenseId).filter(Boolean) as string[]
  const expenses   = await prisma.expense.findMany({
    where: { id: { in: expenseIds } },
    select: { id: true, status: true, paidAt: true },
  })
  const expMap = new Map(expenses.map(e => [e.id, e]))

  const data = posAny
    .map((p: any) => ({
      ...p,
      expenseStatus: p.expenseId ? expMap.get(p.expenseId)?.status ?? null : null,
      expensePaidAt: p.expenseId ? expMap.get(p.expenseId)?.paidAt ?? null : null,
    }))
    .filter((p: any) => p.expenseStatus !== 'PAID' && p.expenseStatus !== 'CANCELLED')

  return { data, total: data.length, page, limit }
}
