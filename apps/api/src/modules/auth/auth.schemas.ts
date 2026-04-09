import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'El email es requerido' })
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(1, 'La contraseña es requerida'),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'La contraseña actual es requerida' })
      .min(1, 'La contraseña actual es requerida'),
    newPassword: z
      .string({ required_error: 'La nueva contraseña es requerida' })
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export const createUserSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es requerido' })
    .min(2, 'Mínimo 2 caracteres')
    .trim(),
  email: z
    .string({ required_error: 'El email es requerido' })
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
  role: z.enum(['ADMIN', 'ACCOUNTANT']).default('ACCOUNTANT'),
})

export const updateUserSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').trim().optional(),
  role: z.enum(['ADMIN', 'ACCOUNTANT']).optional(),
  isActive: z.boolean().optional(),
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string({ required_error: 'Refresh token requerido' }),
})

export type LoginInput          = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type CreateUserInput     = z.infer<typeof createUserSchema>
export type UpdateUserInput     = z.infer<typeof updateUserSchema>
export type RefreshTokenInput   = z.infer<typeof refreshTokenSchema>
