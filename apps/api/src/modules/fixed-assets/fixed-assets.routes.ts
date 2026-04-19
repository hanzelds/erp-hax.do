import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import * as ctrl from './fixed-assets.controller'

const router = Router()
router.use(authenticate)

router.get('/depreciation/preview', ctrl.previewDepreciation)
router.post('/depreciation/run',    requireAdmin, ctrl.runDepreciation)
router.get('/',      ctrl.list)
router.post('/',     ctrl.create)
router.get('/:id',   ctrl.get)
router.put('/:id',   ctrl.update)
router.post('/:id/retire', requireAdmin, ctrl.retire)

export default router
