import { prisma } from '../../config/database'

export type NotificationType = 'error' | 'warning' | 'info' | 'success'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  href?: string
  createdAt: Date
}

export async function getNotifications(): Promise<Notification[]> {
  const now = new Date()
  const results: Notification[] = []

  // ── Rejected invoices (need retry) ──────────────────────────
  const rejected = await prisma.invoice.findMany({
    where: { status: 'REJECTED' },
    orderBy: { rejectedAt: 'desc' },
    take: 10,
    select: { id: true, number: true, rejectionReason: true, rejectedAt: true, client: { select: { name: true } } },
  })
  for (const inv of rejected) {
    results.push({
      id: `rejected-${inv.id}`,
      type: 'error',
      title: `Factura rechazada — ${inv.number}`,
      message: inv.rejectionReason ?? `${inv.client.name} — Requiere reintento`,
      href: `/dashboard/invoices/${inv.id}`,
      createdAt: inv.rejectedAt ?? now,
    })
  }

  // ── IN_PROCESS invoices (pending DGII response) ───────────────
  const inProcess = await prisma.invoice.findMany({
    where: { status: 'IN_PROCESS' },
    orderBy: { sentAt: 'desc' },
    take: 5,
    select: { id: true, number: true, sentAt: true, client: { select: { name: true } } },
  })
  for (const inv of inProcess) {
    results.push({
      id: `inprocess-${inv.id}`,
      type: 'info',
      title: `Factura en proceso — ${inv.number}`,
      message: `${inv.client.name} — Esperando respuesta DGII`,
      href: `/dashboard/invoices/${inv.id}`,
      createdAt: inv.sentAt ?? now,
    })
  }

  // ── Overdue invoices (approved but past due date) ─────────────
  const overdue = await prisma.invoice.findMany({
    where: {
      status: { in: ['APPROVED'] },
      dueDate: { lt: now },
    },
    orderBy: { dueDate: 'asc' },
    take: 10,
    select: { id: true, number: true, total: true, dueDate: true, client: { select: { name: true } } },
  })
  for (const inv of overdue) {
    const daysOverdue = Math.floor((now.getTime() - inv.dueDate!.getTime()) / 86_400_000)
    results.push({
      id: `overdue-${inv.id}`,
      type: 'warning',
      title: `Cobro vencido — ${inv.number}`,
      message: `${inv.client.name} · ${daysOverdue}d de atraso · RD$ ${inv.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      href: `/dashboard/invoices/${inv.id}`,
      createdAt: inv.dueDate!,
    })
  }

  // ── Invoices approved today ────────────────────────────────────
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const approvedToday = await prisma.invoice.findMany({
    where: { status: 'APPROVED', approvedAt: { gte: todayStart } },
    orderBy: { approvedAt: 'desc' },
    take: 5,
    select: { id: true, number: true, total: true, approvedAt: true, client: { select: { name: true } } },
  })
  for (const inv of approvedToday) {
    results.push({
      id: `approved-${inv.id}`,
      type: 'success',
      title: `Factura aprobada — ${inv.number}`,
      message: `${inv.client.name} · RD$ ${inv.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
      href: `/dashboard/invoices/${inv.id}`,
      createdAt: inv.approvedAt ?? now,
    })
  }

  // ── ITBIS periods overdue ──────────────────────────────────
  try {
    const overdueItbis = await (prisma as any).iTBISPeriod.findMany({
      where: { status: 'OVERDUE' },
      orderBy: { dueDate: 'asc' },
      take: 3,
    })
    for (const p of overdueItbis) {
      const daysLate = Math.floor((now.getTime() - new Date(p.dueDate).getTime()) / 86_400_000)
      results.push({
        id: `itbis-overdue-${p.id}`,
        type: 'error',
        title: `ITBIS vencido — Período ${p.period}`,
        message: `Declaración vencida hace ${daysLate}d · Por pagar: RD$ ${(p.payableItbis ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
        href: `/dashboard/accounting?tab=itbis`,
        createdAt: new Date(p.dueDate),
      })
    }
  } catch { /* table may not exist yet */ }

  // ── ITBIS periods approaching due date (≤5 days) ───────────
  try {
    const upcoming5 = new Date(now)
    upcoming5.setDate(upcoming5.getDate() + 5)
    const upcomingItbis = await (prisma as any).iTBISPeriod.findMany({
      where: { status: { in: ['OPEN', 'PRE_CLOSED'] }, dueDate: { lte: upcoming5, gte: now } },
      orderBy: { dueDate: 'asc' },
      take: 2,
    })
    for (const p of upcomingItbis) {
      const daysLeft = Math.ceil((new Date(p.dueDate).getTime() - now.getTime()) / 86_400_000)
      results.push({
        id: `itbis-upcoming-${p.id}`,
        type: 'warning',
        title: `ITBIS por vencer — Período ${p.period}`,
        message: `Vence en ${daysLeft}d · Calcular y declarar antes del día 20`,
        href: `/dashboard/accounting?tab=itbis`,
        createdAt: now,
      })
    }
  } catch { /* table may not exist yet */ }

  // ── Budget thresholds ─────────────────────────────────────
  try {
    const cfg = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
    const alertThreshold    = cfg?.budgetAlertThreshold    ?? 0.8
    const exceededThreshold = cfg?.budgetExceededThreshold ?? 1.0

    const budgets = await prisma.budget.findMany({
      select: { id: true, businessUnit: true, period: true, category: true, amountBudgeted: true, amountExecuted: true },
    })
    for (const b of budgets) {
      if (b.amountBudgeted <= 0) continue
      const pct = b.amountExecuted / b.amountBudgeted
      const label = `${b.businessUnit} ${b.period} ${b.category}`
      if (pct >= exceededThreshold) {
        results.push({
          id: `budget-exceeded-${b.id}`,
          type: 'error',
          title: `Presupuesto excedido — ${label}`,
          message: `Ejecutado: ${(pct * 100).toFixed(1)}% · RD$ ${b.amountExecuted.toLocaleString('es-DO', { minimumFractionDigits: 2 })} de RD$ ${b.amountBudgeted.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
          href: `/dashboard/budgets`,
          createdAt: now,
        })
      } else if (pct >= alertThreshold) {
        results.push({
          id: `budget-alert-${b.id}`,
          type: 'warning',
          title: `Presupuesto en alerta — ${label}`,
          message: `Ejecutado: ${(pct * 100).toFixed(1)}% · Disponible: RD$ ${(b.amountBudgeted - b.amountExecuted).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
          href: `/dashboard/budgets`,
          createdAt: now,
        })
      }
    }
  } catch { /* budget table may not exist */ }

  // ── Payroll: current month not calculated (from day 15) ───
  try {
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const [payrollThisMonth, activeEmployees] = await Promise.all([
      prisma.payroll.findFirst({ where: { period: thisMonth } }),
      prisma.employee.count({ where: { isActive: true } }),
    ])
    if (!payrollThisMonth && activeEmployees > 0 && now.getDate() >= 15) {
      results.push({
        id: `payroll-pending-${thisMonth}`,
        type: 'warning',
        title: `Nómina pendiente — ${thisMonth}`,
        message: `${activeEmployees} empleado${activeEmployees !== 1 ? 's' : ''} activo${activeEmployees !== 1 ? 's' : ''} · Nómina no calculada este mes`,
        href: `/dashboard/payroll`,
        createdAt: now,
      })
    }
  } catch { /* payroll tables may not exist */ }

  // ── Fixed assets: depreciation not run this month (from day 20) ──
  try {
    const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const [activeAssets, depThisMonth] = await Promise.all([
      prisma.fixedAsset.count({ where: { status: 'ACTIVE' } }),
      prisma.depreciationEntry.findFirst({ where: { period } }),
    ])
    if (activeAssets > 0 && !depThisMonth && now.getDate() >= 20) {
      results.push({
        id: `depreciation-pending-${period}`,
        type: 'info',
        title: `Depreciación pendiente — ${period}`,
        message: `${activeAssets} activo${activeAssets !== 1 ? 's' : ''} sin depreciar este período`,
        href: `/dashboard/fixed-assets`,
        createdAt: now,
      })
    }
  } catch { /* fixed assets table may not exist */ }

  // Sort by most recent first
  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return results.slice(0, 25)
}
