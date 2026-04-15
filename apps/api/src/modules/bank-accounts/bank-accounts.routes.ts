import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './bank-accounts.controller'

const router = Router()
router.use(authenticate)

router.get('/summary', ctrl.summary)
router.get('/', ctrl.list)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.post('/:id/transactions', ctrl.addTransaction)

export default router
