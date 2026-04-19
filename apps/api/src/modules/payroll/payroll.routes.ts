import { Router } from 'express'
import { authenticate, requireAdmin } from '../../middleware/auth'
import { auditLog } from '../../middleware/auditLog'
import * as ctrl from './payroll.controller'

const router = Router()
router.use(authenticate)

// Stats
router.get('/stats', ctrl.stats)

// Employees
router.get('/employees', ctrl.listEmployees)
router.get('/employees/:id', ctrl.getEmployee)
router.post('/employees',                auditLog('employee'), ctrl.createEmployee)
router.put('/employees/:id',             auditLog('employee'), ctrl.updateEmployee)
router.post('/employees/:id/terminate',  requireAdmin, auditLog('employee'), ctrl.terminateEmployee)

// Payroll runs
router.get('/', ctrl.listPayrolls)
router.get('/:id', ctrl.getPayroll)
router.post('/calculate',    auditLog('payroll'), ctrl.calculatePayroll)
router.post('/:id/approve',  requireAdmin, auditLog('payroll'), ctrl.approvePayroll)
router.post('/:id/pay',      requireAdmin, auditLog('payroll'), ctrl.processPayment)
router.post('/:id/pay-tss',  requireAdmin, auditLog('payroll'), ctrl.payTss)
router.post('/:id/pay-isr',  requireAdmin, auditLog('payroll'), ctrl.payIsr)

export default router
