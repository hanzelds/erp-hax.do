import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './invoices.service'
import { BusinessUnit } from '@prisma/client'

export async function list(req: Request, res: Response) {
  const result = await svc.listInvoices(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}
export async function get(req: Request, res: Response) {
  sendSuccess(res, await svc.getInvoice(req.params.id))
}
export async function create(req: Request, res: Response) {
  sendCreated(res, await svc.createInvoice(req.body))
}
export async function update(req: Request, res: Response) {
  sendSuccess(res, await svc.updateInvoice(req.params.id, req.body))
}
export async function cancel(req: Request, res: Response) {
  sendSuccess(res, await svc.cancelInvoice(req.params.id))
}
export async function addPayment(req: Request, res: Response) {
  sendCreated(res, await svc.addPayment(req.params.id, req.body))
}
export async function stats(req: Request, res: Response) {
  sendSuccess(res, await svc.getInvoiceStats(req.query.businessUnit as BusinessUnit))
}
