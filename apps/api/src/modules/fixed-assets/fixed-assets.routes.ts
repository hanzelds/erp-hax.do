import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import * as ctrl from './fixed-assets.controller'

const router = Router()
router.use(authenticate)

router.get('/', ctrl.list)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.post('/:id/retire', requireAdmin, ctrl.retire)
router.post('/depreciation/run', requireAdmin, ctrl.runDepreciation)

export default router
