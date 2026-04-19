import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import * as ctrl from './bank-reconciliation.controller'

const router = Router()
router.use(authenticate)

router.get('/', ctrl.list)
router.post('/', ctrl.create)
router.get('/:id', ctrl.get)
router.post('/:id/import', ctrl.importTransactions)
router.patch('/:id/transactions/:txId', ctrl.matchTransaction)
router.patch('/:id/transactions/:txId/ignore', ctrl.ignoreTransaction)
router.post('/:id/close', requireAdmin, ctrl.closeReconciliation)

export default router
