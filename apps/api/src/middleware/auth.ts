import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { prisma } from '../config/database'
import { UnauthorizedError, ForbiddenError } from './errorHandler'
import { UserRole } from '@prisma/client'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: UserRole
    name: string
  }
}

// ── Verify JWT and attach user to request ──────────────────────
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acceso requerido')
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string
      email: string
      role: UserRole
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id, isActive: true },
      select: { id: true, email: true, role: true, name: true },
    })

    if (!user) throw new UnauthorizedError('Usuario no encontrado o inactivo')

    req.user = user
    next()
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error
    throw new UnauthorizedError('Token inválido o expirado')
  }
}

// ── Role guards ────────────────────────────────────────────────
export const requireAdmin = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  if (req.user?.role !== UserRole.ADMIN) {
    throw new ForbiddenError('Se requieren permisos de administrador')
  }
  next()
}

export const requireAccountant = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT]
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    throw new ForbiddenError('Acceso denegado')
  }
  next()
}

// ── Flexible: allow specific roles ────────────────────────────
export const requireRoles = (...roles: UserRole[]) =>
  (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError('No tienes permiso para esta acción')
    }
    next()
  }
