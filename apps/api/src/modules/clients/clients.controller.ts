import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './clients.service'

export async function list(req: Request, res: Response) {
  const result = await svc.listClients(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}

export async function get(req: Request, res: Response) {
  const data = await svc.getClient(req.params.id)
  sendSuccess(res, data)
}

export async function create(req: Request, res: Response) {
  const data = await svc.createClient(req.body)
  sendCreated(res, data)
}

export async function update(req: Request, res: Response) {
  const data = await svc.updateClient(req.params.id, req.body)
  sendSuccess(res, data)
}

export async function remove(req: Request, res: Response) {
  await svc.deleteClient(req.params.id)
  sendSuccess(res, { message: 'Cliente desactivado' })
}

export async function stats(req: Request, res: Response) {
  const data = await svc.getClientStats()
  sendSuccess(res, data)
}
