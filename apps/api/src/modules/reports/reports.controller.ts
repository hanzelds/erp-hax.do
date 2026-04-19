import { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response'
import * as svc from './reports.service'
import { BusinessUnit } from '@prisma/client'

const bu = (req: Request) => req.query.businessUnit as BusinessUnit | undefined

export async function dashboard(req: Request, res: Response) { sendSuccess(res, await svc.getDashboard(bu(req))) }
export async function pnl(req: Request, res: Response) { sendSuccess(res, await svc.getPnL(req.params.period, bu(req))) }
export async function balanceSheet(req: Request, res: Response) { sendSuccess(res, await svc.getBalanceSheet(bu(req))) }
export async function cashFlow(req: Request, res: Response) { sendSuccess(res, await svc.getCashFlow(req.params.period, bu(req))) }
export async function report606(req: Request, res: Response) { sendSuccess(res, await svc.get606(req.params.period, bu(req))) }
export async function report607(req: Request, res: Response) { sendSuccess(res, await svc.get607(req.params.period, bu(req))) }

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCsvRow(values: any[]): string {
  return values.map(escapeCsv).join(',')
}

export async function export607Csv(req: Request, res: Response) {
  const period = req.params.period
  const data = await svc.get607(period, bu(req))

  const headers = ['NCF', 'RNC Cliente', 'Nombre', 'Fecha', 'SubTotal', 'ITBIS', 'Total']
  const rows = data.records.map((inv: any) =>
    toCsvRow([
      inv.ncf ?? '',
      inv.client?.rnc ?? '',
      inv.client?.name ?? '',
      inv.issueDate ? new Date(inv.issueDate).toISOString().split('T')[0] : '',
      inv.subtotal,
      inv.taxAmount,
      inv.total,
    ]),
  )

  const csv = [headers.join(','), ...rows].join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="607-${period}.csv"`)
  res.send(csv)
}

export async function export606Csv(req: Request, res: Response) {
  const period = req.params.period
  const data = await svc.get606(period, bu(req))

  const headers = ['NCF Proveedor', 'RNC Proveedor', 'Nombre', 'Fecha', 'SubTotal', 'ITBIS', 'Total', 'Categoría']
  const rows = data.records.map((exp: any) =>
    toCsvRow([
      exp.ncf ?? '',
      exp.supplierRef?.rnc ?? '',
      exp.supplierRef?.name ?? exp.supplierName ?? '',
      exp.expenseDate ? new Date(exp.expenseDate).toISOString().split('T')[0] : '',
      exp.amount,
      exp.taxAmount,
      exp.total,
      exp.category ?? '',
    ]),
  )

  const csv = [headers.join(','), ...rows].join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="606-${period}.csv"`)
  res.send(csv)
}
