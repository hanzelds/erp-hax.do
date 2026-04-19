import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import * as ctrl from './pdf-templates.controller'

const router = Router()
router.use(authenticate)

router.get('/',                    ctrl.list)
router.get('/:id',                 ctrl.get)
router.post('/',      requireAdmin, ctrl.create)
router.post('/upload', requireAdmin, ctrl.upload)
router.put('/:id',    requireAdmin, ctrl.update)
router.delete('/:id', requireAdmin, ctrl.remove)
router.post('/:id/activate',         requireAdmin, ctrl.activate)
router.post('/type/:type/deactivate', requireAdmin, ctrl.deactivate)
router.get('/:id/preview',           ctrl.preview)

export default router
