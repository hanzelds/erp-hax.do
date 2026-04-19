import { Request, Response } from 'express'
import { sendSuccess, sendCreated } from '../../utils/response'
import * as svc from './bank-reconciliation.service'

export async function list(req: Request, res: Response) {
  sendSuccess(res, await svc.listReconciliations())
}

export async function get(req: Request, res: Response) {
  sendSuccess(res, await svc.getReconciliation(req.params.id))
}

export async function create(req: Request, res: Response) {
  const { bankAccountId, period, notes } = req.body
  sendCreated(res, await svc.createReconciliation(bankAccountId, period, notes))
}

export async function importTransactions(req: Request, res: Response) {
  sendSuccess(res, await svc.importTransactions(req.params.id, req.body.transactions))
}

export async function matchTransaction(req: Request, res: Response) {
  const { txId } = req.params
  const { matchedPaymentId, matchedExpenseId } = req.body
  sendSuccess(res, await svc.matchTransaction(txId, { matchedPaymentId, matchedExpenseId }))
}

export async function ignoreTransaction(req: Request, res: Response) {
  const { txId } = req.params
  const { notes } = req.body
  sendSuccess(res, await svc.ignoreTransaction(txId, notes ?? ''))
}

export async function closeReconciliation(req: Request, res: Response) {
  const userId = (req as any).user?.id
  sendSuccess(res, await svc.closeReconciliation(req.params.id, userId))
}
