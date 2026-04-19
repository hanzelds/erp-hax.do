import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './reports.controller'

const router = Router()
router.use(authenticate)

router.get('/dashboard', ctrl.dashboard)
router.get('/pnl/:period', ctrl.pnl)
router.get('/balance-sheet', ctrl.balanceSheet)
router.get('/cash-flow/:period', ctrl.cashFlow)
router.get('/606/:period', ctrl.report606)
router.get('/607/:period', ctrl.report607)
router.get('/606/:period/export', ctrl.export606Csv)
router.get('/607/:period/export', ctrl.export607Csv)

export default router
