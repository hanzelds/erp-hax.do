import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './budgets.service'

export async function list(req: Request, res: Response) {
  const result = await svc.listBudgets(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}

export async function create(req: Request, res: Response) {
  sendCreated(res, await svc.createBudget(req.body))
}

export async function update(req: Request, res: Response) {
  sendSuccess(res, await svc.updateBudget(req.params.id, req.body))
}

export async function syncExecution(req: Request, res: Response) {
  const { period, businessUnit } = req.body
  sendSuccess(res, await svc.syncBudgetExecution(period, businessUnit))
}

export async function summary(req: Request, res: Response) {
  const period = (req.query.period as string) || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()
  sendSuccess(res, await svc.getBudgetSummary(period))
}
