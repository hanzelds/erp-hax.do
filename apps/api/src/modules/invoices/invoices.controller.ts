import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './invoices.service'
import { getInvoicePdfBytes, generateAndSaveInvoicePdf } from '../../services/invoice-pdf.service'
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
export async function emit(req: Request, res: Response) {
  sendSuccess(res, await svc.emitInvoice(req.params.id))
}
export async function retry(req: Request, res: Response) {
  sendSuccess(res, await svc.retryEmission(req.params.id))
}
export async function creditNote(req: Request, res: Response) {
  sendCreated(res, await svc.createCreditNote(req.params.id, req.body))
}
export async function pdf(req: Request, res: Response) {
  const { bytes, filename } = await getInvoicePdfBytes(req.params.id)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
  res.send(Buffer.from(bytes))
}

export async function regeneratePdf(req: Request, res: Response) {
  const path = await generateAndSaveInvoicePdf(req.params.id)
  sendSuccess(res, { message: 'PDF regenerado', path })
}
