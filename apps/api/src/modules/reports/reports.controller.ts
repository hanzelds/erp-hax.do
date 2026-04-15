import { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response'
import * as svc from './reports.service'
import { BusinessUnit } from '@prisma/client'

const bu = (req: Request) => req.query.businessUnit as BusinessUnit | undefined

export async function dashboard(req: Request, res: Response) { sendSuccess(res, await svc.getDashboard(bu(req))) }
export async function pnl(req: Request, res: Response) { sendSuccess(res, await svc.getPnL(req.params.period, bu(req))) }
export async function balanceSheet(req: Request, res: Response) { sendSuccess(res, await svc.getBalanceSheet(bu(req))) }
export async function cashFlow(req: Request, res: Response) { sendSuccess(res, await svc.getCashFlow(req.params.period, bu(req))) }
export async function report606(req: Request, res: Response) { sendSuccess(res, await svc.get606(req.params.period, bu(req))) }
export async function report607(req: Request, res: Response) { sendSuccess(res, await svc.get607(req.params.period, bu(req))) }
