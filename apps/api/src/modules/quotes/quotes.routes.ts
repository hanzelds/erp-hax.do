import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './quotes.controller'

const router = Router()
router.use(authenticate)

router.get('/stats', ctrl.stats)
router.get('/', ctrl.list)
router.get('/:id/pdf', ctrl.pdf)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.post('/:id/send', ctrl.send)
router.post('/:id/accept', ctrl.accept)
router.post('/:id/reject', ctrl.reject)
router.post('/:id/convert', ctrl.convert)

export default router
