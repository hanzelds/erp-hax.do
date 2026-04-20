import { prisma } from '../../config/database'

const ECF_DEFAULTS = {
  alanubeEnabled:      false,
  alanubeApiKey:       null as string | null,
  alanubeEnv:          'sandbox',
  alanubeApiUrl:       'https://api.alanube.com.do',
  ncfCreditoFiscal:    1,  // e-CF 31
  ncfConsumidor:       1,  // e-CF 32
  ncfNotaDebito:       1,  // e-CF 33
  ncfNotaCredito:      1,  // e-CF 34
  ncfCompras:          1,  // e-CF 41
  ncfGastosMenores:    1,  // e-CF 43
  ncfRegimen:          1,  // e-CF 44
  ncfGubernamental:    1,  // e-CF 45
  ncfExportaciones:    1,  // e-CF 46
  ncfPagosExterior:    1,  // e-CF 47
  itbisRate:           0.18,
  maxRetroactiveDays:  5,
  maxRetryCount:       5,
  autoJournalEntries:  true,
  requireRncB01:       true,
  pollIntervalSeconds: 3,
  pollTimeoutMinutes:  5,
}

const COMPANY_DEFAULTS = {
  companyName: 'HAX ESTUDIO CREATIVO EIRL',
  rnc:         '133290251',
  address:     null as string | null,
  phone:       null as string | null,
  email:       null as string | null,
  logoUrl:     null as string | null,
}

// ── Company config ────────────────────────────────────────
export async function getCompanyConfig() {
  const c = await prisma.companyConfig.findUnique({ where: { id: 'main' } })
  return c ?? { id: 'main', ...COMPANY_DEFAULTS, updatedAt: new Date() }
}

export async function updateCompanyConfig(data: any) {
  return prisma.companyConfig.upsert({
    where:  { id: 'main' },
    update: data,
    create: { id: 'main', ...COMPANY_DEFAULTS, ...data },
  })
}

// ── e-CF config ───────────────────────────────────────────
export async function getEcfConfig() {
  const c = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  const base = c ?? { id: 'main', ...ECF_DEFAULTS, updatedAt: new Date() }

  const result: any = { ...base }
  if (result.alanubeApiKey) {
    result.alanubeApiKeyMasked = `****${result.alanubeApiKey.slice(-4)}`
    result.hasApiKey = true
    delete result.alanubeApiKey
  } else {
    result.hasApiKey = false
  }
  return result
}

export async function updateEcfConfig(data: any) {
  const { alanubeApiKey, ...rest } = data

  const update: any = { ...rest }
  // Only update API key if a real new value is provided
  if (alanubeApiKey && alanubeApiKey.trim() && !alanubeApiKey.startsWith('****')) {
    update.alanubeApiKey = alanubeApiKey.trim()
  }

  await prisma.ecfConfig.upsert({
    where:  { id: 'main' },
    update,
    create: { id: 'main', ...ECF_DEFAULTS, ...update },
  })

  return getEcfConfig()
}

// ── General operational config ─────────────────────────────
const GENERAL_FIELDS = [
  'invoiceDueDays', 'defaultPaymentMethod',
  'budgetAlertThreshold', 'budgetExceededThreshold',
  'fixedAssetThreshold',
] as const

export async function getGeneralConfig() {
  const c = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (!c) {
    return {
      invoiceDueDays:             30,
      defaultPaymentMethod:       'TRANSFER',
      budgetAlertThreshold:       0.8,
      budgetExceededThreshold:    1.0,
      fixedAssetThreshold:        10000,
    }
  }
  return {
    invoiceDueDays:             c.invoiceDueDays,
    defaultPaymentMethod:       c.defaultPaymentMethod,
    budgetAlertThreshold:       c.budgetAlertThreshold,
    budgetExceededThreshold:    c.budgetExceededThreshold,
    fixedAssetThreshold:        c.fixedAssetThreshold,
  }
}

export async function updateGeneralConfig(data: any) {
  const allowed: any = {}
  for (const key of GENERAL_FIELDS) {
    if (data[key] !== undefined) allowed[key] = data[key]
  }
  await prisma.ecfConfig.upsert({
    where:  { id: 'main' },
    update: allowed,
    create: { id: 'main', ...ECF_DEFAULTS, ...allowed },
  })
  return getGeneralConfig()
}

// ── Payroll / TSS rates ────────────────────────────────────
const PAYROLL_DEFAULTS = {
  payrollAfpEmployee:   0.0287,
  payrollAfpEmployer:   0.0710,
  payrollSfsEmployee:   0.0304,
  payrollSfsEmployer:   0.0709,
  payrollRiesgoLaboral: 0.0120,
}
const PAYROLL_FIELDS = Object.keys(PAYROLL_DEFAULTS) as (keyof typeof PAYROLL_DEFAULTS)[]

export async function getPayrollConfig() {
  const c = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (!c) return { ...PAYROLL_DEFAULTS }
  return {
    payrollAfpEmployee:   c.payrollAfpEmployee,
    payrollAfpEmployer:   c.payrollAfpEmployer,
    payrollSfsEmployee:   c.payrollSfsEmployee,
    payrollSfsEmployer:   c.payrollSfsEmployer,
    payrollRiesgoLaboral: c.payrollRiesgoLaboral,
  }
}

export async function updatePayrollConfig(data: any) {
  const allowed: any = {}
  for (const key of PAYROLL_FIELDS) {
    if (data[key] !== undefined) allowed[key] = data[key]
  }
  await prisma.ecfConfig.upsert({
    where:  { id: 'main' },
    update: allowed,
    create: { id: 'main', ...ECF_DEFAULTS, ...allowed },
  })
  return getPayrollConfig()
}

// ── Accounting account codes ────────────────────────────────
const ACCOUNTS_DEFAULTS = {
  acctCash:              '1101',
  acctBank:              '1102',
  acctReceivables:       '1201',
  acctItbisReceivable:   '1302',
  acctPayablesSuppliers: '2101',
  acctPayablesEmployees: '2102',
  acctPayablesTss:       '2103',
  acctPayablesIsr:       '2104',
  acctItbisPayable:      '2201',
  acctIncomeHax:         '4101',
  acctIncomeKoder:       '4102',
  acctExpenseGeneral:    '5101',
  acctExpenseSalaries:   '5102',
  acctExpenseMarketing:  '5103',
}
const ACCOUNTS_FIELDS = Object.keys(ACCOUNTS_DEFAULTS) as (keyof typeof ACCOUNTS_DEFAULTS)[]

export async function getAccountsConfig() {
  const c = await prisma.ecfConfig.findUnique({ where: { id: 'main' } })
  if (!c) return { ...ACCOUNTS_DEFAULTS }
  return {
    acctCash:              c.acctCash,
    acctBank:              c.acctBank,
    acctReceivables:       c.acctReceivables,
    acctItbisReceivable:   c.acctItbisReceivable,
    acctPayablesSuppliers: c.acctPayablesSuppliers,
    acctPayablesEmployees: c.acctPayablesEmployees,
    acctPayablesTss:       c.acctPayablesTss,
    acctPayablesIsr:       c.acctPayablesIsr,
    acctItbisPayable:      c.acctItbisPayable,
    acctIncomeHax:         c.acctIncomeHax,
    acctIncomeKoder:       c.acctIncomeKoder,
    acctExpenseGeneral:    c.acctExpenseGeneral,
    acctExpenseSalaries:   c.acctExpenseSalaries,
    acctExpenseMarketing:  c.acctExpenseMarketing,
  }
}

export async function updateAccountsConfig(data: any) {
  const allowed: any = {}
  for (const key of ACCOUNTS_FIELDS) {
    if (data[key] !== undefined) allowed[key] = String(data[key]).trim()
  }
  await prisma.ecfConfig.upsert({
    where:  { id: 'main' },
    update: allowed,
    create: { id: 'main', ...ECF_DEFAULTS, ...allowed },
  })
  return getAccountsConfig()
}

// ── Email / SMTP config ────────────────────────────────────
const EMAIL_DEFAULTS = {
  smtpEnabled: false,
  smtpHost:    null as string | null,
  smtpPort:    587,
  smtpUser:    null as string | null,
  smtpPass:    null as string | null,
  smtpFrom:    null as string | null,
  smtpSsl:     false,
}

export async function getEmailConfig() {
  const c = await prisma.companyConfig.findUnique({ where: { id: 'main' } })
  const base = c ?? { id: 'main', ...COMPANY_DEFAULTS, ...EMAIL_DEFAULTS, updatedAt: new Date() }
  const result: any = {
    smtpEnabled: (base as any).smtpEnabled ?? false,
    smtpHost:    (base as any).smtpHost    ?? null,
    smtpPort:    (base as any).smtpPort    ?? 587,
    smtpUser:    (base as any).smtpUser    ?? null,
    smtpFrom:    (base as any).smtpFrom    ?? null,
    smtpSsl:     (base as any).smtpSsl     ?? false,
    hasSmtpPass: !!((base as any).smtpPass),
  }
  return result
}

export async function updateEmailConfig(data: any) {
  const update: any = {
    smtpEnabled: data.smtpEnabled,
    smtpHost:    data.smtpHost    || null,
    smtpPort:    data.smtpPort    || 587,
    smtpUser:    data.smtpUser    || null,
    smtpFrom:    data.smtpFrom    || null,
    smtpSsl:     data.smtpSsl     ?? false,
  }
  // Only update password if provided
  if (data.smtpPass && data.smtpPass.trim() && !data.smtpPass.startsWith('****')) {
    update.smtpPass = data.smtpPass.trim()
  }
  await prisma.companyConfig.upsert({
    where:  { id: 'main' },
    update,
    create: { id: 'main', ...COMPANY_DEFAULTS, ...update },
  })
  return getEmailConfig()
}
