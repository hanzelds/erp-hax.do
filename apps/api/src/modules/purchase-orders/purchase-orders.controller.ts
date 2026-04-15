import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './purchase-orders.service'

export async function list(req: Request, res: Response) {
  const result = await svc.listPOs(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}
export async function get(req: Request, res: Response) { sendSuccess(res, await svc.getPO(req.params.id)) }
export async function create(req: Request, res: Response) { sendCreated(res, await svc.createPO(req.body)) }
export async function update(req: Request, res: Response) { sendSuccess(res, await svc.updatePO(req.params.id, req.body)) }
export async function advance(req: Request, res: Response) { sendSuccess(res, await svc.advanceStatus(req.params.id)) }
export async function cancel(req: Request, res: Response) { sendSuccess(res, await svc.cancelPO(req.params.id)) }
