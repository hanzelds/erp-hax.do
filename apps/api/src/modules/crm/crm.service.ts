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
      where, skip, take: limit, orderBy: [{ probability: 'desc' }, { createdAt: 'desc' }],
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
        orderBy: [{ probability: 'desc' }, { updatedAt: 'desc' }],
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

function sanitizeOpportunityInput(data: any) {
  const clean: any = { ...data }
  if (clean.value === '' || clean.value === undefined) clean.value = null
  else if (clean.value !== null) clean.value = parseFloat(clean.value) || null
  if (clean.probability !== undefined && clean.probability !== null) clean.probability = parseInt(clean.probability) || 0
  if (clean.expectedDate === '') clean.expectedDate = null
  if (clean.closedAt === '') clean.closedAt = null
  if (clean.contactName === '') clean.contactName = null
  if (clean.contactPhone === '') clean.contactPhone = null
  if (clean.assignedTo === '') clean.assignedTo = null
  if (clean.description === '') clean.description = null
  if (clean.notes === '') clean.notes = null
  if (clean.closedReason === '') clean.closedReason = null
  return clean
}

export async function createOpportunity(data: any) {
  const clean = sanitizeOpportunityInput(data)
  return prisma.crmOpportunity.create({
    data: clean,
    include: { client: { select: { id: true, name: true } } },
  })
}

export async function bulkCreateOpportunities(items: any[]) {
  if (!Array.isArray(items) || !items.length) throw new Error('No hay oportunidades para crear')
  const sanitized = items.map(sanitizeOpportunityInput)
  return prisma.$transaction(
    sanitized.map((data) => prisma.crmOpportunity.create({
      data,
      include: { client: { select: { id: true, name: true } } },
    }))
  )
}

export async function updateOpportunity(id: string, data: any) {
  const exists = await prisma.crmOpportunity.findUnique({ where: { id } })
  if (!exists) throw new NotFoundError('Oportunidad')

  // Sanitize: empty strings → null for typed optional fields
  const clean: any = { ...data }
  if (clean.value === '' || clean.value === undefined) clean.value = null
  else if (clean.value !== null) clean.value = parseFloat(clean.value) || null
  if (clean.probability !== undefined) clean.probability = parseInt(clean.probability) || 0
  if (clean.expectedDate === '') clean.expectedDate = null

  return prisma.crmOpportunity.update({
    where: { id },
    data: {
      ...clean,
      closedAt: (clean.status === LeadStatus.CLOSED_WON || clean.status === LeadStatus.CLOSED_LOST) && !exists.closedAt
        ? new Date()
        : (clean.status && clean.status !== LeadStatus.CLOSED_WON && clean.status !== LeadStatus.CLOSED_LOST ? null : undefined),
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

  const [all, wonMonth, lostThisMonth, recentWon, recentLost, openOpportunities] = await Promise.all([
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
    prisma.crmOpportunity.findMany({
      where: { ...where, status: { notIn: [LeadStatus.CLOSED_WON, LeadStatus.CLOSED_LOST] } },
      select: { id: true, title: true, status: true, value: true, probability: true },
      orderBy: [{ value: 'desc' }],
      take: 10,
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
    ? (['HAX', 'KODER', 'ALDIA'] as BusinessUnit[]).map((unit) => {
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
    openOpportunities,
  }
}

export async function bulkUpdateStatus(ids: string[], status: LeadStatus) {
  if (!ids.length) throw new Error('No IDs provided')
  const isClosing = status === LeadStatus.CLOSED_WON || status === LeadStatus.CLOSED_LOST
  return prisma.crmOpportunity.updateMany({
    where: { id: { in: ids } },
    data: { status, ...(isClosing ? { closedAt: new Date() } : { closedAt: null }) },
  })
}

export async function bulkAssign(ids: string[], assignedTo: string) {
  if (!ids.length) throw new Error('No IDs provided')
  return prisma.crmOpportunity.updateMany({
    where: { id: { in: ids } },
    data: { assignedTo },
  })
}

export async function exportCsv(query: any): Promise<string> {
  const where: any = {}
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.status)       where.status = query.status
  if (query.leadSource)   where.leadSource = query.leadSource

  const rows = await prisma.crmOpportunity.findMany({
    where,
    include: { client: { select: { name: true } } },
    orderBy: [{ probability: 'desc' }, { createdAt: 'desc' }],
  })

  const STAGE: Record<string, string> = {
    LEAD: 'Lead', CONTACT: 'Contactado', PROPOSAL: 'Propuesta',
    NEGOTIATION: 'Negociación', CLOSED_WON: 'Ganado', CLOSED_LOST: 'Perdido',
  }
  const SOURCE: Record<string, string> = {
    COLD_OUTREACH: 'Prospección fría', REFERRAL: 'Referido', INBOUND: 'Inbound',
    SOCIAL_MEDIA: 'Redes sociales', EVENT: 'Evento', REPEAT: 'Recurrente',
  }

  const header = 'Título,Cliente,Etapa,Valor DOP,Probabilidad %,Origen,Asignado,Contacto,Teléfono,Unidad,Cierre esperado,Creado'
  const escape = (v: any) => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`

  const lines = rows.map((r: any) => [
    escape(r.title),
    escape(r.client?.name),
    escape(STAGE[r.status] ?? r.status),
    r.value ?? '',
    r.probability,
    escape(SOURCE[r.leadSource] ?? r.leadSource),
    escape(r.assignedTo),
    escape(r.contactName),
    escape(r.contactPhone),
    escape(r.businessUnit),
    r.expectedDate ? new Date(r.expectedDate).toLocaleDateString('es-DO') : '',
    new Date(r.createdAt).toLocaleDateString('es-DO'),
  ].join(','))

  return [header, ...lines].join('\n')
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
