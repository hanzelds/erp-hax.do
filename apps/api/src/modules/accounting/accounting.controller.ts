import { Request, Response } from 'express'
import { sendSuccess, sendPaginated } from '../../utils/response'
import * as svc from './accounting.service'

export async function chartOfAccounts(req: Request, res: Response) {
  sendSuccess(res, await svc.getChartOfAccounts())
}

export async function journalEntries(req: Request, res: Response) {
  const result = await svc.getJournalEntries(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}

export async function ledger(req: Request, res: Response) {
  sendSuccess(res, await svc.getLedger(req.params.code, req.query.period as string | undefined))
}

export async function trialBalance(req: Request, res: Response) {
  const period = (req.query.period as string) || (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()
  sendSuccess(res, await svc.getTrialBalance(period))
}

export async function fiscalPeriods(req: Request, res: Response) {
  sendSuccess(res, await svc.getFiscalPeriods())
}

export async function closePeriod(req: Request, res: Response) {
  const userId = (req as any).user?.id
  sendSuccess(res, await svc.closePeriod(req.params.period, userId))
}
