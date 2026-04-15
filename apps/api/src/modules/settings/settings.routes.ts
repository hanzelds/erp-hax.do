import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import * as ctrl from './settings.controller'

const router = Router()
router.use(authenticate)

router.get('/', ctrl.getAll)
router.get('/:bu', ctrl.getOne)
router.put('/:bu', requireAdmin, ctrl.update)

export default router
