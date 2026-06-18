import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './crm.controller'

const router = Router()
router.use(authenticate)

router.get('/pipeline', ctrl.pipeline)
router.get('/analytics', ctrl.analytics)
router.get('/', ctrl.list)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.patch('/:id', ctrl.update)
router.delete('/:id', ctrl.remove)

router.get('/:id/activities', ctrl.listActivities)
router.post('/:id/activities', ctrl.createActivity)
router.patch('/:id/activities/:actId', ctrl.updateActivity)
router.delete('/:id/activities/:actId', ctrl.deleteActivity)

export default router
