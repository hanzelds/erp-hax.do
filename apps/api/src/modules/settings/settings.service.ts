import { prisma } from '../../config/database'

const ECF_DEFAULTS = {
  alanubeEnabled:      false,
  alanubeApiKey:       null as string | null,
  alanubeEnv:          'sandbox',
  alanubeApiUrl:       'https://api.alanube.com.do',
  ncfCreditoFiscal:    1,
  ncfConsumidor:       1,
  ncfNotaDebito:       1,
  ncfNotaCredito:      1,
  ncfCompras:          1,
  ncfRegimen:          1,
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
