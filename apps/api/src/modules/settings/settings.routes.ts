import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import * as ctrl from './settings.controller'

const router = Router()
router.use(authenticate)

router.get('/company',       ctrl.getCompany)
router.put('/company',       requireAdmin, ctrl.updateCompany)
router.get('/ecf',           ctrl.getEcf)
router.put('/ecf',           requireAdmin, ctrl.updateEcf)

export default router
