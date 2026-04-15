import { prisma } from '../../config/database'
import { NotFoundError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { LeadStatus, BusinessUnit } from '@prisma/client'

export async function listOpportunities(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.status) where.status = query.status
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.clientId) where.clientId = query.clientId
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { client: { name: { contains: query.search, mode: 'insensitive' } } },
    ]
  }

  const [data, total] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true, name: true, email: true } } },
    }),
    prisma.crmOpportunity.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getPipeline(businessUnit?: BusinessUnit) {
  const where: any = businessUnit ? { businessUnit } : {}
  const stages = Object.values(LeadStatus)
  const results = await Promise.all(
    stages.map(async (status) => {
      const items = await prisma.crmOpportunity.findMany({
        where: { ...where, status },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
      })
      const totalValue = items.reduce((s, i) => s + (i.value ?? 0), 0)
      return { status, items, count: items.length, totalValue }
    })
  )
  return results
}

export async function getOpportunity(id: string) {
  const opp = await prisma.crmOpportunity.findUnique({
    where: { id },
    include: {
      client: true,
      quotes: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!opp) throw new NotFoundError('Oportunidad')
  return opp
}

export async function createOpportunity(data: any) {
  return prisma.crmOpportunity.create({
    data,
    include: { client: { select: { id: true, name: true } } },
  })
}

export async function updateOpportunity(id: string, data: any) {
  const exists = await prisma.crmOpportunity.findUnique({ where: { id } })
  if (!exists) throw new NotFoundError('Oportunidad')
  return prisma.crmOpportunity.update({
    where: { id },
    data: {
      ...data,
      closedAt: data.status === LeadStatus.CLOSED_WON || data.status === LeadStatus.CLOSED_LOST ? new Date() : undefined,
    },
    include: { client: { select: { id: true, name: true } } },
  })
}

export async function deleteOpportunity(id: string) {
  const exists = await prisma.crmOpportunity.findUnique({ where: { id } })
  if (!exists) throw new NotFoundError('Oportunidad')
  return prisma.crmOpportunity.delete({ where: { id } })
}
