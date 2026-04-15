import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { PurchaseOrderStatus } from '@prisma/client'

async function nextPONumber(businessUnit: string) {
  const count = await prisma.purchaseOrder.count({ where: { businessUnit: businessUnit as any } })
  const prefix = businessUnit === 'HAX' ? 'OC-H' : 'OC-K'
  return `${prefix}-${String(count + 1).padStart(5, '0')}`
}

export async function listPOs(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.status) where.status = query.status
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.supplierId) where.supplierId = query.supplierId

  const [data, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: { supplier: { select: { id: true, name: true, rnc: true } }, _count: { select: { items: true } } },
    }),
    prisma.purchaseOrder.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getPO(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { supplier: true, items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!po) throw new NotFoundError('Orden de compra')
  return po
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
  DRAFT: PurchaseOrderStatus.SENT,
  SENT: PurchaseOrderStatus.CONFIRMED,
  CONFIRMED: PurchaseOrderStatus.RECEIVED,
  RECEIVED: PurchaseOrderStatus.RECEIVED,
  CANCELLED: PurchaseOrderStatus.CANCELLED,
}

export async function advanceStatus(id: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } })
  if (!po) throw new NotFoundError('Orden de compra')
  if (po.status === PurchaseOrderStatus.CANCELLED) throw new AppError('OC cancelada', 400)
  if (po.status === PurchaseOrderStatus.RECEIVED) throw new AppError('OC ya fue recibida', 400)

  const nextStatus = TRANSITIONS[po.status]
  const statusDates: any = {}
  if (nextStatus === PurchaseOrderStatus.SENT) statusDates.sentAt = new Date()
  if (nextStatus === PurchaseOrderStatus.CONFIRMED) statusDates.confirmedAt = new Date()
  if (nextStatus === PurchaseOrderStatus.RECEIVED) statusDates.receivedAt = new Date()

  return prisma.purchaseOrder.update({ where: { id }, data: { status: nextStatus, ...statusDates } })
}

export async function cancelPO(id: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } })
  if (!po) throw new NotFoundError('Orden de compra')
  if (po.status === PurchaseOrderStatus.RECEIVED) throw new AppError('No se puede cancelar una OC recibida', 400)
  return prisma.purchaseOrder.update({ where: { id }, data: { status: PurchaseOrderStatus.CANCELLED, cancelledAt: new Date() } })
}
