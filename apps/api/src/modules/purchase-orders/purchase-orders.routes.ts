import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './purchase-orders.controller'

const router = Router()
router.use(authenticate)

router.get('/', ctrl.list)
router.get('/cxp/pending', ctrl.cxpList)
router.get('/:id/pdf', ctrl.pdf)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.patch('/:id/advance', ctrl.advance)
router.patch('/:id/cancel', ctrl.cancel)
router.post('/:id/pay', ctrl.pay)

export default router
