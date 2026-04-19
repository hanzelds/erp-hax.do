import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'
import { logger } from '../config/logger'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'CANCEL' | 'PAY' | 'EMIT' | 'LOGIN' | 'EXPORT'

const METHOD_ACTION: Record<string, AuditAction> = {
  POST:   'CREATE',
  PUT:    'UPDATE',
  PATCH:  'UPDATE',
  DELETE: 'DELETE',
}

/** Map URL patterns to more specific actions */
function resolveAction(req: Request): AuditAction {
  const path = req.path.toLowerCase()
  const method = req.method
  if (path.endsWith('/cancel'))   return 'CANCEL'
  if (path.endsWith('/approve'))  return 'APPROVE'
  if (path.endsWith('/pay') || path.endsWith('/pay-tss') || path.endsWith('/pay-isr')) return 'PAY'
  if (path.endsWith('/emit') || path.endsWith('/retry'))   return 'EMIT'
  if (path.endsWith('/export'))   return 'EXPORT'
  return METHOD_ACTION[method] ?? 'UPDATE'
}

/** Extracts entity name from route: /api/invoices/:id → 'invoice' */
function resolveEntity(req: Request): string {
  const segments = req.baseUrl.split('/').filter(Boolean)
  // segments: ['api', 'invoices'] → last = 'invoices' → singular
  const last = segments[segments.length - 1] ?? 'unknown'
  return last.replace(/s$/, '') // naive singular
}

/** Extracts entity ID from params */
function resolveEntityId(req: Request): string {
  return req.params.id ?? req.params.employeeId ?? req.body?.id ?? 'unknown'
}

/** Middleware factory — attach after auth middleware on write routes */
export function auditLog(entity?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id
    if (!userId || req.method === 'GET') return next()

    // Capture response via monkey-patch
    const originalJson = res.json.bind(res)
    res.json = function (body: any) {
      // Fire-and-forget — don't block response
      const action = resolveAction(req)
      const ent    = entity ?? resolveEntity(req)
      const entId  = resolveEntityId(req)
      const after  = body?.data ?? body

      prisma.auditLog.create({
        data: {
          userId,
          action: action as any,
          entity: ent,
          entityId: entId,
          after: after && typeof after === 'object' ? after : undefined,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      }).catch((err: Error) => logger.warn(`[AuditLog] Failed to write: ${err.message}`))

      return originalJson(body)
    }

    next()
  }
}
