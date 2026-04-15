import { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response'
import * as svc from './settings.service'
import { BusinessUnit } from '@prisma/client'

export async function getAll(req: Request, res: Response) {
  sendSuccess(res, await svc.getAllEcfConfigs())
}

export async function getOne(req: Request, res: Response) {
  const bu = req.params.bu.toUpperCase() as BusinessUnit
  sendSuccess(res, await svc.getEcfConfig(bu))
}

export async function update(req: Request, res: Response) {
  const bu = req.params.bu.toUpperCase() as BusinessUnit
  const config = await svc.updateEcfConfig(bu, req.body)
  // Return masked version
  sendSuccess(res, await svc.getEcfConfig(bu))
}
