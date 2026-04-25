import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import { auditLog } from '../../middleware/auditLog'
import * as ctrl from './invoices.controller'

const router = Router()
router.use(authenticate)

router.get('/stats', ctrl.stats)
router.get('/', ctrl.list)
router.get('/:id', ctrl.get)
router.post('/',              auditLog('invoice'), ctrl.create)
router.put('/:id',            auditLog('invoice'), ctrl.update)
router.patch('/:id/cancel',   requireAdmin, auditLog('invoice'), ctrl.cancel)
router.post('/:id/payments',  auditLog('payment'), ctrl.addPayment)
router.post('/:id/emit',      auditLog('invoice'), ctrl.emit)
router.post('/:id/retry',     requireAdmin, auditLog('invoice'), ctrl.retry)
router.post('/:id/credit-note', auditLog('invoice'), ctrl.creditNote)
router.post('/:id/convert-proforma', auditLog('invoice'), ctrl.convertProforma)
router.get('/:id/pdf',             ctrl.pdf)
router.post('/:id/pdf/regenerate', requireAdmin, ctrl.regeneratePdf)

export default router
