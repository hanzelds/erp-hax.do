import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './recurring-payments.service'

export async function list(req: Request, res: Response) {
  const result = await svc.listRecurring(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}
export async function get(req: Request, res: Response) { sendSuccess(res, await svc.getRecurring(req.params.id)) }
export async function create(req: Request, res: Response) { sendCreated(res, await svc.createRecurring(req.body)) }
export async function update(req: Request, res: Response) { sendSuccess(res, await svc.updateRecurring(req.params.id, req.body)) }
export async function pay(req: Request, res: Response) { sendSuccess(res, await svc.payRecurring(req.params.id)) }
export async function remove(req: Request, res: Response) { await svc.deleteRecurring(req.params.id); sendSuccess(res, { message: 'Desactivado' }) }
