import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './payroll.service'
import { BusinessUnit } from '@prisma/client'

const bu = (req: Request) => req.query.businessUnit as BusinessUnit | undefined

// ── Employees ─────────────────────────────────────────────────

export async function listEmployees(req: Request, res: Response) {
  const result = await svc.listEmployees(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}

export async function getEmployee(req: Request, res: Response) {
  sendSuccess(res, await svc.getEmployee(req.params.id))
}

export async function createEmployee(req: Request, res: Response) {
  sendCreated(res, await svc.createEmployee(req.body))
}

export async function updateEmployee(req: Request, res: Response) {
  sendSuccess(res, await svc.updateEmployee(req.params.id, req.body))
}

export async function terminateEmployee(req: Request, res: Response) {
  sendSuccess(res, await svc.terminateEmployee(req.params.id))
}

// ── Payroll ───────────────────────────────────────────────────

export async function listPayrolls(req: Request, res: Response) {
  const result = await svc.listPayrolls(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}

export async function getPayroll(req: Request, res: Response) {
  sendSuccess(res, await svc.getPayroll(req.params.id))
}

export async function calculatePayroll(req: Request, res: Response) {
  const { businessUnit, period } = req.body
  sendCreated(res, await svc.calculatePayroll(businessUnit, period))
}

export async function approvePayroll(req: Request, res: Response) {
  sendSuccess(res, await svc.approvePayroll(req.params.id))
}

export async function processPayment(req: Request, res: Response) {
  sendSuccess(res, await svc.processPayment(req.params.id))
}

export async function payTss(req: Request, res: Response) {
  sendSuccess(res, await svc.payTss(req.params.id))
}

export async function payIsr(req: Request, res: Response) {
  sendSuccess(res, await svc.payIsr(req.params.id))
}

export async function stats(req: Request, res: Response) {
  sendSuccess(res, await svc.getPayrollStats(bu(req)))
}
