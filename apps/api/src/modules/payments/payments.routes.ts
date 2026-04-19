import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './payments.controller'

const router = Router()
router.use(authenticate)

router.get('/stats', ctrl.stats)
router.get('/',      ctrl.list)

export default router
