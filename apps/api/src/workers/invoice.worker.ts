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
import { emitEcf, pollStatus, buildNcf, getBuConfig, getSeqField } from '../services/alanube.service'
import { invoicePollQueue, invoiceEmitQueue } from '../queues/invoice.queue'
import { generateAndSaveInvoicePdf } from '../services/invoice-pdf.service'

const connection = { url: env.REDIS_URL }

// Exponential backoff delays (ms) per retry attempt (0-indexed)
const RETRY_DELAYS = [5000, 15000, 45000]

async function autoJournalEntry(opts: {
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE'
  businessUnit: 'HAX' | 'KODER'
  description: string
  debitCode: string
  creditCode: string
  amount: number
  invoiceId?: string
  paymentId?: string
  period: string // "YYYY-MM"
}) {
  if (opts.amount <= 0) return null
  const [debit, credit] = await Promise.all([
    prisma.account.findUnique({ where: { code: opts.debitCode } }),
    prisma.account.findUnique({ where: { code: opts.creditCode } }),
  ])
  if (!debit || !credit) return null
  return prisma.journalEntry.create({
    data: {
      type: opts.type,
      businessUnit: opts.businessUnit as any,
      description: opts.description,
      debitAccountId: debit.id,
      creditAccountId: credit.id,
      amount: opts.amount,
      period: opts.period,
      invoiceId: opts.invoiceId,
      paymentId: opts.paymentId,
    },
  })
}

async function createApprovalJournalEntries(invoiceId: string, approvedAt: Date) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return

  const ecfConfig = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (!ecfConfig?.autoJournalEntries) return

  const period = `${approvedAt.getFullYear()}-${String(approvedAt.getMonth() + 1).padStart(2, '0')}`
  const incomeAccount = invoice.businessUnit === 'HAX'
    ? (ecfConfig.acctIncomeHax   || '4101')
    : (ecfConfig.acctIncomeKoder || '4102')
  const acctReceivables  = ecfConfig.acctReceivables  || '1201'
  const acctItbisPayable = ecfConfig.acctItbisPayable || '2201'
  const isCreditNote = invoice.type === 'NOTA_CREDITO'

  if (isCreditNote) {
    // Nota de crédito aprobada — reverso: Dr Ingresos / Cr CxC
    await autoJournalEntry({
      type: 'CREDIT_NOTE',
      businessUnit: invoice.businessUnit as 'HAX' | 'KODER',
      description: `Nota de crédito aprobada ${invoice.number ?? invoiceId}`,
      debitCode: incomeAccount,
      creditCode: acctReceivables,
      amount: invoice.subtotal,
      invoiceId,
      period,
    })
    return
  }

  // Factura normal aprobada
  // Entry 1: Dr CxC (subtotal) / Cr Ingreso (subtotal)
  await autoJournalEntry({
    type: 'INVOICE',
    businessUnit: invoice.businessUnit as 'HAX' | 'KODER',
    description: `Factura aprobada ${invoice.number ?? invoiceId} - subtotal`,
    debitCode: acctReceivables,
    creditCode: incomeAccount,
    amount: invoice.subtotal,
    invoiceId,
    period,
  })

  // Entry 2: Dr CxC (taxAmount) / Cr ITBIS por pagar — only if taxAmount > 0
  if (invoice.taxAmount > 0) {
    await autoJournalEntry({
      type: 'INVOICE',
      businessUnit: invoice.businessUnit as 'HAX' | 'KODER',
      description: `Factura aprobada ${invoice.number ?? invoiceId} - ITBIS`,
      debitCode: acctReceivables,
      creditCode: acctItbisPayable,
      amount: invoice.taxAmount,
      invoiceId,
      period,
    })
  }
}

// ── Emit worker ───────────────────────────────────────────
export const emitWorker = new Worker(
  'invoice-emit',
  async (job: Job<{ invoiceId: string; retryAttempt?: number }>) => {
    const { invoiceId, retryAttempt = 0 } = job.data
    logger.info(`[EmitWorker] Processing invoice ${invoiceId} (attempt ${retryAttempt + 1})`)

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

    // Load per-BU config (includes maxRetryCount, pollInterval, etc.)
    const buConfig = await getBuConfig(invoice.businessUnit)

    let ncf = invoice.ncf
    if (!ncf) {
      const seqField = getSeqField(invoice.type)
      const dbConfig = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
      const seq = (dbConfig as any)?.[seqField] ?? 1
      ncf = buildNcf(invoice.type, seq)

      // Increment sequence atomically
      await prisma.ecfConfig.upsert({
        where:  { id: 'main' },
        update: { [seqField]: { increment: 1 } },
        create: { id: 'main', [seqField]: 2 },
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

      // Exponential backoff retry
      if (retryAttempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[retryAttempt]
        logger.info(`[EmitWorker] Scheduling retry ${retryAttempt + 1} for invoice ${invoiceId} in ${delay}ms`)
        await invoiceEmitQueue.add(
          'emit',
          { invoiceId, retryAttempt: retryAttempt + 1 },
          {
            jobId: `emit-${invoiceId}-retry-${retryAttempt + 1}-${Date.now()}`,
            delay,
            removeOnComplete: true,
          },
        )
      } else {
        // Max retries exceeded — mark as REJECTED
        logger.warn(`[EmitWorker] Max retries reached for invoice ${invoiceId}, marking as REJECTED`)
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: InvoiceStatus.REJECTED,
            rejectedAt: new Date(),
            rejectionReason: `Error de conexión tras ${RETRY_DELAYS.length} intentos: ${err.message}`,
            retryCount: attempt,
          },
        })
      }
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
      const approvedAt = new Date()
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.APPROVED,
          approvedAt,
          ncf: result.ncf || ncf,
          xml: result.xml,
          alanubeId: result.alanubeId,
          alanubeStatus: 'APPROVED',
          retryCount: attempt,
          sentAt: invoice.sentAt ?? new Date(),
        },
      })
      logger.info(`[EmitWorker] Invoice ${invoiceId} APPROVED, NCF: ${result.ncf || ncf}`)

      // Auto journal entries after approval
      try {
        await createApprovalJournalEntries(invoiceId, approvedAt)
      } catch (je: any) {
        logger.error(`[EmitWorker] Journal entry error for ${invoiceId}:`, je.message)
      }
      // Auto-generate PDF
      generateAndSaveInvoicePdf(invoiceId).catch((e: any) =>
        logger.error(`[EmitWorker] PDF generation error for ${invoiceId}:`, e.message)
      )
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
      const pollDelayMs = buConfig.pollIntervalSeconds * 1000
      await invoicePollQueue.add(
        'poll',
        { invoiceId, alanubeId: result.alanubeId, pollCount: 0, businessUnit: invoice.businessUnit },
        { delay: pollDelayMs },
      )
      logger.info(`[EmitWorker] Invoice ${invoiceId} IN_PROCESS — scheduled poll`)
    }
  },
  { connection, concurrency: 5 },
)

// ── Poll worker ───────────────────────────────────────────
export const pollWorker = new Worker(
  'invoice-poll',
  async (job: Job<{ invoiceId: string; alanubeId: string | null; pollCount: number; businessUnit?: string }>) => {
    const { invoiceId, alanubeId, pollCount, businessUnit } = job.data
    logger.info(`[PollWorker] Polling invoice ${invoiceId}, attempt ${pollCount + 1}`)

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return
    if (invoice.status !== InvoiceStatus.IN_PROCESS) {
      logger.info(`[PollWorker] Invoice ${invoiceId} no longer IN_PROCESS (${invoice.status}), skipping`)
      return
    }

    const buConfig = await getBuConfig(invoice.businessUnit)
    const maxPolls = Math.ceil((buConfig.pollTimeoutMinutes * 60) / buConfig.pollIntervalSeconds)
    const pollDelayMs = buConfig.pollIntervalSeconds * 1000

    const result = alanubeId ? await pollStatus(alanubeId, invoice.businessUnit) : null

    if (!result) {
      if (pollCount + 1 >= maxPolls) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: InvoiceStatus.REJECTED,
            rejectedAt: new Date(),
            rejectionReason: `Timeout: DGII no respondió en ${buConfig.pollTimeoutMinutes} minutos`,
            alanubeStatus: 'TIMEOUT',
          },
        })
        logger.warn(`[PollWorker] Invoice ${invoiceId} timed out after ${maxPolls} polls`)
      } else {
        await invoicePollQueue.add(
          'poll',
          { invoiceId, alanubeId, pollCount: pollCount + 1, businessUnit: invoice.businessUnit },
          { delay: pollDelayMs },
        )
        logger.info(`[PollWorker] Invoice ${invoiceId} still IN_PROCESS, scheduled poll ${pollCount + 2}`)
      }
      return
    }

    if (result.status === 'APPROVED') {
      const approvedAt = new Date()
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.APPROVED,
          approvedAt,
          ncf: result.ncf || invoice.ncf,
          xml: result.xml,
          alanubeStatus: 'APPROVED',
        },
      })
      logger.info(`[PollWorker] Invoice ${invoiceId} APPROVED via poll`)

      // Auto journal entries after approval
      try {
        await createApprovalJournalEntries(invoiceId, approvedAt)
      } catch (je: any) {
        logger.error(`[PollWorker] Journal entry error for ${invoiceId}:`, je.message)
      }
      // Auto-generate PDF
      generateAndSaveInvoicePdf(invoiceId).catch((e: any) =>
        logger.error(`[PollWorker] PDF generation error for ${invoiceId}:`, e.message)
      )
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
