import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './quotes.service'
import { BusinessUnit } from '@prisma/client'

export async function list(req: Request, res: Response) {
  const result = await svc.listQuotes(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}
export async function get(req: Request, res: Response) {
  sendSuccess(res, await svc.getQuote(req.params.id))
}
export async function create(req: Request, res: Response) {
  sendCreated(res, await svc.createQuote(req.body))
}
export async function update(req: Request, res: Response) {
  sendSuccess(res, await svc.updateQuote(req.params.id, req.body))
}
export async function send(req: Request, res: Response) {
  sendSuccess(res, await svc.sendQuote(req.params.id))
}
export async function accept(req: Request, res: Response) {
  sendSuccess(res, await svc.acceptQuote(req.params.id))
}
export async function reject(req: Request, res: Response) {
  sendSuccess(res, await svc.rejectQuote(req.params.id, req.body.reason))
}
export async function convert(req: Request, res: Response) {
  sendCreated(res, await svc.convertToInvoice(req.params.id, req.body))
}
export async function stats(req: Request, res: Response) {
  sendSuccess(res, await svc.getQuoteStats(req.query.businessUnit as BusinessUnit | undefined))
}
