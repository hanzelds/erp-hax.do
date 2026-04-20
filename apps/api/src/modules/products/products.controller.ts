import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './products.service'
import { BusinessUnit } from '@prisma/client'

export async function list(req: Request, res: Response) {
  const result = await svc.listProducts(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}
export async function get(req: Request, res: Response) {
  sendSuccess(res, await svc.getProduct(req.params.id))
}
export async function create(req: Request, res: Response) {
  sendCreated(res, await svc.createProduct(req.body))
}
export async function update(req: Request, res: Response) {
  sendSuccess(res, await svc.updateProduct(req.params.id, req.body))
}
export async function toggle(req: Request, res: Response) {
  sendSuccess(res, await svc.toggleProduct(req.params.id))
}
export async function stats(req: Request, res: Response) {
  sendSuccess(res, await svc.getProductStats(req.query.businessUnit as BusinessUnit))
}
export async function listCategories(req: Request, res: Response) {
  sendSuccess(res, await svc.listCategories())
}
export async function createCategory(req: Request, res: Response) {
  sendCreated(res, await svc.createCategory(req.body))
}
export async function remove(req: Request, res: Response) {
  await svc.deleteProduct(req.params.id)
  sendSuccess(res, { message: 'Producto eliminado' })
}
export async function deleteCategory(req: Request, res: Response) {
  await svc.deleteCategory(req.params.id)
  sendSuccess(res, { message: 'Categoría eliminada' })
}
