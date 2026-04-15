import { prisma } from '../../config/database'
import { NotFoundError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { BusinessUnit } from '@prisma/client'

export async function listProducts(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const search = query.search as string | undefined
  const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined
  const businessUnit = query.businessUnit as BusinessUnit | undefined
  const categoryId = query.categoryId as string | undefined
  const type = query.type as string | undefined

  const where: any = {}
  if (isActive !== undefined) where.isActive = isActive
  if (businessUnit) where.businessUnit = businessUnit
  if (categoryId) where.categoryId = categoryId
  if (type) where.type = type
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where, skip, take: limit, orderBy: { name: 'asc' },
      include: { category: true },
    }),
    prisma.product.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true },
  })
  if (!product) throw new NotFoundError('Producto')
  return product
}

export async function createProduct(data: any) {
  return prisma.product.create({ data, include: { category: true } })
}

export async function updateProduct(id: string, data: any) {
  const exists = await prisma.product.findUnique({ where: { id } })
  if (!exists) throw new NotFoundError('Producto')
  return prisma.product.update({ where: { id }, data, include: { category: true } })
}

export async function toggleProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) throw new NotFoundError('Producto')
  return prisma.product.update({ where: { id }, data: { isActive: !product.isActive } })
}

// Categories
export async function listCategories() {
  return prisma.productCategory.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  })
}

export async function createCategory(data: any) {
  return prisma.productCategory.create({ data })
}

export async function deleteCategory(id: string) {
  const cat = await prisma.productCategory.findUnique({ where: { id } })
  if (!cat) throw new NotFoundError('Categoría')
  return prisma.productCategory.delete({ where: { id } })
}

export async function getProductStats(businessUnit?: BusinessUnit) {
  const where: any = businessUnit ? { businessUnit } : {}
  const [total, active, byType] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.count({ where: { ...where, isActive: true } }),
    prisma.product.groupBy({ by: ['type'], where, _count: true }),
  ])
  return { total, active, byType }
}
