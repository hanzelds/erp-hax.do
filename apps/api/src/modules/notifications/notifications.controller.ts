import { Request, Response } from 'express'
import { sendSuccess } from '../../utils/response'
import * as svc from './notifications.service'

export async function list(req: Request, res: Response) {
  sendSuccess(res, await svc.getNotifications())
}
