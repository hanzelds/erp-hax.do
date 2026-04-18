import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './notifications.controller'

const router = Router()
router.use(authenticate)
router.get('/', ctrl.list)

export default router
