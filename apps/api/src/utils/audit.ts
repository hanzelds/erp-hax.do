import { AuditAction } from '@prisma/client'
import { prisma } from '../config/database'
import { logger } from '../config/logger'

interface AuditParams {
  userId: string
  action: AuditAction
  entity: string
  entityId: string
  before?: object | null
  after?: object | null
  ip?: string
  userAgent?: string
}

/**
 * Creates an audit log entry.
 * Failures are logged but never throw — audit must never break main flow.
 */
export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        ...params,
        before: params.before ?? undefined,
        after: params.after ?? undefined,
      },
    })
  } catch (error) {
    logger.error('Error creando audit log (no crítico):', error)
  }
}
