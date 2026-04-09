import { Request, Response, NextFunction } from 'express'
import { z, ZodSchema } from 'zod'
import { AppError } from './errorHandler'

/**
 * Generic Zod validation middleware.
 * Usage: router.post('/route', validate(mySchema), controller.method)
 */
export const validate =
  <T>(schema: ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const message = result.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(' | ')
      throw new AppError(message, 400)
    }
    // Attach parsed + transformed data back to request
    req[source] = result.data as any
    next()
  }
