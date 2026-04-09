import { Router } from 'express'
import { authenticate } from '../../middleware/auth'

const router = Router()
router.use(authenticate)

// TODO: implementar endpoints del módulo invoices

export default router
