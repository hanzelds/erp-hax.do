import { Router } from 'express'
import { authenticate } from '../../middleware/auth'

const router = Router()
router.use(authenticate)

// TODO: implementar endpoints del módulo payroll

export default router
