/**
 * Invoice emission workers
 *
 * invoice-emit  — processes new emission jobs (SENDING → APPROVED/REJECTED/IN_PROCESS)
 * invoice-poll  — polls Alanube for IN_PROCESS invoices (retries up to MAX_RETRIES)
 */

import { Worker, Job } from 'bullmq'
import { InvoiceStatus } from '@prisma/client'
import { prisma } from '../config/database'
import { env } from '../config/env'
import { logger } from '../config/logger'
import { emitEcf, pollStatus, buildNcf } from '../services/alanube.service'
import { invoicePollQueue } from '../queues/invoice.queue'

const connection = { url: env.REDIS_URL }
const MAX_RETRIES = 5
const POLL_DELAY_MS = 2 * 60 * 1000  // 2 minutes

// ── Emit worker ───────────────────────────────────────────
export const emitWorker = new Worker(
  'invoice-emit',
  async (job: Job<{ invoiceId: string }>) => {
    const { invoiceId } = job.data
    logger.info(`[EmitWorker] Processing invoice ${invoiceId}`)

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { select: { name: true, rnc: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
    })

    if (!invoice) {
      logger.warn(`[EmitWorker] Invoice ${invoiceId} not found`)
      return
    }

    if (invoice.status !== InvoiceStatus.SENDING) {
      logger.warn(`[EmitWorker] Invoice ${invoiceId} is not in SENDING state (${invoice.status})`)
      return
    }

    // Get NCF sequence from BusinessUnitConfig
    const config = await prisma.businessUnitConfig.findUnique({
      where: { businessUnit: invoice.businessUnit },
    })

    let ncf = invoice.ncf
    if (!ncf) {
      const seqField = getSeqField(invoice.type)
      const seq = (config as any)?.[seqField] ?? 1
      ncf = buildNcf(invoice.type, seq)

      // Increment sequence atomically
      await prisma.businessUnitConfig.upsert({
        where: { businessUnit: invoice.businessUnit },
        update: { [seqField]: { increment: 1 } },
        create: {
          businessUnit: invoice.businessUnit,
          [seqField]: 2,
          updatedAt: new Date(),
        },
      })
    }

    const payload = {
      invoiceId: invoice.id,
      ncf,
      businessUnit: invoice.businessUnit,
      type: invoice.type,
      issueDate: invoice.issueDate.toISOString().split('T')[0],
      clientName: invoice.client.name,
      clientRnc: invoice.client.rnc,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      items: invoice.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRate: i.taxRate,
        taxAmount: i.taxAmount,
        total: i.total,
      })),
    }

    // Record AlanubeRequest
    const attempt = invoice.retryCount + 1
    const alanubeReq = await prisma.alanubeRequest.create({
      data: {
        invoiceId: invoice.id,
        attempt,
        requestPayload: payload as any,
        sentAt: new Date(),
      },
    })

    let result
    try {
      result = await emitEcf(payload)
    } catch (err: any) {
      logger.error(`[EmitWorker] Alanube error for ${invoiceId}:`, err.message)
      await prisma.alanubeRequest.update({
        where: { id: alanubeReq.id },
        data: {
          status: 'ERROR',
          errorMessage: err.message,
          receivedAt: new Date(),
        },
      })
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: `Error de conexión: ${err.message}`,
          retryCount: attempt,
        },
      })
      return
    }

    // Update Alanube request record
    await prisma.alanubeRequest.update({
      where: { id: alanubeReq.id },
      data: {
        status: result.status,
        responsePayload: result as any,
        ncf: result.ncf || ncf,
        xml: result.xml,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        receivedAt: new Date(),
      },
    })

    if (result.status === 'APPROVED') {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.APPROVED,
          approvedAt: new Date(),
          ncf: result.ncf || ncf,
          xml: result.xml,
          alanubeId: result.alanubeId,
          alanubeStatus: 'APPROVED',
          retryCount: attempt,
          sentAt: invoice.sentAt ?? new Date(),
        },
      })
      logger.info(`[EmitWorker] Invoice ${invoiceId} APPROVED, NCF: ${result.ncf || ncf}`)
    } else if (result.status === 'REJECTED') {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: result.errorMessage ?? 'Rechazada por DGII',
          alanubeId: result.alanubeId,
          alanubeStatus: 'REJECTED',
          ncf: result.ncf || ncf,
          retryCount: attempt,
        },
      })
      logger.warn(`[EmitWorker] Invoice ${invoiceId} REJECTED: ${result.errorMessage}`)
    } else {
      // IN_PROCESS — schedule polling
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.IN_PROCESS,
          ncf: result.ncf || ncf,
          alanubeId: result.alanubeId,
          alanubeStatus: 'IN_PROCESS',
          retryCount: attempt,
          sentAt: invoice.sentAt ?? new Date(),
        },
      })
      await invoicePollQueue.add(
        'poll',
        { invoiceId, alanubeId: result.alanubeId, pollCount: 0 },
        { delay: POLL_DELAY_MS },
      )
      logger.info(`[EmitWorker] Invoice ${invoiceId} IN_PROCESS — scheduled poll`)
    }
  },
  { connection, concurrency: 5 },
)

// ── Poll worker ───────────────────────────────────────────
export const pollWorker = new Worker(
  'invoice-poll',
  async (job: Job<{ invoiceId: string; alanubeId: string | null; pollCount: number }>) => {
    const { invoiceId, alanubeId, pollCount } = job.data
    logger.info(`[PollWorker] Polling invoice ${invoiceId}, attempt ${pollCount + 1}`)

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return
    if (invoice.status !== InvoiceStatus.IN_PROCESS) {
      logger.info(`[PollWorker] Invoice ${invoiceId} no longer IN_PROCESS (${invoice.status}), skipping`)
      return
    }

    const result = alanubeId ? await pollStatus(alanubeId) : null

    if (!result) {
      // Still processing
      if (pollCount + 1 >= MAX_RETRIES) {
        // Give up — mark as REJECTED with timeout reason
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: InvoiceStatus.REJECTED,
            rejectedAt: new Date(),
            rejectionReason: 'Timeout: DGII no respondió después de 10 minutos',
            alanubeStatus: 'TIMEOUT',
          },
        })
        logger.warn(`[PollWorker] Invoice ${invoiceId} timed out after ${MAX_RETRIES} polls`)
      } else {
        await invoicePollQueue.add(
          'poll',
          { invoiceId, alanubeId, pollCount: pollCount + 1 },
          { delay: POLL_DELAY_MS },
        )
        logger.info(`[PollWorker] Invoice ${invoiceId} still IN_PROCESS, scheduled poll ${pollCount + 2}`)
      }
      return
    }

    if (result.status === 'APPROVED') {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.APPROVED,
          approvedAt: new Date(),
          ncf: result.ncf || invoice.ncf,
          xml: result.xml,
          alanubeStatus: 'APPROVED',
        },
      })
      logger.info(`[PollWorker] Invoice ${invoiceId} APPROVED via poll`)
    } else {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.REJECTED,
          rejectedAt: new Date(),
          rejectionReason: result.errorMessage ?? 'Rechazada por DGII',
          alanubeStatus: 'REJECTED',
        },
      })
      logger.warn(`[PollWorker] Invoice ${invoiceId} REJECTED via poll: ${result.errorMessage}`)
    }
  },
  { connection, concurrency: 5 },
)

emitWorker.on('failed', (job, err) => {
  logger.error(`[EmitWorker] Job ${job?.id} failed:`, err.message)
})
pollWorker.on('failed', (job, err) => {
  logger.error(`[PollWorker] Job ${job?.id} failed:`, err.message)
})

// ── Helpers ───────────────────────────────────────────────
function getSeqField(type: string): string {
  switch (type) {
    case 'CREDITO_FISCAL': return 'ncfCreditoFiscal'
    case 'CONSUMO':        return 'ncfConsumidor'
    case 'NOTA_DEBITO':    return 'ncfNotaDebito'
    case 'NOTA_CREDITO':   return 'ncfNotaCredito'
    default:               return 'ncfConsumidor'
  }
}
