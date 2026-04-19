import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import * as ctrl from './accounting.controller'

const router = Router()
router.use(authenticate)

// Chart of accounts & journal
router.get('/accounts',       ctrl.chartOfAccounts)
router.get('/journal',        ctrl.journalEntries)
router.get('/ledger/:code',   ctrl.ledger)

// Financial statements
router.get('/trial-balance',  ctrl.trialBalance)
router.get('/balance-sheet',  ctrl.balanceSheet)
router.get('/pnl',            ctrl.pnl)
router.get('/margins',        ctrl.margins)

// Fiscal periods
router.get('/periods',                     ctrl.fiscalPeriods)
router.post('/periods/:period/close',      requireAdmin, ctrl.closePeriod)

// ITBIS periods
router.get('/itbis',                       ctrl.itbisPeriods)
router.post('/itbis/:period/calculate',    ctrl.calculateItbis)
router.post('/itbis/:period/file',         requireAdmin, ctrl.fileItbis)
router.post('/itbis/:period/pay',          requireAdmin, ctrl.payItbis)
router.post('/itbis/check-overdue',        ctrl.checkOverdueItbis)

export default router
