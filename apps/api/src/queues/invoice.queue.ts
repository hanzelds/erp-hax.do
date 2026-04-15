import { Queue, QueueEvents } from 'bullmq'
import { env } from '../config/env'

const connection = { url: env.REDIS_URL }

// Queue for initial emission (DRAFT → SENDING → result)
export const invoiceEmitQueue = new Queue('invoice-emit', {
  connection,
  defaultJobOptions: {
    attempts: 1,       // single attempt; worker handles retries internally
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})

// Queue for IN_PROCESS polling (delayed re-check)
export const invoicePollQueue = new Queue('invoice-poll', {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 200,
    removeOnFail: 200,
  },
})

export const invoiceEmitEvents = new QueueEvents('invoice-emit', { connection })
export const invoicePollEvents = new QueueEvents('invoice-poll', { connection })
