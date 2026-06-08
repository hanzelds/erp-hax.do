import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import * as ctrl from './commissions.controller'

const router = Router()

router.use(authenticate)

// Plans
router.get('/plans',        ctrl.listPlans)
router.post('/plans',       requireAdmin, ctrl.createPlan)
router.patch('/plans/:id',  requireAdmin, ctrl.updatePlan)
router.delete('/plans/:id', requireAdmin, ctrl.deletePlan)

// Calculate
router.post('/calculate', ctrl.calculate)

// Entries
router.get('/entries',                       ctrl.listEntries)
router.patch('/entries/:id/approve',         requireAdmin, ctrl.approveEntry)
router.post('/entries/:id/send-to-payroll',  requireAdmin, ctrl.sendToPayroll)
router.delete('/entries/:id',                requireAdmin, ctrl.cancelEntry)

export default router
