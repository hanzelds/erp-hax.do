import { Router } from 'express'
import { authController } from './auth.controller'
import { authenticate, requireAdmin } from '../../middleware/auth'

const router = Router()

// ── Rutas públicas (sin token) ────────────────────────────────
router.post('/login',   authController.login)
router.post('/refresh', authController.refresh)

// ── Rutas autenticadas ────────────────────────────────────────
router.use(authenticate)

router.get('/me',              authController.me)
router.post('/logout',         authController.logout)
router.post('/change-password',authController.changePassword)

// ── Gestión de usuarios (solo admin) ─────────────────────────
router.use(requireAdmin)

router.get('/users',                        authController.listUsers)
router.post('/users',                       authController.createUser)
router.patch('/users/:id',                  authController.updateUser)
router.post('/users/:id/reset-password',    authController.resetPassword)

export default router
