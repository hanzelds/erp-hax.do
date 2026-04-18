import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './clients.controller'

const router = Router()
router.use(authenticate)

router.get('/stats', ctrl.stats)
router.get('/', ctrl.list)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.patch('/:id', ctrl.update)
router.delete('/:id', ctrl.remove)

export default router
