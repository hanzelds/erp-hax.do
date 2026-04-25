import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'
import { BusinessUnit, EmployeeType, PayrollAdditionType } from '@prisma/client'
import { logger } from '../../config/logger'
import { generateAllPayrollSlips } from '../../services/payroll-pdf.service'
import { sendEmail } from '../../services/email.service'

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
        include: {
          employee: { select: { id: true, name: true, type: true, position: true } },
          additions: { orderBy: { createdAt: 'asc' } },
        },
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
    include: { items: { include: { additions: true } } },
  })
  if (existing && existing.status !== 'CALCULATED') {
    throw new AppError('Ya existe una nómina aprobada o pagada para este período', 400)
  }

  // Preserve existing additions keyed by employeeId
  const savedAdditions = new Map<string, { type: string; description: string | null; amount: number; hours: number | null; rate: number | null }[]>()
  if (existing) {
    for (const item of existing.items) {
      if (item.additions.length > 0) savedAdditions.set(item.employeeId, item.additions)
    }
  }

  // Get active employees for this BU
  const employees = await prisma.employee.findMany({
    where: { businessUnit: businessUnit as any, isActive: true },
  })
  if (employees.length === 0) throw new AppError('No hay empleados activos para esta unidad', 400)

  const rates = await getTssRates()

  const items = employees.map((emp) => {
    const empAdditions = savedAdditions.get(emp.id) ?? []
    const additionsTotal = empAdditions.reduce((s, a) => s + a.amount, 0)
    const gross   = emp.baseSalary + additionsTotal
    const tssBase = emp.baseSalary   // AFP/SFS apply only to base salary (not commissions/overtime/incentives)
    const afpEmp  = tssBase * rates.AFP_EMPLOYEE
    const sfsEmp  = tssBase * rates.SFS_EMPLOYEE
    const isr     = calcMonthlyISR(gross)   // ISR on full gross income
    const net     = gross - afpEmp - sfsEmp - isr
    const afpEr   = tssBase * rates.AFP_EMPLOYER
    const sfsEr   = tssBase * rates.SFS_EMPLOYER
    const riesgo  = tssBase * rates.SFS_RIESGO

    return {
      employeeId:       emp.id,
      grossSalary:      gross,
      afpEmployee:      afpEmp,
      sfsEmployee:      sfsEmp,
      isr,
      otherDeductions:  0,
      netSalary:        net,
      afpEmployer:      afpEr,
      sfsEmployer:      sfsEr,
      sfsRiesgoLaboral: riesgo,
      additions: {
        create: empAdditions.map(a => ({
          type:        a.type,
          description: a.description,
          amount:      a.amount,
          hours:       a.hours,
          rate:        a.rate,
        })),
      },
    }
  })

  const totals = computePayrollTotals(items)

  if (existing) {
    await prisma.payrollItem.deleteMany({ where: { payrollId: existing.id } })
    await prisma.payroll.update({
      where: { id: existing.id },
      data: { ...totals, totalOtherDeductions: 0, status: 'CALCULATED', items: { create: items as any } },
    })
    return prisma.payroll.findUnique({
      where: { id: existing.id },
      include: { items: { include: { additions: true } } },
    })
  }

  return prisma.payroll.create({
    data: {
      businessUnit: businessUnit as any,
      period,
      status: 'CALCULATED',
      ...totals,
      totalOtherDeductions: 0,
      items: { create: items as any },
    },
    include: { items: { include: { additions: true } } },
  })
}

function computePayrollTotals(items: { grossSalary: number; afpEmployee: number; afpEmployer: number; sfsEmployee: number; sfsEmployer: number; isr: number; netSalary: number }[]) {
  const totalGross        = items.reduce((s, i) => s + i.grossSalary, 0)
  const totalAfpEmployee  = items.reduce((s, i) => s + i.afpEmployee, 0)
  const totalAfpEmployer  = items.reduce((s, i) => s + i.afpEmployer, 0)
  const totalSfsEmployee  = items.reduce((s, i) => s + i.sfsEmployee, 0)
  const totalSfsEmployer  = items.reduce((s, i) => s + i.sfsEmployer, 0)
  const totalIsr          = items.reduce((s, i) => s + i.isr, 0)
  const totalNet          = items.reduce((s, i) => s + i.netSalary, 0)
  const totalEmployerCost = totalGross + totalAfpEmployer + totalSfsEmployer
  return { totalGross, totalAfpEmployee, totalAfpEmployer, totalSfsEmployee, totalSfsEmployer, totalIsr, totalNet, totalEmployerCost }
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
  const payroll = await prisma.payroll.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          employee: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })
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

  // Create BankTransaction DEBIT on main account for this business unit
  ;(async () => {
    try {
      const mainAccount = await prisma.bankAccount.findFirst({
        where: { isActive: true, businessUnit: payroll.businessUnit as any },
        orderBy: { createdAt: 'asc' },
      })
      if (mainAccount) {
        const newBalance = mainAccount.balance - payroll.totalNet
        await prisma.bankAccount.update({
          where: { id: mainAccount.id },
          data:  { balance: newBalance },
        })
        await prisma.bankTransaction.create({
          data: {
            bankAccountId:   mainAccount.id,
            type:            'DEBIT',
            amount:          payroll.totalNet,
            balance:         newBalance,
            description:     `Pago nómina ${payroll.period}`,
            transactionDate: new Date(),
            status:          'UNMATCHED',
          },
        })
      }
    } catch (e: any) {
      logger.error(`[Payroll] Bank debit error for payroll ${id}:`, e.message)
    }
  })()

  // Auto-generate pay slips and email to each employee (fire-and-forget)
  ;(async () => {
    try {
      await generateAllPayrollSlips(id)
      // After PDF generation, send email notifications to each employee
      for (const item of payroll.items) {
        if (!item.employee.email) continue
        const period = payroll.period
        sendEmail({
          to:      item.employee.email,
          subject: `Comprobante de pago nómina ${period} — ${process.env.COMPANY_NAME ?? 'ERP'}`,
          html: `
            <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
              <h2 style="color:#293c4f;">Comprobante de Pago de Nómina</h2>
              <p>Estimado/a <strong>${item.employee.name}</strong>,</p>
              <p>Se ha procesado el pago correspondiente al período <strong>${period}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:6px 0;color:#666;">Salario bruto:</td><td style="text-align:right;font-weight:bold;">RD$ ${item.grossSalary.toFixed(2)}</td></tr>
                <tr><td style="padding:6px 0;color:#666;">AFP empleado:</td><td style="text-align:right;">RD$ ${item.afpEmployee.toFixed(2)}</td></tr>
                <tr><td style="padding:6px 0;color:#666;">SFS empleado:</td><td style="text-align:right;">RD$ ${item.sfsEmployee.toFixed(2)}</td></tr>
                <tr><td style="padding:6px 0;color:#666;">ISR retenido:</td><td style="text-align:right;">RD$ ${item.isr.toFixed(2)}</td></tr>
                <tr style="border-top:2px solid #293c4f;"><td style="padding:8px 0;font-weight:bold;color:#293c4f;">Salario neto:</td><td style="text-align:right;font-weight:bold;color:#293c4f;font-size:18px;">RD$ ${item.netSalary.toFixed(2)}</td></tr>
              </table>
              <p style="color:#888;font-size:12px;">Este es un correo automático. Por favor no responder.</p>
            </div>
          `,
        }).catch((e: any) => logger.error(`[Payroll] Email error for ${item.employee.email}:`, e.message))
      }
    } catch (e: any) {
      logger.error(`[Payroll] Payslip/email error for payroll ${id}:`, e.message)
    }
  })()

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

// ── Payroll Additions ─────────────────────────────────────────

/** Recalculate a single PayrollItem after additions change, then sync Payroll totals */
async function recalcItem(payrollItemId: string) {
  const item = await prisma.payrollItem.findUnique({
    where: { id: payrollItemId },
    include: { additions: true, employee: true, payroll: true },
  })
  if (!item) throw new NotFoundError('Item de nómina')
  if (item.payroll.status !== 'CALCULATED') {
    throw new AppError('No se pueden modificar conceptos de una nómina aprobada o pagada', 400)
  }

  const rates          = await getTssRates()
  const additionsTotal = item.additions.reduce((s, a) => s + a.amount, 0)
  const gross   = item.employee.baseSalary + additionsTotal
  const tssBase = item.employee.baseSalary  // AFP/SFS only on base salary
  const afpEmp  = tssBase * rates.AFP_EMPLOYEE
  const sfsEmp  = tssBase * rates.SFS_EMPLOYEE
  const isr     = calcMonthlyISR(gross)     // ISR on full gross
  const net     = gross - afpEmp - sfsEmp - isr
  const afpEr   = tssBase * rates.AFP_EMPLOYER
  const sfsEr   = tssBase * rates.SFS_EMPLOYER
  const riesgo  = tssBase * rates.SFS_RIESGO

  await prisma.payrollItem.update({
    where: { id: payrollItemId },
    data: { grossSalary: gross, afpEmployee: afpEmp, sfsEmployee: sfsEmp, isr, netSalary: net, afpEmployer: afpEr, sfsEmployer: sfsEr, sfsRiesgoLaboral: riesgo },
  })

  // Recompute payroll totals from all items
  const allItems = await prisma.payrollItem.findMany({ where: { payrollId: item.payrollId } })
  const totals   = computePayrollTotals(allItems)
  await prisma.payroll.update({ where: { id: item.payrollId }, data: totals })
}

export async function addAddition(payrollItemId: string, data: {
  type: PayrollAdditionType; description?: string; amount: number; hours?: number; rate?: number
}) {
  // Verify item exists and payroll is editable (recalcItem will also check)
  const item = await prisma.payrollItem.findUnique({
    where: { id: payrollItemId },
    include: { payroll: { select: { status: true } } },
  })
  if (!item) throw new NotFoundError('Item de nómina')
  if (item.payroll.status !== 'CALCULATED') {
    throw new AppError('No se pueden agregar conceptos a una nómina aprobada o pagada', 400)
  }

  const addition = await prisma.payrollAddition.create({
    data: {
      payrollItemId,
      type:        data.type,
      description: data.description,
      amount:      data.amount,
      hours:       data.hours,
      rate:        data.rate,
    },
  })
  await recalcItem(payrollItemId)
  return addition
}

export async function updateAddition(additionId: string, data: {
  type?: PayrollAdditionType; description?: string; amount?: number; hours?: number; rate?: number
}) {
  const addition = await prisma.payrollAddition.findUnique({ where: { id: additionId } })
  if (!addition) throw new NotFoundError('Concepto')

  const updated = await prisma.payrollAddition.update({
    where: { id: additionId },
    data: {
      ...(data.type        !== undefined && { type: data.type }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amount      !== undefined && { amount: data.amount }),
      ...(data.hours       !== undefined && { hours: data.hours }),
      ...(data.rate        !== undefined && { rate: data.rate }),
    },
  })
  await recalcItem(addition.payrollItemId)
  return updated
}

export async function removeAddition(additionId: string) {
  const addition = await prisma.payrollAddition.findUnique({ where: { id: additionId } })
  if (!addition) throw new NotFoundError('Concepto')
  const payrollItemId = addition.payrollItemId
  await prisma.payrollAddition.delete({ where: { id: additionId } })
  await recalcItem(payrollItemId)
  return { deleted: true }
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
