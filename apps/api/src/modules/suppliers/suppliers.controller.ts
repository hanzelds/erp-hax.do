import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './suppliers.service'

export async function list(req: Request, res: Response) {
  const result = await svc.listSuppliers(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}
export async function get(req: Request, res: Response) {
  sendSuccess(res, await svc.getSupplier(req.params.id))
}
export async function create(req: Request, res: Response) {
  sendCreated(res, await svc.createSupplier(req.body))
}
export async function update(req: Request, res: Response) {
  sendSuccess(res, await svc.updateSupplier(req.params.id, req.body))
}
export async function remove(req: Request, res: Response) {
  await svc.deleteSupplier(req.params.id)
  sendSuccess(res, { message: 'Proveedor desactivado' })
}
export async function stats(req: Request, res: Response) {
  sendSuccess(res, await svc.getSupplierStats())
}
