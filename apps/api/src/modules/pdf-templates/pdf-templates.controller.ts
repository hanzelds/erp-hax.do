import { Request, Response } from 'express'
import { sendSuccess, sendCreated } from '../../utils/response'
import * as svc from './pdf-templates.service'
import { PdfTemplateType } from '@prisma/client'

export async function list(req: Request, res: Response) {
  const type = req.query.type as PdfTemplateType | undefined
  sendSuccess(res, await svc.listTemplates(type))
}

export async function get(req: Request, res: Response) {
  sendSuccess(res, await svc.getTemplate(req.params.id))
}

export async function create(req: Request, res: Response) {
  sendCreated(res, await svc.createTemplate(req.body))
}

export async function update(req: Request, res: Response) {
  sendSuccess(res, await svc.updateTemplate(req.params.id, req.body))
}

export async function remove(req: Request, res: Response) {
  sendSuccess(res, await svc.deleteTemplate(req.params.id))
}

export async function activate(req: Request, res: Response) {
  sendSuccess(res, await svc.activateTemplate(req.params.id))
}

export async function deactivate(req: Request, res: Response) {
  const type = req.params.type as PdfTemplateType
  sendSuccess(res, await svc.deactivateTemplates(type))
}

export async function preview(req: Request, res: Response) {
  const bytes = await svc.previewTemplate(req.params.id)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"')
  res.send(Buffer.from(bytes))
}

/** Upload HTML file — multipart/form-data with field "html" or raw body */
export async function upload(req: Request, res: Response) {
  // Support both JSON body (html string) and file upload (req.body.html from multer)
  const { type, name, description, html } = req.body
  if (!html || !type || !name) {
    res.status(400).json({ success: false, error: 'Faltan campos: type, name, html' })
    return
  }
  sendCreated(res, await svc.createTemplate({ type, name, description, html }))
}
