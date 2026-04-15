/**
 * Alanube e-CF Service — Dominican Republic electronic fiscal documents
 * Supports sandbox simulation (no API key) and production mode.
 *
 * DGII NCF types:
 *   B01 → Crédito Fiscal  (CREDITO_FISCAL)
 *   B02 → Consumidor Final (CONSUMO)
 *   B04 → Nota de Crédito  (NOTA_CREDITO)
 *   B03 → Nota de Débito   (NOTA_DEBITO)
 */

import axios from 'axios'
import { env } from '../config/env'
import { logger } from '../config/logger'

export type AlanubeEmissionStatus = 'APPROVED' | 'IN_PROCESS' | 'REJECTED'

export interface AlanubeEmitPayload {
  invoiceId: string
  ncf: string
  businessUnit: 'HAX' | 'KODER'
  type: string // InvoiceType enum value
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

// ── NCF prefix mapping ─────────────────────────────────────
const NCF_PREFIX: Record<string, string> = {
  CREDITO_FISCAL: 'B01',
  CONSUMO:        'B02',
  NOTA_DEBITO:    'B03',
  NOTA_CREDITO:   'B04',
}

export function buildNcf(type: string, sequence: number): string {
  const prefix = NCF_PREFIX[type] ?? 'B02'
  return `${prefix}${String(sequence).padStart(8, '0')}`
}

// ── Sandbox simulation ────────────────────────────────────
function sandboxResult(payload: AlanubeEmitPayload): AlanubeEmitResult {
  // Simulate ~10% IN_PROCESS (async) and ~5% rejection for realism
  const roll = Math.random()

  if (roll < 0.05) {
    return {
      status: 'REJECTED',
      alanubeId: `SANDBOX-${Date.now()}`,
      ncf: payload.ncf,
      xml: null,
      errorCode: 'DGII-4001',
      errorMessage: 'RNC del receptor no válido (simulación sandbox)',
    }
  }

  if (roll < 0.15) {
    return {
      status: 'IN_PROCESS',
      alanubeId: `SANDBOX-${Date.now()}`,
      ncf: payload.ncf,
      xml: null,
      errorCode: null,
      errorMessage: null,
    }
  }

  const xml = buildMockXml(payload)
  return {
    status: 'APPROVED',
    alanubeId: `SANDBOX-${Date.now()}`,
    ncf: payload.ncf,
    xml,
    errorCode: null,
    errorMessage: null,
  }
}

function buildMockXml(payload: AlanubeEmitPayload): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<eCF version="1.0">
  <Encabezado>
    <IdDoc>
      <TipoeCF>${NCF_PREFIX[payload.type] ?? 'B02'}</TipoeCF>
      <eNCF>${payload.ncf}</eNCF>
      <FechaVencimientoSecuencia>31-12-2027</FechaVencimientoSecuencia>
      <FechaEmision>${payload.issueDate}</FechaEmision>
    </IdDoc>
    <Emisor>
      <RNCEmisor>${env.COMPANY_RNC}</RNCEmisor>
      <RazonSocialEmisor>${env.COMPANY_NAME}</RazonSocialEmisor>
    </Emisor>
    <Comprador>
      <RNCComprador>${payload.clientRnc ?? ''}</RNCComprador>
      <RazonSocialComprador>${payload.clientName}</RazonSocialComprador>
    </Comprador>
    <Totales>
      <MontoGravadoTotal>${payload.subtotal.toFixed(2)}</MontoGravadoTotal>
      <ITBIS1>${payload.taxAmount.toFixed(2)}</ITBIS1>
      <MontoTotal>${payload.total.toFixed(2)}</MontoTotal>
    </Totales>
  </Encabezado>
</eCF>`
}

// ── Production HTTP call ───────────────────────────────────
async function productionEmit(payload: AlanubeEmitPayload): Promise<AlanubeEmitResult> {
  const apiKey = env.ALANUBE_API_KEY
  const baseUrl = env.ALANUBE_API_URL

  const body = {
    ncf: payload.ncf,
    fechaEmision: payload.issueDate,
    receptor: {
      rnc: payload.clientRnc,
      razonSocial: payload.clientName,
    },
    items: payload.items.map((i) => ({
      descripcion: i.description,
      cantidad: i.quantity,
      precioUnitario: i.unitPrice,
      itbis: i.taxAmount,
      total: i.total,
    })),
    totales: {
      subtotal: payload.subtotal,
      itbis: payload.taxAmount,
      total: payload.total,
    },
  }

  const response = await axios.post(`${baseUrl}/v1/ecf/emit`, body, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
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
export async function pollStatus(alanubeId: string): Promise<AlanubeEmitResult | null> {
  if (!env.ALANUBE_API_KEY) {
    // Sandbox: 70% chance of resolution per poll
    if (Math.random() < 0.7) {
      return {
        status: Math.random() < 0.9 ? 'APPROVED' : 'REJECTED',
        alanubeId,
        ncf: '',
        xml: Math.random() < 0.9 ? '<eCF>mock</eCF>' : null,
        errorCode: Math.random() < 0.9 ? null : 'DGII-5001',
        errorMessage: Math.random() < 0.9 ? null : 'Secuencia de NCF inválida (simulación)',
      }
    }
    return null // still processing
  }

  try {
    const response = await axios.get(`${env.ALANUBE_API_URL}/v1/ecf/${alanubeId}`, {
      headers: { Authorization: `Bearer ${env.ALANUBE_API_KEY}` },
      timeout: 15_000,
    })
    const d = response.data
    const status = (d.status?.toUpperCase() ?? 'IN_PROCESS') as AlanubeEmissionStatus
    if (status === 'IN_PROCESS') return null
    return {
      status,
      alanubeId,
      ncf: d.ncf ?? '',
      xml: d.xml ?? null,
      errorCode: d.errorCode ?? null,
      errorMessage: d.errorMessage ?? null,
    }
  } catch (err) {
    logger.error('Alanube poll error', err)
    return null
  }
}

// ── Main export ────────────────────────────────────────────
export async function emitEcf(payload: AlanubeEmitPayload): Promise<AlanubeEmitResult> {
  if (!env.ALANUBE_API_KEY || env.ALANUBE_ENV === 'sandbox') {
    logger.info(`[Alanube] Sandbox mode — simulating emission for NCF ${payload.ncf}`)
    return sandboxResult(payload)
  }
  return productionEmit(payload)
}
