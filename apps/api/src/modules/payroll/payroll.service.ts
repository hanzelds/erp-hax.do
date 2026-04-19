import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { BusinessUnit, EmployeeType } from '@prisma/client'
import { logger } from '../../config/logger'
import { generateAllPayrollSlips } from '../../services/payroll-pdf.service'

// ── TSS / ISR defaults (overridden by DB config at runtime) ──
const AFP_EMPLOYEE_DEFAULT   = 0.0287
const AFP_EMPLOYER_DEFAULT   = 0.0710
const SFS_EMPLOYEE_DEFAULT   = 0.0304
const SFS_EMPLOYER_DEFAULT   = 0.0709
const SFS_RIESGO_DEFAULT     = 0.0120

/** Load TSS rates from DB config, falling back to statutory defaults */
async function getTssRates() {
  const cfg = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  return {
    AFP_EMPLOYEE:   cfg?.payrollAfpEmployee   ?? AFP_EMPLOYEE_DEFAULT,
    AFP_EMPLOYER:   cfg?.payrollAfpEmployer   ?? AFP_EMPLOYER_DEFAULT,
    SFS_EMPLOYEE:   cfg?.payrollSfsEmployee   ?? SFS_EMPLOYEE_DEFAULT,
    SFS_EMPLOYER:   cfg?.payrollSfsEmployer   ?? SFS_EMPLOYER_DEFAULT,
    SFS_RIESGO:     cfg?.payrollRiesgoLaboral ?? SFS_RIESGO_DEFAULT,
  }
}

/** Load accounting codes from DB config */
async function getAcctCodes() {
  const cfg = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  return {
    BANK:      cfg?.acctBank              ?? '1102',
    EMPLOYEES: cfg?.acctPayablesEmployees ?? '2102',
    TSS:       cfg?.acctPayablesTss       ?? '2103',
    ISR:       cfg?.acctPayablesIsr       ?? '2104',
    SALARIES:  cfg?.acctExpenseSalaries   ?? '5102',
  }
}

/** Simplified ISR table (monthly) */
function calcMonthlyISR(monthlyGross: number): number {
  const annual = monthlyGross * 12
  if (annual <= 416220.01)  return 0
  if (annual <= 624329.01)  return ((annual - 416220.01) * 0.15) / 12
  if (annual <= 867123.01)  return ((annual - 624329.01) * 0.20 + 31216.00) / 12
  return ((annual - 867123.01) * 0.25 + 79776.00) / 12
}

// ── Auto journal entry helper ─────────────────────────────────
async function autoJournalEntry(opts: {
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE'
  businessUnit: 'HAX' | 'KODER'
  description: string
  debitCode: string
  creditCode: string
  amount: number
  payrollId?: string
  period: string
}) {
  if (opts.amount <= 0) return null
  const [debit, credit] = await Promise.all([
    prisma.account.findUnique({ where: { code: opts.debitCode } }),
    prisma.account.findUnique({ where: { code: opts.creditCode } }),
  ])
  if (!debit || !credit) return null
  return prisma.journalEntry.create({
    data: {
      type: opts.type,
      businessUnit: opts.businessUnit as any,
      description: opts.description,
      debitAccountId: debit.id,
      creditAccountId: credit.id,
      amount: opts.amount,
      period: opts.period,
      payrollId: opts.payrollId,
    },
  })
}

// ── Employees ─────────────────────────────────────────────────

export async function listEmployees(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.type) where.type = query.type
  if (query.isActive !== undefined) where.isActive = query.isActive === 'true'

  const [data, total] = await Promise.all([
    prisma.employee.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.employee.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getEmployee(id: string) {
  const emp = await prisma.employee.findUnique({ where: { id } })
  if (!emp) throw new NotFoundError('Empleado')
  return emp
}

export async function createEmployee(data: any) {
  return prisma.employee.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      cedula: data.cedula || undefined,
      type: data.type ?? EmployeeType.SALARIED,
      businessUnit: data.businessUnit,
      position: data.position,
      baseSalary: data.baseSalary,
      hiredAt: data.hiredAt ? new Date(data.hiredAt) : new Date(),
    },
  })
}

export async function updateEmployee(id: string, data: any) {
  const emp = await prisma.employee.findUnique({ where: { id } })
  if (!emp) throw new NotFoundError('Empleado')

  const allowed = ['name', 'email', 'phone', 'position', 'baseSalary', 'isActive', 'type']
  const update: any = {}
  for (const f of allowed) if (data[f] !== undefined) update[f] = data[f]

  return prisma.employee.update({ where: { id }, data: update })
}

export async function terminateEmployee(id: string) {
  const emp = await prisma.employee.findUnique({ where: { id } })
  if (!emp) throw new NotFoundError('Empleado')
  if (!emp.isActive) throw new AppError('El empleado ya está inactivo', 400)

  return prisma.employee.update({
    where: { id },
    data: { isActive: false, terminatedAt: new Date() },
  })
}

// ── Payroll ───────────────────────────────────────────────────

export async function listPayrolls(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.period) where.period = query.period
  if (query.status) where.status = query.status

  const [data, total] = await Promise.all([
    prisma.payroll.findMany({
      where, skip, take: limit, orderBy: [{ period: 'desc' }, { businessUnit: 'asc' }],
      include: { _count: { select: { items: true } } },
    }),
    prisma.payroll.count({ where }),
  ])
  return { data, total, page, limit }
}

export async function getPayroll(id: string) {
  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: {
      items: {
        include: { employee: { select: { id: true, name: true, type: true, position: true } } },
        orderBy: { employee: { name: 'asc' } },
      },
    },
  })
  if (!payroll) throw new NotFoundError('Nómina')
  return payroll
}

export async function calculatePayroll(businessUnit: string, period: string) {
  // Check if already exists
  const existing = await prisma.payroll.findUnique({
    where: { businessUnit_period: { businessUnit: businessUnit as any, period } },
  })
  if (existing && existing.status !== 'CALCULATED') {
    throw new AppError('Ya existe una nómina aprobada o pagada para este período', 400)
  }

  // Get active employees for this BU
  const employees = await prisma.employee.findMany({
    where: { businessUnit: businessUnit as any, isActive: true },
  })
  if (employees.length === 0) throw new AppError('No hay empleados activos para esta unidad', 400)

  const rates = await getTssRates()

  const items = employees.map((emp) => {
    const gross  = emp.baseSalary
    const afpEmp = gross * rates.AFP_EMPLOYEE
    const sfsEmp = gross * rates.SFS_EMPLOYEE
    const isr    = calcMonthlyISR(gross)
    const net    = gross - afpEmp - sfsEmp - isr

    const afpEr  = gross * rates.AFP_EMPLOYER
    const sfsEr  = gross * rates.SFS_EMPLOYER
    const riesgo = gross * rates.SFS_RIESGO

    return {
      employeeId:      emp.id,
      grossSalary:     gross,
      afpEmployee:     afpEmp,
      sfsEmployee:     sfsEmp,
      isr:             isr,
      otherDeductions: 0,
      netSalary:       net,
      afpEmployer:     afpEr,
      sfsEmployer:     sfsEr,
      sfsRiesgoLaboral: riesgo,
    }
  })

  const totalGross       = items.reduce((s, i) => s + i.grossSalary, 0)
  const totalAfpEmployee = items.reduce((s, i) => s + i.afpEmployee, 0)
  const totalAfpEmployer = items.reduce((s, i) => s + i.afpEmployer, 0)
  const totalSfsEmployee = items.reduce((s, i) => s + i.sfsEmployee, 0)
  const totalSfsEmployer = items.reduce((s, i) => s + i.sfsEmployer, 0)
  const totalIsr         = items.reduce((s, i) => s + i.isr, 0)
  const totalNet         = items.reduce((s, i) => s + i.netSalary, 0)
  const totalEmployerCost = totalGross + totalAfpEmployer + totalSfsEmployer

  if (existing) {
    // Re-calculate: delete old items and update
    await prisma.payrollItem.deleteMany({ where: { payrollId: existing.id } })
    await prisma.payroll.update({
      where: { id: existing.id },
      data: {
        totalGross, totalAfpEmployee, totalAfpEmployer,
        totalSfsEmployee, totalSfsEmployer, totalIsr,
        totalOtherDeductions: 0, totalNet, totalEmployerCost,
        status: 'CALCULATED',
        items: { create: items },
      },
    })
    return prisma.payroll.findUnique({ where: { id: existing.id }, include: { items: true } })
  }

  return prisma.payroll.create({
    data: {
      businessUnit: businessUnit as any,
      period,
      status: 'CALCULATED',
      totalGross,
      totalAfpEmployee, totalAfpEmployer,
      totalSfsEmployee, totalSfsEmployer,
      totalIsr, totalOtherDeductions: 0,
      totalNet, totalEmployerCost,
      items: { create: items },
    },
    include: { items: true },
  })
}

export async function approvePayroll(id: string) {
  const payroll = await prisma.payroll.findUnique({ where: { id } })
  if (!payroll) throw new NotFoundError('Nómina')
  if (payroll.status !== 'CALCULATED') throw new AppError('Solo se pueden aprobar nóminas calculadas', 400)

  const updated = await prisma.payroll.update({
    where: { id },
    data: { status: 'APPROVED', approvedAt: new Date() },
  })

  // Auto journal entries:
  // Dr acctExpenseSalaries / Cr acctPayablesEmployees  (net)
  // Dr acctExpenseSalaries / Cr acctPayablesTss        (AFP+SFS)
  // Dr acctExpenseSalaries / Cr acctPayablesIsr        (ISR)
  const config = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (config?.autoJournalEntries) {
    const codes  = await getAcctCodes()
    const period = payroll.period
    const bu     = payroll.businessUnit as 'HAX' | 'KODER'
    const totalTss = payroll.totalAfpEmployee + payroll.totalAfpEmployer +
                     payroll.totalSfsEmployee + payroll.totalSfsEmployer

    await Promise.all([
      autoJournalEntry({
        type: 'INVOICE', businessUnit: bu,
        description: `Nómina ${period} - salarios netos`,
        debitCode: codes.SALARIES, creditCode: codes.EMPLOYEES,
        amount: payroll.totalNet, payrollId: id, period,
      }),
      totalTss > 0 && autoJournalEntry({
        type: 'INVOICE', businessUnit: bu,
        description: `Nómina ${period} - TSS por pagar`,
        debitCode: codes.SALARIES, creditCode: codes.TSS,
        amount: totalTss, payrollId: id, period,
      }),
      payroll.totalIsr > 0 && autoJournalEntry({
        type: 'INVOICE', businessUnit: bu,
        description: `Nómina ${period} - ISR por pagar`,
        debitCode: codes.SALARIES, creditCode: codes.ISR,
        amount: payroll.totalIsr, payrollId: id, period,
      }),
    ])
  }

  return updated
}

export async function processPayment(id: string) {
  const payroll = await prisma.payroll.findUnique({ where: { id } })
  if (!payroll) throw new NotFoundError('Nómina')
  if (payroll.status !== 'APPROVED') throw new AppError('Solo se pueden pagar nóminas aprobadas', 400)

  const updated = await prisma.payroll.update({
    where: { id },
    data: { status: 'PAID', paidAt: new Date() },
  })

  // Dr acctPayablesEmployees / Cr acctBank
  const config = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (config?.autoJournalEntries) {
    const codes  = await getAcctCodes()
    const period = payroll.period
    const bu     = payroll.businessUnit as 'HAX' | 'KODER'
    await autoJournalEntry({
      type: 'PAYMENT', businessUnit: bu,
      description: `Pago nómina ${period}`,
      debitCode: codes.EMPLOYEES, creditCode: codes.BANK,
      amount: payroll.totalNet, payrollId: id, period,
    })
  }

  // Auto-generate pay slips (fire-and-forget)
  generateAllPayrollSlips(id).catch((e: any) =>
    logger.error(`[Payroll] PDF slip generation error for payroll ${id}:`, e.message)
  )

  return updated
}

export async function payTss(id: string) {
  const payroll = await prisma.payroll.findUnique({ where: { id } })
  if (!payroll) throw new NotFoundError('Nómina')
  if (payroll.status !== 'PAID') throw new AppError('Paga primero la nómina antes de pagar la TSS', 400)

  const totalTss = payroll.totalAfpEmployee + payroll.totalAfpEmployer +
                   payroll.totalSfsEmployee + payroll.totalSfsEmployer

  const config = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (config?.autoJournalEntries && totalTss > 0) {
    const codes  = await getAcctCodes()
    const period = payroll.period
    const bu     = payroll.businessUnit as 'HAX' | 'KODER'
    await autoJournalEntry({
      type: 'PAYMENT', businessUnit: bu,
      description: `Pago TSS nómina ${period}`,
      debitCode: codes.TSS, creditCode: codes.BANK,
      amount: totalTss, payrollId: id, period,
    })
  }

  return { paid: true, amount: totalTss }
}

export async function payIsr(id: string) {
  const payroll = await prisma.payroll.findUnique({ where: { id } })
  if (!payroll) throw new NotFoundError('Nómina')
  if (payroll.status !== 'PAID') throw new AppError('Paga primero la nómina antes de pagar el ISR', 400)

  const config = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (config?.autoJournalEntries && payroll.totalIsr > 0) {
    const codes  = await getAcctCodes()
    const period = payroll.period
    const bu     = payroll.businessUnit as 'HAX' | 'KODER'
    await autoJournalEntry({
      type: 'PAYMENT', businessUnit: bu,
      description: `Pago ISR nómina ${period}`,
      debitCode: codes.ISR, creditCode: codes.BANK,
      amount: payroll.totalIsr, payrollId: id, period,
    })
  }

  return { paid: true, amount: payroll.totalIsr }
}

export async function getPayrollStats(businessUnit?: BusinessUnit) {
  const where: any = businessUnit ? { businessUnit } : {}
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [employees, currentPayroll, ytdTotal] = await Promise.all([
    prisma.employee.count({ where: { ...( businessUnit ? { businessUnit } : {}), isActive: true } }),
    prisma.payroll.findFirst({ where: { ...where, period }, orderBy: { createdAt: 'desc' } }),
    prisma.payroll.aggregate({
      where: { ...where, period: { startsWith: String(now.getFullYear()) }, status: { in: ['APPROVED', 'PAID'] } },
      _sum: { totalGross: true, totalNet: true, totalIsr: true },
    }),
  ])

  return {
    activeEmployees: employees,
    currentPeriod: period,
    currentPayroll: currentPayroll ? {
      status: currentPayroll.status,
      totalGross: currentPayroll.totalGross,
      totalNet: currentPayroll.totalNet,
    } : null,
    ytd: {
      totalGross: ytdTotal._sum.totalGross ?? 0,
      totalNet:   ytdTotal._sum.totalNet   ?? 0,
      totalIsr:   ytdTotal._sum.totalIsr   ?? 0,
    },
  }
}
