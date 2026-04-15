import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './purchase-orders.controller'

const router = Router()
router.use(authenticate)

router.get('/', ctrl.list)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.patch('/:id/advance', ctrl.advance)
router.patch('/:id/cancel', ctrl.cancel)

export default router
