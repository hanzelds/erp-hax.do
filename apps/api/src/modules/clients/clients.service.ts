import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'

export async function listClients(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const search = query.search as string | undefined
  const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined

  const where: any = {}
  if (isActive !== undefined) where.isActive = isActive
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { rnc: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.client.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.client.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getClient(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      invoices: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, number: true, total: true, status: true, issueDate: true } },
      _count: { select: { invoices: true, quotes: true } },
    },
  })
  if (!client) throw new NotFoundError('Cliente')
  return client
}

export async function createClient(data: any) {
  return prisma.client.create({ data })
}

export async function updateClient(id: string, data: any) {
  const exists = await prisma.client.findUnique({ where: { id } })
  if (!exists) throw new NotFoundError('Cliente')
  return prisma.client.update({ where: { id }, data })
}

export async function deleteClient(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { invoices: true, quotes: true } } },
  })
  if (!client) throw new NotFoundError('Cliente')

  const related = (client._count.invoices ?? 0) + (client._count.quotes ?? 0)
  if (related > 0) {
    throw new AppError(
      `No se puede eliminar: este cliente tiene ${client._count.invoices} factura(s) y ${client._count.quotes} cotización(es) asociadas.`,
      409
    )
  }

  return prisma.client.delete({ where: { id } })
}

export async function getClientStats() {
  const [total, active, withInvoices] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { isActive: true } }),
    prisma.client.count({ where: { invoices: { some: {} } } }),
  ])
  return { total, active, withInvoices }
}
