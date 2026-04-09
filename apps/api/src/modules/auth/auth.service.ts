import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'
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
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    })

    if (!user) throw new NotFoundError('Usuario')
    return user
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
        role:     data.role as UserRole,
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
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
  },

  // ── Update user (admin only) ───────────────────────────────
  async updateUser(targetId: string, data: UpdateUserInput, adminId: string) {
    const existing = await prisma.user.findUnique({ where: { id: targetId } })
    if (!existing) throw new NotFoundError('Usuario')

    // Prevent admin from deactivating themselves
    if (targetId === adminId && data.isActive === false) {
      throw new ForbiddenError('No puedes desactivar tu propia cuenta')
    }

    const before = {
      name: existing.name,
      role: existing.role,
      isActive: existing.isActive,
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data: {
        ...(data.name     !== undefined && { name:     data.name }),
        ...(data.role     !== undefined && { role:     data.role as UserRole }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })

    await createAuditLog({
      userId:   adminId,
      action:   'UPDATE',
      entity:   'user',
      entityId: targetId,
      before,
      after: { name: user.name, role: user.role, isActive: user.isActive },
    })

    return user
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
