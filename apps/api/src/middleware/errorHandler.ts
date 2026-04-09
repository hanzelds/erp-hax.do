import { Request, Response, NextFunction } from 'express'
import { logger } from '../config/logger'

// ── Custom error classes ───────────────────────────────────────

export class AppError extends Error {
  public statusCode: number
  public isOperational: boolean

  constructor(message: string, statusCode: number = 500) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} no encontrado`, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(message, 403)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409)
  }
}

// ── Global error handler ───────────────────────────────────────

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // Operational errors (AppError subclasses)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    })
  }

  // Prisma known errors
  const prismaErr = err as any
  if (prismaErr?.constructor?.name === 'PrismaClientKnownRequestError') {
    if (prismaErr.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Ya existe un registro con ese valor',
      })
    }
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Registro no encontrado',
      })
    }
    if (prismaErr.code === 'P2003') {
      return res.status(400).json({
        success: false,
        error: 'Referencia inválida en los datos enviados',
      })
    }
  }

  // Prisma validation errors
  if (prismaErr?.constructor?.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Datos inválidos enviados a la base de datos',
    })
  }

  // JWT errors (fallback, should be caught by middleware first)
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: 'Token inválido' })
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Token expirado' })
  }

  // Unknown errors
  logger.error('Error no controlado:', { message: err.message, stack: err.stack })
  return res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
  })
}
