import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './invoices.controller'

const router = Router()
router.use(authenticate)

router.get('/stats', ctrl.stats)
router.get('/', ctrl.list)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.patch('/:id/cancel', ctrl.cancel)
router.post('/:id/payments', ctrl.addPayment)
router.post('/:id/emit', ctrl.emit)
router.post('/:id/retry', ctrl.retry)
router.post('/:id/credit-note', ctrl.creditNote)

export default router
