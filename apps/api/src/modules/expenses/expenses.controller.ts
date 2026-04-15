import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './expenses.service'
import { BusinessUnit } from '@prisma/client'

export async function list(req: Request, res: Response) {
  const result = await svc.listExpenses(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}
export async function get(req: Request, res: Response) { sendSuccess(res, await svc.getExpense(req.params.id)) }
export async function create(req: Request, res: Response) { sendCreated(res, await svc.createExpense(req.body)) }
export async function update(req: Request, res: Response) { sendSuccess(res, await svc.updateExpense(req.params.id, req.body)) }
export async function approve(req: Request, res: Response) { sendSuccess(res, await svc.approveExpense(req.params.id)) }
export async function markPaid(req: Request, res: Response) { sendSuccess(res, await svc.markPaid(req.params.id)) }
export async function remove(req: Request, res: Response) { await svc.deleteExpense(req.params.id); sendSuccess(res, { message: 'Gasto cancelado' }) }
export async function stats(req: Request, res: Response) { sendSuccess(res, await svc.getExpenseStats(req.query.businessUnit as BusinessUnit)) }
