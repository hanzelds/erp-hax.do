/**
 * Alanube e-CF Service — Dominican Republic electronic fiscal documents
 *
 * e-CF format: E + 2-digit type + 10-digit sequential = 13 characters
 * Types: 31 (Crédito Fiscal), 32 (Consumo), 33 (Nota Débito), 34 (Nota Crédito),
 *        41 (Compras), 43 (Gastos Menores), 44 (Régimen Especial),
 *        45 (Gubernamental), 46 (Exportaciones), 47 (Pagos Exterior)
 */

import axios from 'axios'
import { prisma } from '../config/database'
import { env } from '../config/env'
import { logger } from '../config/logger'
import { BusinessUnit } from '@prisma/client'

export type AlanubeEmissionStatus = 'APPROVED' | 'IN_PROCESS' | 'REJECTED'

export interface AlanubeEmitPayload {
  invoiceId: string
  ncf: string
  businessUnit: BusinessUnit
  type: string
  issueDate: string
  clientName: string
  clientRnc: string | null
  subtotal: number
  taxAmount: number
  total: number
  items: {
    description: string
    quantity: number
    unitPrice: number
    taxRate: number
    taxAmount: number
    total: number
  }[]
}

export interface AlanubeEmitResult {
  status: AlanubeEmissionStatus
  alanubeId: string | null
  ncf: string
  xml: string | null
  errorCode: string | null
  errorMessage: string | null
}

// ── e-CF type code mappings ────────────────────────────────
// Format: E + 2-digit type code + 10-digit sequential = 13 chars
export const ECF_TYPE_CODE: Record<string, string> = {
  CREDITO_FISCAL:  '31',
  CONSUMO:         '32',
  NOTA_DEBITO:     '33',
  NOTA_CREDITO:    '34',
  COMPRAS:         '41',
  GASTOS_MENORES:  '43',
  REGIMEN_ESPECIAL:'44',
  REGIMEN:         '44',  // legacy alias
  GUBERNAMENTAL:   '45',
  EXPORTACIONES:   '46',
  PAGOS_EXTERIOR:  '47',
}

// Keep NCF_PREFIX as alias for backward compat with existing XML/reports
export const NCF_PREFIX = ECF_TYPE_CODE

export const SEQ_FIELD: Record<string, string> = {
  CREDITO_FISCAL:  'ncfCreditoFiscal',
  CONSUMO:         'ncfConsumidor',
  NOTA_DEBITO:     'ncfNotaDebito',
  NOTA_CREDITO:    'ncfNotaCredito',
  COMPRAS:         'ncfCompras',
  GASTOS_MENORES:  'ncfGastosMenores',
  REGIMEN_ESPECIAL:'ncfRegimen',
  REGIMEN:         'ncfRegimen',  // legacy alias
  GUBERNAMENTAL:   'ncfGubernamental',
  EXPORTACIONES:   'ncfExportaciones',
  PAGOS_EXTERIOR:  'ncfPagosExterior',
}

/**
 * Build e-CF number: E + 2-digit type + 10-digit sequential
 * Example: E310000000001 (13 characters)
 */
export function buildNcf(type: string, sequence: number): string {
  const typeCode = ECF_TYPE_CODE[type] ?? '32'
  return `E${typeCode}${String(sequence).padStart(10, '0')}`
}

export function getSeqField(type: string): string {
  return SEQ_FIELD[type] ?? 'ncfConsumidor'
}

// ── Load BU config from DB ─────────────────────────────────
export async function getBuConfig(_businessUnit?: BusinessUnit) {
  const [c, co] = await Promise.all([
    prisma.ecfConfig.findUnique({ where: { id: 'main' } }),
    prisma.companyConfig.findUnique({ where: { id: 'main' } }),
  ])
  return {
    alanubeEnabled:      c?.alanubeEnabled      ?? false,
    alanubeApiKey:       c?.alanubeApiKey        ?? env.ALANUBE_API_KEY,
    alanubeEnv:          c?.alanubeEnv           ?? env.ALANUBE_ENV,
    alanubeApiUrl:       c?.alanubeApiUrl        ?? env.ALANUBE_API_URL,
    maxRetryCount:       c?.maxRetryCount        ?? 5,
    pollIntervalSeconds: c?.pollIntervalSeconds  ?? 3,
    pollTimeoutMinutes:  c?.pollTimeoutMinutes   ?? 5,
    autoJournalEntries:  c?.autoJournalEntries   ?? true,
    itbisRate:           c?.itbisRate            ?? 0.18,
    maxRetroactiveDays:  c?.maxRetroactiveDays   ?? 5,
    companyName:         co?.companyName         ?? env.COMPANY_NAME,
    rnc:                 co?.rnc                 ?? env.COMPANY_RNC,
  }
}

// ── Sandbox simulation ─────────────────────────────────────
function sandboxResult(payload: AlanubeEmitPayload): AlanubeEmitResult {
  const roll = Math.random()
  if (roll < 0.05) return { status: 'REJECTED', alanubeId: `SANDBOX-${Date.now()}`, ncf: payload.ncf, xml: null, errorCode: 'DGII-4001', errorMessage: 'RNC del receptor no válido (simulación sandbox)' }
  if (roll < 0.15) return { status: 'IN_PROCESS', alanubeId: `SANDBOX-${Date.now()}`, ncf: payload.ncf, xml: null, errorCode: null, errorMessage: null }
  return { status: 'APPROVED', alanubeId: `SANDBOX-${Date.now()}`, ncf: payload.ncf, xml: buildMockXml(payload), errorCode: null, errorMessage: null }
}

function buildMockXml(p: AlanubeEmitPayload): string {
  const typeCode = ECF_TYPE_CODE[p.type] ?? '32'
  return `<?xml version="1.0" encoding="UTF-8"?><eCF version="1.0"><Encabezado><IdDoc><TipoeCF>${typeCode}</TipoeCF><eNCF>${p.ncf}</eNCF><FechaEmision>${p.issueDate}</FechaEmision></IdDoc><Emisor><RNCEmisor>${env.COMPANY_RNC}</RNCEmisor><RazonSocialEmisor>${env.COMPANY_NAME}</RazonSocialEmisor></Emisor><Comprador><RNCComprador>${p.clientRnc ?? ''}</RNCComprador><RazonSocialComprador>${p.clientName}</RazonSocialComprador></Comprador><Totales><MontoGravadoTotal>${p.subtotal.toFixed(2)}</MontoGravadoTotal><ITBIS1>${p.taxAmount.toFixed(2)}</ITBIS1><MontoTotal>${p.total.toFixed(2)}</MontoTotal></Totales></Encabezado></eCF>`
}

// ── Production HTTP call ───────────────────────────────────
async function productionEmit(payload: AlanubeEmitPayload, config: Awaited<ReturnType<typeof getBuConfig>>): Promise<AlanubeEmitResult> {
  const response = await axios.post(`${config.alanubeApiUrl}/v1/ecf/emit`, {
    ncf: payload.ncf,
    fechaEmision: payload.issueDate,
    receptor: { rnc: payload.clientRnc, razonSocial: payload.clientName },
    items: payload.items.map((i) => ({ descripcion: i.description, cantidad: i.quantity, precioUnitario: i.unitPrice, itbis: i.taxAmount, total: i.total })),
    totales: { subtotal: payload.subtotal, itbis: payload.taxAmount, total: payload.total },
  }, {
    headers: { Authorization: `Bearer ${config.alanubeApiKey}`, 'Content-Type': 'application/json' },
    timeout: 30_000,
  })
  const d = response.data
  return {
    status: (d.status?.toUpperCase() ?? 'IN_PROCESS') as AlanubeEmissionStatus,
    alanubeId: d.id ?? null,
    ncf: d.ncf ?? payload.ncf,
    xml: d.xml ?? null,
    errorCode: d.errorCode ?? null,
    errorMessage: d.errorMessage ?? null,
  }
}

// ── Poll IN_PROCESS status ─────────────────────────────────
export async function pollStatus(alanubeId: string, businessUnit: BusinessUnit): Promise<AlanubeEmitResult | null> {
  const config = await getBuConfig(businessUnit)
  if (!config.alanubeApiKey || config.alanubeEnv === 'sandbox') {
    if (Math.random() < 0.7) {
      const ok = Math.random() < 0.9
      return { status: ok ? 'APPROVED' : 'REJECTED', alanubeId, ncf: '', xml: ok ? '<eCF>mock</eCF>' : null, errorCode: ok ? null : 'DGII-5001', errorMessage: ok ? null : 'Secuencia NCF inválida (simulación)' }
    }
    return null
  }
  try {
    const response = await axios.get(`${config.alanubeApiUrl}/v1/ecf/${alanubeId}`, { headers: { Authorization: `Bearer ${config.alanubeApiKey}` }, timeout: 15_000 })
    const d = response.data
    const status = (d.status?.toUpperCase() ?? 'IN_PROCESS') as AlanubeEmissionStatus
    if (status === 'IN_PROCESS') return null
    return { status, alanubeId, ncf: d.ncf ?? '', xml: d.xml ?? null, errorCode: d.errorCode ?? null, errorMessage: d.errorMessage ?? null }
  } catch (err) {
    logger.error('Alanube poll error', err)
    return null
  }
}

// ── Main export ────────────────────────────────────────────
export async function emitEcf(payload: AlanubeEmitPayload): Promise<AlanubeEmitResult> {
  const config = await getBuConfig(payload.businessUnit)
  if (!config.alanubeEnabled || !config.alanubeApiKey || config.alanubeEnv === 'sandbox') {
    logger.info(`[Alanube] Sandbox (${payload.businessUnit}) — NCF ${payload.ncf}`)
    return sandboxResult(payload)
  }
  return productionEmit(payload, config)
}
