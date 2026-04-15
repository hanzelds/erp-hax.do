import { prisma } from '../../config/database'
import { BusinessUnit } from '@prisma/client'

const DEFAULTS = {
  companyName: null,
  rnc: null,
  address: null,
  phone: null,
  email: null,
  logoUrl: null,
  alanubeEnabled: false,
  alanubeApiKey: null,
  alanubeEnv: 'sandbox',
  alanubeApiUrl: 'https://api.alanube.com.do',
  ncfCreditoFiscal: 1,
  ncfConsumidor: 1,
  ncfNotaDebito: 1,
  ncfNotaCredito: 1,
  ncfCompras: 1,
  ncfRegimen: 1,
  itbisRate: 0.18,
  maxRetroactiveDays: 5,
  maxRetryCount: 5,
  autoJournalEntries: true,
  requireRncB01: true,
  pollIntervalSeconds: 3,
  pollTimeoutMinutes: 5,
}

export async function getEcfConfig(businessUnit: BusinessUnit) {
  const config = await prisma.businessUnitConfig.findUnique({ where: { businessUnit } })
  if (!config) return { businessUnit, ...DEFAULTS }

  // Never expose the full API key — return masked version
  const result = { ...config } as any
  if (result.alanubeApiKey) {
    result.alanubeApiKeyMasked = `****${result.alanubeApiKey.slice(-4)}`
    result.alanubeApiKey = undefined
    result.hasApiKey = true
  } else {
    result.hasApiKey = false
  }
  return result
}

export async function getAllEcfConfigs() {
  const [hax, koder] = await Promise.all([
    getEcfConfig('HAX'),
    getEcfConfig('KODER'),
  ])
  return { HAX: hax, KODER: koder }
}

export async function updateEcfConfig(businessUnit: BusinessUnit, data: any) {
  const { alanubeApiKey, ...rest } = data

  // Separate the API key: only update if a non-empty value was sent
  const update: any = { ...rest }
  if (alanubeApiKey && alanubeApiKey.trim() && !alanubeApiKey.startsWith('****')) {
    update.alanubeApiKey = alanubeApiKey.trim()
  }

  // Remove undefined / null for fields that shouldn't be cleared
  Object.keys(update).forEach((k) => update[k] === undefined && delete update[k])

  return prisma.businessUnitConfig.upsert({
    where: { businessUnit },
    update,
    create: { businessUnit, ...DEFAULTS, ...update },
  })
}
