import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import * as ctrl from './payroll.controller'

const router = Router()
router.use(authenticate)

// Stats
router.get('/stats', ctrl.stats)

// Employees
router.get('/employees', ctrl.listEmployees)
router.get('/employees/:id', ctrl.getEmployee)
router.post('/employees', ctrl.createEmployee)
router.put('/employees/:id', ctrl.updateEmployee)
router.post('/employees/:id/terminate', requireAdmin, ctrl.terminateEmployee)

// Payroll runs
router.get('/', ctrl.listPayrolls)
router.get('/:id', ctrl.getPayroll)
router.post('/calculate', ctrl.calculatePayroll)
router.post('/:id/approve', requireAdmin, ctrl.approvePayroll)
router.post('/:id/pay', requireAdmin, ctrl.processPayment)
router.post('/:id/pay-tss', requireAdmin, ctrl.payTss)
router.post('/:id/pay-isr', requireAdmin, ctrl.payIsr)

export default router
