import nodemailer from 'nodemailer'
import { logger } from '../config/logger'

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST  ?? 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },
  tls: { rejectUnauthorized: false },
})

export interface MailOptions {
  to:          string
  subject:     string
  html?:       string
  text?:       string
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  if (!process.env.SMTP_PASS) {
    logger.warn(`[Email] SMTP_PASS not configured – skipping email to ${opts.to}`)
    return
  }
  const from = `${process.env.COMPANY_NAME ?? 'ERP'} <${process.env.SMTP_USER ?? 'noreply@hax.com.do'}>`
  await transporter.sendMail({ from, ...opts })
  logger.info(`[Email] Sent "${opts.subject}" → ${opts.to}`)
}
