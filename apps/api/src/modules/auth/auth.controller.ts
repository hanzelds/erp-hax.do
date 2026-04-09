import { Response } from 'express'
import { authService } from './auth.service'
import { AuthRequest } from '../../middleware/auth'
import { sendSuccess, sendCreated } from '../../utils/response'
import {
  loginSchema,
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  refreshTokenSchema,
} from './auth.schemas'
import { z } from 'zod'
import { AppError } from '../../middleware/errorHandler'

// ── Helpers ──────────────────────────────────────────────────

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.errors
      .map((e) => e.message)
      .join(', ')
    throw new AppError(message, 400)
  }
  return result.data
}

// ── Controllers ──────────────────────────────────────────────

export const authController = {

  // POST /auth/login
  async login(req: AuthRequest, res: Response) {
    const data = parseBody(loginSchema, req.body)
    const ip        = req.ip || req.socket.remoteAddress
    const userAgent = req.headers['user-agent']

    const result = await authService.login(data, ip, userAgent)
    return sendSuccess(res, result)
  },

  // POST /auth/refresh
  async refresh(req: AuthRequest, res: Response) {
    const { refreshToken } = parseBody(refreshTokenSchema, req.body)
    const result = await authService.refresh(refreshToken)
    return sendSuccess(res, result)
  },

  // GET /auth/me
  async me(req: AuthRequest, res: Response) {
    const user = await authService.getMe(req.user!.id)
    return sendSuccess(res, user)
  },

  // POST /auth/change-password
  async changePassword(req: AuthRequest, res: Response) {
    const data = parseBody(changePasswordSchema, req.body)
    const result = await authService.changePassword(req.user!.id, data)
    return sendSuccess(res, result)
  },

  // POST /auth/logout
  async logout(_req: AuthRequest, res: Response) {
    // JWT is stateless — client drops the token.
    // In future: add token blacklist via Redis here.
    return sendSuccess(res, { message: 'Sesión cerrada exitosamente' })
  },

  // ── User management (admin only) ──────────────────────────

  // POST /auth/users
  async createUser(req: AuthRequest, res: Response) {
    const data = parseBody(createUserSchema, req.body)
    const user = await authService.createUser(data, req.user!.id)
    return sendCreated(res, user)
  },

  // GET /auth/users
  async listUsers(_req: AuthRequest, res: Response) {
    const users = await authService.listUsers()
    return sendSuccess(res, users)
  },

  // PATCH /auth/users/:id
  async updateUser(req: AuthRequest, res: Response) {
    const data = parseBody(updateUserSchema, req.body)
    const user = await authService.updateUser(req.params.id, data, req.user!.id)
    return sendSuccess(res, user)
  },

  // POST /auth/users/:id/reset-password
  async resetPassword(req: AuthRequest, res: Response) {
    const { newPassword } = req.body
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new AppError('La nueva contraseña debe tener al menos 8 caracteres', 400)
    }
    const result = await authService.resetPassword(
      req.params.id,
      newPassword,
      req.user!.id,
    )
    return sendSuccess(res, result)
  },
}
