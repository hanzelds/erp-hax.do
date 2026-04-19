import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import { env } from './config/env'
import { logger } from './config/logger'
import { errorHandler } from './middleware/errorHandler'
import { notFound } from './middleware/notFound'
import './workers/invoice.worker'

// Routes
import authRoutes            from './modules/auth/auth.routes'
import clientRoutes          from './modules/clients/clients.routes'
import supplierRoutes        from './modules/suppliers/suppliers.routes'
import productRoutes         from './modules/products/products.routes'
import invoiceRoutes         from './modules/invoices/invoices.routes'
import expenseRoutes         from './modules/expenses/expenses.routes'
import paymentRoutes         from './modules/payments/payments.routes'
import purchaseOrderRoutes   from './modules/purchase-orders/purchase-orders.routes'
import recurringRoutes       from './modules/recurring-payments/recurring-payments.routes'
import bankAccountRoutes     from './modules/bank-accounts/bank-accounts.routes'
import crmRoutes             from './modules/crm/crm.routes'
import accountingRoutes      from './modules/accounting/accounting.routes'
import fixedAssetRoutes      from './modules/fixed-assets/fixed-assets.routes'
import budgetRoutes          from './modules/budgets/budgets.routes'
import bankReconciliationRoutes from './modules/bank-reconciliation/bank-reconciliation.routes'
import reportRoutes          from './modules/reports/reports.routes'
import payrollRoutes          from './modules/payroll/payroll.routes'
import settingsRoutes        from './modules/settings/settings.routes'
import notificationRoutes   from './modules/notifications/notifications.routes'

const app = express()

// ── Security ──────────────────────────────────────────────────
app.set('trust proxy', 1)
app.use(helmet())
app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? ['https://erp.hax.com.do']
    : ['http://localhost:3000'],
  credentials: true,
}))

// ── Rate limiting ─────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes. Intenta en 15 minutos.' },
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos. Intenta en 15 minutos.' },
})

// ── Body & compression ────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(compression())

// ── Logging ───────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }))
}

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'ERP Hax API',
    version: '1.0.0',
    company: 'HAX ESTUDIO CREATIVO EIRL',
    rnc: '133290251',
    env: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',               loginLimiter, authRoutes)
app.use('/api/clients',            apiLimiter,   clientRoutes)
app.use('/api/suppliers',          apiLimiter,   supplierRoutes)
app.use('/api/products',           apiLimiter,   productRoutes)
app.use('/api/invoices',           apiLimiter,   invoiceRoutes)
app.use('/api/expenses',           apiLimiter,   expenseRoutes)
app.use('/api/payments',           apiLimiter,   paymentRoutes)
app.use('/api/purchase-orders',    apiLimiter,   purchaseOrderRoutes)
app.use('/api/recurring-payments', apiLimiter,   recurringRoutes)
app.use('/api/bank-accounts',      apiLimiter,   bankAccountRoutes)
app.use('/api/crm',                apiLimiter,   crmRoutes)
app.use('/api/accounting',         apiLimiter,   accountingRoutes)
app.use('/api/fixed-assets',       apiLimiter,   fixedAssetRoutes)
app.use('/api/budgets',            apiLimiter,   budgetRoutes)
app.use('/api/bank-reconciliation',apiLimiter,   bankReconciliationRoutes)
app.use('/api/reports',            apiLimiter,   reportRoutes)
app.use('/api/payroll',            apiLimiter,   payrollRoutes)
app.use('/api/settings',           apiLimiter,   settingsRoutes)
app.use('/api/notifications',      apiLimiter,   notificationRoutes)

// ── Error handling ────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ── Start ─────────────────────────────────────────────────────
app.listen(env.API_PORT, () => {
  logger.info(`🚀 ERP Hax API — Puerto ${env.API_PORT} [${env.NODE_ENV}]`)
  logger.info(`🏢 HAX ESTUDIO CREATIVO EIRL | RNC: 133290251`)
})

export default app
