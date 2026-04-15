import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './recurring-payments.controller'

const router = Router()
router.use(authenticate)

router.get('/', ctrl.list)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.patch('/:id/pay', ctrl.pay)
router.delete('/:id', ctrl.remove)

export default router
