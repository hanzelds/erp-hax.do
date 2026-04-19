import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'

// ── Module permissions ────────────────────────────────────────
export const ALL_MODULES = [
  'dashboard', 'invoices', 'quotes', 'clients', 'payments',
  'expenses', 'suppliers', 'products', 'payroll', 'fixed-assets',
  'accounting', 'bank-accounts', 'bank-reconciliation', 'budgets',
  'reports', 'settings',
]
const ADMIN_MODULES      = ALL_MODULES
const ACCOUNTANT_MODULES = ALL_MODULES.filter(m => m !== 'settings')

export function defaultModules(role: UserRole): string[] {
  return role === 'ADMIN' ? ADMIN_MODULES : ACCOUNTANT_MODULES
}

/** Resolve effective permissions: explicit list or role defaults */
export function effectivePermissions(role: UserRole, permissions: any): string[] {
  if (Array.isArray(permissions) && permissions.length > 0) return permissions as string[]
  return defaultModules(role)
}
import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { AppError, UnauthorizedError, ForbiddenError, NotFoundError } from '../../middleware/errorHandler'
import { createAuditLog } from '../../utils/audit'
import type {
  LoginInput,
  ChangePasswordInput,
  CreateUserInput,
  UpdateUserInput,
} from './auth.schemas'

// ── Token helpers ────────────────────────────────────────────

interface TokenPayload {
  id: string
  email: string
  role: UserRole
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions)
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions)
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload
  } catch {
    throw new UnauthorizedError('Refresh token inválido o expirado')
  }
}

// ── Auth service ─────────────────────────────────────────────

export const authService = {

  // ── Login ──────────────────────────────────────────────────
  async login(data: LoginInput, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
      },
    })

    if (!user) {
      // Timing-safe: always compare even if user not found
      await bcrypt.compare(data.password, '$2b$12$invalidhashtopreventtiming')
      throw new UnauthorizedError('Credenciales inválidas')
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Usuario inactivo. Contacta al administrador.')
    }

    const isValidPassword = await bcrypt.compare(data.password, user.password)
    if (!isValidPassword) {
      throw new UnauthorizedError('Credenciales inválidas')
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    const payload: TokenPayload = { id: user.id, email: user.email, role: user.role }
    const accessToken  = generateAccessToken(payload)
    const refreshToken = generateRefreshToken(payload)

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entity: 'session',
      entityId: user.id,
      ip,
      userAgent,
    })

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    }
  },

  // ── Refresh token ──────────────────────────────────────────
  async refresh(refreshToken: string) {
    const decoded = verifyRefreshToken(refreshToken)

    const user = await prisma.user.findUnique({
      where: { id: decoded.id, isActive: true },
      select: { id: true, email: true, role: true, isActive: true },
    })

    if (!user) {
      throw new UnauthorizedError('Usuario no encontrado o inactivo')
    }

    const payload: TokenPayload = { id: user.id, email: user.email, role: user.role }
    const accessToken     = generateAccessToken(payload)
    const newRefreshToken = generateRefreshToken(payload)

    return { accessToken, refreshToken: newRefreshToken, expiresIn: env.JWT_EXPIRES_IN }
  },

  // ── Me (perfil autenticado) ────────────────────────────────
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true,
        permissions: true, isActive: true, lastLogin: true, createdAt: true,
      },
    })
    if (!user) throw new NotFoundError('Usuario')
    return { ...user, permissions: effectivePermissions(user.role, user.permissions) }
  },

  // ── Change password ────────────────────────────────────────
  async changePassword(userId: string, data: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    })

    if (!user) throw new NotFoundError('Usuario')

    const isValid = await bcrypt.compare(data.currentPassword, user.password)
    if (!isValid) throw new AppError('Contraseña actual incorrecta', 400)

    const hashedPassword = await bcrypt.hash(data.newPassword, 12)

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    await createAuditLog({
      userId,
      action: 'UPDATE',
      entity: 'user',
      entityId: userId,
      after: { passwordChanged: true },
    })

    return { message: 'Contraseña actualizada exitosamente' }
  },

  // ── Create user (admin only) ───────────────────────────────
  async createUser(data: CreateUserInput, adminId: string) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new AppError('Ya existe un usuario con ese email', 409)

    const hashedPassword = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        name:     data.name,
        email:    data.email,
        password: hashedPassword,
        role:     (data.role ?? 'ACCOUNTANT') as UserRole,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    await createAuditLog({
      userId:   adminId,
      action:   'CREATE',
      entity:   'user',
      entityId: user.id,
      after:    { name: user.name, email: user.email, role: user.role },
    })

    return user
  },

  // ── List users (admin only) ────────────────────────────────
  async listUsers() {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true,
        permissions: true, isActive: true, lastLogin: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    return users.map(u => ({ ...u, permissions: effectivePermissions(u.role, u.permissions) }))
  },

  // ── Update user (admin only) ───────────────────────────────
  async updateUser(targetId: string, data: UpdateUserInput & { permissions?: string[] }, adminId: string) {
    const existing = await prisma.user.findUnique({ where: { id: targetId } })
    if (!existing) throw new NotFoundError('Usuario')

    if (targetId === adminId && data.isActive === false) {
      throw new ForbiddenError('No puedes desactivar tu propia cuenta')
    }

    const before = { name: existing.name, role: existing.role, isActive: existing.isActive }

    const updateData: any = {}
    if (data.name     !== undefined) updateData.name     = data.name
    if (data.role     !== undefined) updateData.role     = data.role as UserRole
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.permissions !== undefined) {
      // null means "use role defaults" — store as null
      const newRole = (data.role as UserRole) ?? existing.role
      const defaults = defaultModules(newRole)
      const isSameAsDefault = data.permissions.length === defaults.length &&
        data.permissions.every(p => defaults.includes(p))
      updateData.permissions = isSameAsDefault ? null : data.permissions
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, permissions: true, isActive: true },
    })

    await createAuditLog({
      userId: adminId, action: 'UPDATE', entity: 'user', entityId: targetId,
      before, after: { name: user.name, role: user.role, isActive: user.isActive },
    })

    return { ...user, permissions: effectivePermissions(user.role, user.permissions) }
  },

  // ── Delete user (admin only — soft delete via isActive) ───
  async deleteUser(targetId: string, adminId: string) {
    if (targetId === adminId) throw new ForbiddenError('No puedes eliminar tu propia cuenta')
    const existing = await prisma.user.findUnique({ where: { id: targetId } })
    if (!existing) throw new NotFoundError('Usuario')
    await prisma.user.update({ where: { id: targetId }, data: { isActive: false } })
    await createAuditLog({ userId: adminId, action: 'DELETE', entity: 'user', entityId: targetId })
    return { message: 'Usuario desactivado' }
  },

  // ── Reset password (admin only) ────────────────────────────
  async resetPassword(targetId: string, newPassword: string, adminId: string) {
    const existing = await prisma.user.findUnique({ where: { id: targetId } })
    if (!existing) throw new NotFoundError('Usuario')

    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: targetId },
      data: { password: hashedPassword },
    })

    await createAuditLog({
      userId:   adminId,
      action:   'UPDATE',
      entity:   'user',
      entityId: targetId,
      after:    { passwordReset: true, resetBy: adminId },
    })

    return { message: 'Contraseña reseteada exitosamente' }
  },
}
