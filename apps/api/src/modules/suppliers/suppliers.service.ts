import { prisma } from '../../config/database'
import { NotFoundError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'

export async function listSuppliers(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const search = query.search as string | undefined
  const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined
  const category = query.category as string | undefined

  const where: any = {}
  if (isActive !== undefined) where.isActive = isActive
  if (category) where.category = category
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { rnc: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.supplier.findMany({
      where, skip, take: limit, orderBy: { name: 'asc' },
      include: { _count: { select: { expenses: true, purchaseOrders: true } } },
    }),
    prisma.supplier.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getSupplier(id: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      expenses: { orderBy: { createdAt: 'desc' }, take: 10 },
      purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { expenses: true, purchaseOrders: true } },
    },
  })
  if (!supplier) throw new NotFoundError('Proveedor')
  return supplier
}

export async function createSupplier(data: any) {
  return prisma.supplier.create({ data })
}

export async function updateSupplier(id: string, data: any) {
  const exists = await prisma.supplier.findUnique({ where: { id } })
  if (!exists) throw new NotFoundError('Proveedor')
  return prisma.supplier.update({ where: { id }, data })
}

export async function deleteSupplier(id: string) {
  const exists = await prisma.supplier.findUnique({ where: { id } })
  if (!exists) throw new NotFoundError('Proveedor')
  return prisma.supplier.update({ where: { id }, data: { isActive: false } })
}

export async function getSupplierStats() {
  const [total, active] = await Promise.all([
    prisma.supplier.count(),
    prisma.supplier.count({ where: { isActive: true } }),
  ])
  const totalSpent = await prisma.expense.aggregate({
    _sum: { total: true },
    where: { supplierId: { not: null } },
  })
  return { total, active, totalSpent: totalSpent._sum.total ?? 0 }
}
