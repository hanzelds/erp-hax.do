import { Request, Response } from 'express'
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/response'
import * as svc from './fixed-assets.service'

export async function list(req: Request, res: Response) {
  const result = await svc.listFixedAssets(req.query)
  sendPaginated(res, result.data, result.total, result.page, result.limit)
}

export async function get(req: Request, res: Response) {
  sendSuccess(res, await svc.getFixedAsset(req.params.id))
}

export async function create(req: Request, res: Response) {
  sendCreated(res, await svc.createFixedAsset(req.body))
}

export async function update(req: Request, res: Response) {
  sendSuccess(res, await svc.updateFixedAsset(req.params.id, req.body))
}

export async function retire(req: Request, res: Response) {
  sendSuccess(res, await svc.retireFixedAsset(req.params.id))
}

export async function runDepreciation(req: Request, res: Response) {
  sendSuccess(res, await svc.calculateDepreciation())
}
