import { Request, Response } from 'express'
import { sendSuccess, sendPaginated } from '../../utils/response'
import * as svc from './payments.service'

export async function list(req: Request, res: Response) {
  const result = await svc.listPayments(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}

export async function stats(req: Request, res: Response) {
  sendSuccess(res, await svc.getPaymentStats(req.query))
}
