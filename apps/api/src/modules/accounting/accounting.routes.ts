import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import * as ctrl from './accounting.controller'

const router = Router()
router.use(authenticate)

router.get('/accounts', ctrl.chartOfAccounts)
router.get('/journal', ctrl.journalEntries)
router.get('/ledger/:code', ctrl.ledger)
router.get('/trial-balance', ctrl.trialBalance)
router.get('/periods', ctrl.fiscalPeriods)
router.post('/periods/:period/close', requireAdmin, ctrl.closePeriod)

export default router
