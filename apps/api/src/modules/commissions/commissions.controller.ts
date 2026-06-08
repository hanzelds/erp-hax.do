import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './commissions.service'
import { BusinessUnit } from '@prisma/client'

// ── Plans ─────────────────────────────────────────────────────

export async function listPlans(req: Request, res: Response) {
  const result = await svc.listPlans(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}

export async function createPlan(req: Request, res: Response) {
  sendCreated(res, await svc.createPlan(req.body))
}

export async function updatePlan(req: Request, res: Response) {
  sendSuccess(res, await svc.updatePlan(req.params.id, req.body))
}

export async function deletePlan(req: Request, res: Response) {
  sendSuccess(res, await svc.deletePlan(req.params.id))
}

// ── Calculate ─────────────────────────────────────────────────

export async function calculate(req: Request, res: Response) {
  const { period, businessUnit, planIds, proformaOnly } = req.body
  sendSuccess(res, await svc.calculate({
    period,
    businessUnit:  businessUnit  as BusinessUnit | undefined,
    planIds:       planIds       as string[]     | undefined,
    proformaOnly:  proformaOnly === true || proformaOnly === 'true',
  }))
}

// ── Entries ───────────────────────────────────────────────────

export async function listEntries(req: Request, res: Response) {
  const result = await svc.listEntries(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}

export async function approveEntry(req: Request, res: Response) {
  sendSuccess(res, await svc.approveEntry(req.params.id))
}

export async function sendToPayroll(req: Request, res: Response) {
  sendSuccess(res, await svc.sendToPayroll(req.params.id))
}

export async function cancelEntry(req: Request, res: Response) {
  sendSuccess(res, await svc.cancelEntry(req.params.id))
}
