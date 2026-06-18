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
      include: {
        client: { select: { id: true, name: true, email: true } },
        _count: { select: { activities: true, quotes: true } },
      },
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
      const totalValue = items.reduce((s: number, i: any) => s + (i.value ?? 0), 0)
      return [status, { items, count: items.length, totalValue }]
    })
  )
  return Object.fromEntries(results)
}

export async function getOpportunity(id: string) {
  const opp = await prisma.crmOpportunity.findUnique({
    where: { id },
    include: {
      client: true,
      quotes: { orderBy: { createdAt: 'desc' } },
      activities: { orderBy: { createdAt: 'desc' } },
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
      closedAt: (data.status === LeadStatus.CLOSED_WON || data.status === LeadStatus.CLOSED_LOST) && !exists.closedAt
        ? new Date()
        : (data.status && data.status !== LeadStatus.CLOSED_WON && data.status !== LeadStatus.CLOSED_LOST ? null : undefined),
    },
    include: { client: { select: { id: true, name: true } } },
  })
}

export async function deleteOpportunity(id: string) {
  const exists = await prisma.crmOpportunity.findUnique({ where: { id } })
  if (!exists) throw new NotFoundError('Oportunidad')
  return prisma.crmOpportunity.delete({ where: { id } })
}

export async function getAnalytics(businessUnit?: BusinessUnit) {
  const where: any = businessUnit ? { businessUnit } : {}
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const [all, wonMonth, lostThisMonth, recentWon, recentLost] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where,
      select: { status: true, value: true, probability: true, businessUnit: true },
    }),
    prisma.crmOpportunity.aggregate({
      where: { ...where, status: LeadStatus.CLOSED_WON, closedAt: { gte: startOfMonth } },
      _sum: { value: true },
      _count: true,
    }),
    prisma.crmOpportunity.count({
      where: { ...where, status: LeadStatus.CLOSED_LOST, closedAt: { gte: startOfMonth } },
    }),
    prisma.crmOpportunity.count({
      where: { ...where, status: LeadStatus.CLOSED_WON, closedAt: { gte: ninetyDaysAgo } },
    }),
    prisma.crmOpportunity.count({
      where: { ...where, status: LeadStatus.CLOSED_LOST, closedAt: { gte: ninetyDaysAgo } },
    }),
  ])

  const active = all.filter((o: any) => o.status !== LeadStatus.CLOSED_LOST)
  const totalPipeline = active.reduce((s: number, o: any) => s + (o.value ?? 0), 0)
  const weightedForecast = active
    .filter((o: any) => o.status !== LeadStatus.CLOSED_WON)
    .reduce((s: number, o: any) => s + (o.value ?? 0) * (o.probability / 100), 0)

  const winRate = recentWon + recentLost > 0
    ? Math.round((recentWon / (recentWon + recentLost)) * 100)
    : 0

  const byStage = Object.values(LeadStatus).map((status) => {
    const items = all.filter((o: any) => o.status === status)
    return { status, count: items.length, totalValue: items.reduce((s: number, o: any) => s + (o.value ?? 0), 0) }
  })

  const byBusinessUnit = !businessUnit
    ? (['HAX', 'KODER'] as BusinessUnit[]).map((unit) => {
        const items = all.filter((o: any) => o.businessUnit === unit && o.status !== LeadStatus.CLOSED_LOST)
        return { unit, count: items.length, totalValue: items.reduce((s: number, o: any) => s + (o.value ?? 0), 0) }
      })
    : []

  return {
    totalPipeline,
    weightedForecast,
    wonThisMonth: wonMonth._sum.value ?? 0,
    wonThisMonthCount: wonMonth._count,
    lostThisMonth,
    winRate,
    byStage,
    byBusinessUnit,
  }
}

export async function listActivities(opportunityId: string) {
  await getOpportunity(opportunityId)
  return prisma.crmActivity.findMany({
    where: { opportunityId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createActivity(opportunityId: string, data: any) {
  await getOpportunity(opportunityId)
  return prisma.crmActivity.create({
    data: { ...data, opportunityId },
  })
}

export async function updateActivity(opportunityId: string, actId: string, data: any) {
  const act = await prisma.crmActivity.findFirst({ where: { id: actId, opportunityId } })
  if (!act) throw new NotFoundError('Actividad')
  return prisma.crmActivity.update({
    where: { id: actId },
    data: {
      ...data,
      completedAt: data.completed === true ? new Date() : data.completed === false ? null : undefined,
    },
  })
}

export async function deleteActivity(opportunityId: string, actId: string) {
  const act = await prisma.crmActivity.findFirst({ where: { id: actId, opportunityId } })
  if (!act) throw new NotFoundError('Actividad')
  return prisma.crmActivity.delete({ where: { id: actId } })
}
