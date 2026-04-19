import { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response'
import * as svc from './settings.service'

export async function getCompany(req: Request, res: Response) {
  sendSuccess(res, await svc.getCompanyConfig())
}
export async function updateCompany(req: Request, res: Response) {
  sendSuccess(res, await svc.updateCompanyConfig(req.body))
}
export async function getEcf(req: Request, res: Response) {
  sendSuccess(res, await svc.getEcfConfig())
}
export async function updateEcf(req: Request, res: Response) {
  sendSuccess(res, await svc.updateEcfConfig(req.body))
}
export async function getGeneral(req: Request, res: Response) {
  sendSuccess(res, await svc.getGeneralConfig())
}
export async function updateGeneral(req: Request, res: Response) {
  sendSuccess(res, await svc.updateGeneralConfig(req.body))
}
