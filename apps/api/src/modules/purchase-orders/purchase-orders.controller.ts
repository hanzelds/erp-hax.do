import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './purchase-orders.service'
import { getPurchaseOrderPdfBytes } from '../../services/purchase-order-pdf.service'

export async function list(req: Request, res: Response) {
  const result = await svc.listPOs(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}
export async function get(req: Request, res: Response) { sendSuccess(res, await svc.getPO(req.params.id)) }
export async function create(req: Request, res: Response) { sendCreated(res, await svc.createPO(req.body)) }
export async function update(req: Request, res: Response) { sendSuccess(res, await svc.updatePO(req.params.id, req.body)) }
export async function advance(req: Request, res: Response) { sendSuccess(res, await svc.advanceStatus(req.params.id)) }
export async function cancel(req: Request, res: Response) { sendSuccess(res, await svc.cancelPO(req.params.id)) }
export async function pay(req: Request, res: Response) { sendSuccess(res, await svc.registerPayment(req.params.id, req.body)) }
export async function cxpList(req: Request, res: Response) {
  const result = await svc.getCxPList(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}

export async function pdf(req: Request, res: Response) {
  const { bytes, filename } = await getPurchaseOrderPdfBytes(req.params.id)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
  res.send(Buffer.from(bytes))
}
