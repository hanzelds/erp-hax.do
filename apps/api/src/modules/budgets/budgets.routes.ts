import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './budgets.controller'

const router = Router()
router.use(authenticate)

router.get('/summary', ctrl.summary)
router.get('/', ctrl.list)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.post('/sync', ctrl.syncExecution)

export default router
