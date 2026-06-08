import { prisma } from '../../config/database'
import { parsePagination } from '../../utils/response'
import { AppError, NotFoundError } from '../../middleware/errorHandler'
import { BusinessUnit } from '@prisma/client'

// ── Plans ─────────────────────────────────────────────────────

export async function listPlans(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.isActive !== undefined) where.isActive = query.isActive === 'true'

  const [data, total] = await Promise.all([
    prisma.commissionPlan.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { id: true, name: true, position: true } },
        _count: { select: { entries: true } },
      },
    }),
    prisma.commissionPlan.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function createPlan(data: any) {
  return prisma.commissionPlan.create({
    data: {
      name:         data.name,
      beneficiary:  data.beneficiary,
      employeeId:   data.employeeId || null,
      businessUnit: data.businessUnit,
      rate:         parseFloat(data.rate),
      base:         data.base ?? 'COLLECTED',
      minAmount:    data.minAmount ? parseFloat(data.minAmount) : null,
      notes:        data.notes || null,
    },
    include: { employee: { select: { id: true, name: true } } },
  })
}

export async function updatePlan(id: string, data: any) {
  const existing = await prisma.commissionPlan.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Plan de comisión')

  const updateData: any = {}
  if (data.name        !== undefined) updateData.name        = data.name
  if (data.beneficiary !== undefined) updateData.beneficiary = data.beneficiary
  if (data.employeeId  !== undefined) updateData.employeeId  = data.employeeId || null
  if (data.rate        !== undefined) updateData.rate        = parseFloat(data.rate)
  if (data.base        !== undefined) updateData.base        = data.base
  if (data.minAmount   !== undefined) updateData.minAmount   = data.minAmount ? parseFloat(data.minAmount) : null
  if (data.isActive    !== undefined) updateData.isActive    = data.isActive
  if (data.notes       !== undefined) updateData.notes       = data.notes || null

  return prisma.commissionPlan.update({
    where: { id },
    data: updateData,
    include: { employee: { select: { id: true, name: true } } },
  })
}

export async function deletePlan(id: string) {
  const existing = await prisma.commissionPlan.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Plan de comisión')
  // Soft delete
  return prisma.commissionPlan.update({
    where: { id },
    data: { isActive: false },
  })
}

// ── Calculate ─────────────────────────────────────────────────

export async function calculate(params: {
  period: string
  businessUnit?: BusinessUnit
  planIds?: string[]
  proformaOnly?: boolean
}) {
  const { period, businessUnit, planIds, proformaOnly } = params
  const [year, month] = period.split('-').map(Number)
  if (!year || !month) throw new AppError('Formato de período inválido. Use YYYY-MM', 400)

  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0, 23, 59, 59)

  // Cargar planes activos
  const planWhere: any = { isActive: true }
  if (businessUnit) planWhere.businessUnit = businessUnit
  if (planIds?.length) planWhere.id = { in: planIds }

  const plans = await prisma.commissionPlan.findMany({
    where: planWhere,
    include: { employee: { select: { id: true, name: true } } },
  })

  if (!plans.length) throw new AppError('No hay planes de comisión activos para los criterios dados', 404)

  const invoiceTypeFilter = proformaOnly
    ? { type: 'PROFORMA' as any }
    : { type: { not: 'PROFORMA' as any } }

  const results = await Promise.all(plans.map(async (plan) => {
    const buWhere: any = { businessUnit: plan.businessUnit }

    let baseAmount = 0
    let invoiceCount = 0

    if (plan.base === 'COLLECTED') {
      // Suma pagos recibidos en el período sobre facturas de este BU
      const agg = await prisma.payment.aggregate({
        where: {
          paidAt: { gte: start, lte: end },
          invoice: { ...buWhere, ...invoiceTypeFilter },
        },
        _sum: { amount: true },
        _count: { id: true },
      })
      baseAmount    = agg._sum.amount ?? 0
      invoiceCount  = agg._count.id   ?? 0

    } else {
      // Suma total/subtotal de facturas emitidas en el período
      const sumField = plan.base === 'TOTAL' ? 'total' : 'subtotal'
      const agg = await prisma.invoice.aggregate({
        where: {
          ...buWhere,
          ...invoiceTypeFilter,
          issueDate: { gte: start, lte: end },
          status: { in: ['APPROVED', 'PAID'] as any },
        },
        _sum: { [sumField]: true },
        _count: { id: true },
      })
      baseAmount   = (agg._sum as any)[sumField] ?? 0
      invoiceCount = agg._count.id ?? 0
    }

    // Verificar monto mínimo
    const meetsMinimum = !plan.minAmount || baseAmount >= plan.minAmount
    const amount = meetsMinimum ? baseAmount * plan.rate : 0

    // Upsert CommissionEntry (una por plan+período)
    const entry = await prisma.commissionEntry.upsert({
      where: { planId_period: { planId: plan.id, period } },
      update: {
        baseAmount,
        rate:         plan.rate,
        amount,
        invoiceCount,
        status:       'DRAFT',
        calculatedAt: new Date(),
      },
      create: {
        planId:       plan.id,
        period,
        baseAmount,
        rate:         plan.rate,
        amount,
        invoiceCount,
        status:       'DRAFT',
      },
    })

    return {
      ...entry,
      plan: {
        id:           plan.id,
        name:         plan.name,
        beneficiary:  plan.beneficiary,
        businessUnit: plan.businessUnit,
        base:         plan.base,
        rate:         plan.rate,
        minAmount:    plan.minAmount,
        employee:     plan.employee,
      },
      meetsMinimum,
    }
  }))

  return results
}

// ── Entries ───────────────────────────────────────────────────

export async function listEntries(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.period)       where.period = query.period
  if (query.status)       where.status = query.status
  if (query.businessUnit) where.plan   = { businessUnit: query.businessUnit }

  const [data, total] = await Promise.all([
    prisma.commissionEntry.findMany({
      where, skip, take: limit,
      orderBy: [{ period: 'desc' }, { calculatedAt: 'desc' }],
      include: {
        plan: {
          select: {
            id: true, name: true, beneficiary: true, businessUnit: true,
            base: true, rate: true,
            employee: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.commissionEntry.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function approveEntry(id: string) {
  const entry = await prisma.commissionEntry.findUnique({ where: { id } })
  if (!entry) throw new NotFoundError('Entrada de comisión')
  if (entry.status !== 'DRAFT') throw new AppError('Solo se pueden aprobar entradas en estado DRAFT', 400)

  return prisma.commissionEntry.update({
    where: { id },
    data: { status: 'APPROVED', approvedAt: new Date() },
    include: { plan: { select: { name: true, beneficiary: true, businessUnit: true } } },
  })
}

export async function sendToPayroll(id: string) {
  const entry = await prisma.commissionEntry.findUnique({
    where: { id },
    include: { plan: { include: { employee: true } } },
  })
  if (!entry)                    throw new NotFoundError('Entrada de comisión')
  if (entry.status === 'PAID')   throw new AppError('Esta comisión ya fue enviada a nómina', 400)
  if (entry.status === 'CANCELLED') throw new AppError('No se puede enviar una comisión cancelada', 400)
  if (entry.sentToPayroll)       throw new AppError('Esta comisión ya fue enviada a nómina', 400)
  if (entry.amount <= 0)         throw new AppError('El monto de la comisión debe ser mayor a 0', 400)

  const plan       = entry.plan
  const employeeId = plan.employeeId

  // Buscar nómina DRAFT/CALCULATED del mismo período y BU
  const [y, m]   = entry.period.split('-').map(Number)
  const dbPeriod = `${y}-${String(m).padStart(2, '0')}`

  const payroll = await prisma.payroll.findFirst({
    where: {
      businessUnit: plan.businessUnit as any,
      period:       dbPeriod,
      status:       { in: ['CALCULATED', 'DRAFT'] as any },
    },
    include: { items: { where: employeeId ? { employeeId } : {} } },
  })

  if (!payroll) {
    throw new AppError(
      `No hay nómina en estado CALCULADA para ${plan.businessUnit} en ${dbPeriod}. Calcula la nómina primero.`,
      404
    )
  }

  // Buscar payrollItem del empleado (si está vinculado)
  let payrollItemId: string | undefined

  if (employeeId) {
    const item = payroll.items.find((i: any) => i.employeeId === employeeId)
    if (!item) {
      throw new AppError(
        `El empleado vinculado no está en la nómina de ${dbPeriod}. Verifica que esté incluido.`,
        404
      )
    }
    payrollItemId = item.id
  } else {
    // Sin empleado vinculado — usar primer item o crear nota
    if (payroll.items.length > 0) {
      payrollItemId = (payroll.items[0] as any).id
    } else {
      throw new AppError('La nómina no tiene empleados. Agrega empleados a la nómina primero.', 404)
    }
  }

  // Crear PayrollAddition
  const addition = await prisma.payrollAddition.create({
    data: {
      payrollItemId,
      type:        'COMMISSION',
      description: `Comisión ${plan.name} — período ${dbPeriod}`,
      amount:      entry.amount,
    },
  })

  // Actualizar entry
  return prisma.commissionEntry.update({
    where: { id },
    data: {
      sentToPayroll:     true,
      payrollAdditionId: addition.id,
      status:            'PAID',
    },
    include: { plan: { select: { name: true, beneficiary: true } } },
  })
}

export async function cancelEntry(id: string) {
  const entry = await prisma.commissionEntry.findUnique({ where: { id } })
  if (!entry) throw new NotFoundError('Entrada de comisión')
  if (entry.status === 'PAID') throw new AppError('No se puede cancelar una comisión ya pagada', 400)

  return prisma.commissionEntry.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: { plan: { select: { name: true, beneficiary: true } } },
  })
}
