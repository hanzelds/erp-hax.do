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

  // Sort by most recent first
  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return results.slice(0, 20)
}
