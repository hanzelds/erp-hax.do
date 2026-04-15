import { Request, Response } from 'express'
import { sendSuccess, sendCreated } from '../../utils/response'
import * as svc from './bank-accounts.service'
import { BusinessUnit } from '@prisma/client'

export async function list(req: Request, res: Response) { sendSuccess(res, await svc.listAccounts(req.query)) }
export async function get(req: Request, res: Response) { sendSuccess(res, await svc.getAccount(req.params.id)) }
export async function create(req: Request, res: Response) { sendCreated(res, await svc.createAccount(req.body)) }
export async function update(req: Request, res: Response) { sendSuccess(res, await svc.updateAccount(req.params.id, req.body)) }
export async function addTransaction(req: Request, res: Response) { sendCreated(res, await svc.addTransaction(req.params.id, req.body)) }
export async function summary(req: Request, res: Response) { sendSuccess(res, await svc.getAccountSummary(req.query.businessUnit as BusinessUnit)) }
