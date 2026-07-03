import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './crm.service'
import { BusinessUnit } from '@prisma/client'

export async function list(req: Request, res: Response) {
  const result = await svc.listOpportunities(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}
export async function pipeline(req: Request, res: Response) {
  sendSuccess(res, await svc.getPipeline(req.query.businessUnit as BusinessUnit | undefined))
}
export async function analytics(req: Request, res: Response) {
  sendSuccess(res, await svc.getAnalytics(req.query.businessUnit as BusinessUnit | undefined))
}
export async function get(req: Request, res: Response) { sendSuccess(res, await svc.getOpportunity(req.params.id)) }
export async function create(req: Request, res: Response) { sendCreated(res, await svc.createOpportunity(req.body)) }
export async function bulkCreate(req: Request, res: Response) { sendCreated(res, await svc.bulkCreateOpportunities(req.body.opportunities)) }
export async function update(req: Request, res: Response) { sendSuccess(res, await svc.updateOpportunity(req.params.id, req.body)) }
export async function remove(req: Request, res: Response) { await svc.deleteOpportunity(req.params.id); sendSuccess(res, { message: 'Eliminado' }) }

export async function bulkStatus(req: Request, res: Response) {
  const { ids, status } = req.body
  sendSuccess(res, await svc.bulkUpdateStatus(ids, status))
}
export async function bulkAssign(req: Request, res: Response) {
  const { ids, assignedTo } = req.body
  sendSuccess(res, await svc.bulkAssign(ids, assignedTo))
}
export async function exportCsv(req: Request, res: Response) {
  const csv = await svc.exportCsv(req.query)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="crm-export-${new Date().toISOString().slice(0,10)}.csv"`)
  res.send('﻿' + csv)
}

export async function listActivities(req: Request, res: Response) {
  sendSuccess(res, await svc.listActivities(req.params.id))
}
export async function createActivity(req: Request, res: Response) {
  sendCreated(res, await svc.createActivity(req.params.id, req.body))
}
export async function updateActivity(req: Request, res: Response) {
  sendSuccess(res, await svc.updateActivity(req.params.id, req.params.actId, req.body))
}
export async function deleteActivity(req: Request, res: Response) {
  await svc.deleteActivity(req.params.id, req.params.actId)
  sendSuccess(res, { message: 'Eliminado' })
}
