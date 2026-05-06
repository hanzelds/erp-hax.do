import { Resend } from 'resend'
import { logger } from '../config/logger'

const FROM     = 'ERP Hax <noreply@hax.com.do>'
const REPLY_TO = 'hanzel@hax.com.do'
const API_KEY  = process.env.RESEND_API_KEY ?? 're_MT6onwf1_CUKDBaaU3YYdppxyi9k3H4ao'

let _client: Resend | null = null
function getClient() {
  if (!_client) _client = new Resend(API_KEY)
  return _client
}

export interface MailOptions {
  to:           string | string[]
  subject:      string
  html?:        string
  text?:        string
  attachments?: Array<{
    filename:     string
    content:      Buffer
    contentType?: string
  }>
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  try {
    // Build a body object with at least one of html/text present
    const body: { html?: string; text?: string } = {}
    if (opts.html) body.html = opts.html
    if (opts.text) body.text = opts.text
    if (!body.html && !body.text) body.text = opts.subject // fallback so type is satisfied

    const { error } = await getClient().emails.send({
      from:     FROM,
      replyTo:  REPLY_TO,
      to:       Array.isArray(opts.to) ? opts.to : [opts.to],
      subject:  opts.subject,
      ...body,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content:  a.content,
      })),
    } as any)   // `as any` needed because Resend v6 union type is overly strict

    if (error) {
      logger.error(`[Email] Resend error → ${opts.to}: ${(error as any).message ?? JSON.stringify(error)}`)
      return
    }

    logger.info(`[Email] Sent "${opts.subject}" → ${opts.to}`)
  } catch (err: any) {
    logger.error(`[Email] Error sending "${opts.subject}" → ${opts.to}: ${err.message}`)
  }
}
