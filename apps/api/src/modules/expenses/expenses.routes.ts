import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import { auditLog } from '../../middleware/auditLog'
import * as ctrl from './expenses.controller'

const router = Router()
router.use(authenticate)

router.get('/stats', ctrl.stats)
router.get('/', ctrl.list)
router.get('/:id', ctrl.get)
router.post('/',             auditLog('expense'), ctrl.create)
router.put('/:id',           auditLog('expense'), ctrl.update)
router.patch('/:id/approve', auditLog('expense'), ctrl.approve)
router.patch('/:id/pay',     auditLog('expense'), ctrl.markPaid)
router.delete('/:id',        auditLog('expense'), ctrl.remove)

export default router
