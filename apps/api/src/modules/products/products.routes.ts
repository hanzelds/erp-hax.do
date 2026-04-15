import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import * as ctrl from './products.controller'

const router = Router()
router.use(authenticate)

router.get('/stats', ctrl.stats)
router.get('/categories', ctrl.listCategories)
router.post('/categories', ctrl.createCategory)
router.delete('/categories/:id', ctrl.deleteCategory)
router.get('/', ctrl.list)
router.get('/:id', ctrl.get)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.patch('/:id/toggle', ctrl.toggle)

export default router
