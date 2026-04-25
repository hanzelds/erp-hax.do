import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../config/database'
import { logger } from '../config/logger'
import { getActiveTemplate } from '../modules/pdf-templates/pdf-templates.service'
import { renderTemplateToPdf } from './template-renderer.service'

const BRAND = rgb(0.161, 0.235, 0.310)  // #293C4F
const GRAY  = rgb(0.45,  0.45,  0.45)
const LIGHT = rgb(0.96,  0.97,  0.98)
const WHITE = rgb(1,     1,     1)
const BLACK = rgb(0,     0,     0)

const STORAGE_DIR = path.resolve(process.cwd(), '../../storage/pdfs')

function fmt(n: number) {
  return 'RD$ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })
}
function fmtShort(d: Date | string) {
  return new Date(d).toISOString().split('T')[0].replace(/-/g, '')
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:     'BORRADOR',
  SENT:      'ENVIADA',
  ACCEPTED:  'ACEPTADA',
  REJECTED:  'RECHAZADA',
  EXPIRED:   'VENCIDA',
  CONVERTED: 'CONVERTIDA',
}

export async function generateQuotePdf(quote: any): Promise<Uint8Array> {
  const doc  = await PDFDocument.create()
  const page = doc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()

  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  // ── Header band ──────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: BRAND })
  page.drawText('HAX ESTUDIO CREATIVO EIRL', { x: 40, y: height - 36, size: 14, font: bold, color: WHITE })
  page.drawText('RNC: 133-290251', { x: 40, y: height - 54, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText('Santo Domingo, República Dominicana', { x: 40, y: height - 68, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9) })

  page.drawText('COTIZACIÓN', { x: width - 180, y: height - 36, size: 13, font: bold, color: WHITE })
  page.drawText(`N° ${quote.number}`, { x: width - 180, y: height - 54, size: 11, font: bold, color: WHITE })
  const buLabel = quote.businessUnit === 'HAX' ? 'Hax Estudio' : 'Koder'
  page.drawText(buLabel, { x: width - 180, y: height - 70, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9) })

  // ── Status + Dates row ───────────────────────────────────────
  let y = height - 100
  page.drawRectangle({ x: 0, y: y - 26, width, height: 28, color: LIGHT })

  const statusTxt = STATUS_LABEL[quote.status] ?? quote.status
  page.drawText(`Estado: ${statusTxt}`, { x: 40, y: y - 10, size: 8, font: bold, color: GRAY })
  page.drawText(`Emisión: ${fmtDate(quote.createdAt)}`, { x: width - 235, y: y - 10, size: 8, font: regular, color: GRAY })
  if (quote.validUntil) {
    page.drawText(`Válida hasta: ${fmtDate(quote.validUntil)}`, { x: width - 110, y: y - 10, size: 8, font: regular, color: GRAY })
  }

  y -= 42

  // ── Bill-to ──────────────────────────────────────────────────
  page.drawText('COTIZAR A:', { x: 40, y, size: 8, font: bold, color: GRAY })
  y -= 16
  const client = quote.client
  page.drawText(client?.name ?? '—', { x: 40, y, size: 11, font: bold, color: BLACK })
  y -= 15
  if (client?.rnc)   { page.drawText(`RNC / Cédula: ${client.rnc}`, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 13 }
  if (client?.email) { page.drawText(client.email, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 13 }
  if (client?.phone) { page.drawText(client.phone, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 13 }

  y -= 12

  // ── Items table ──────────────────────────────────────────────
  page.drawRectangle({ x: 40, y: y - 2, width: width - 80, height: 22, color: BRAND })
  const colX = [48, 310, 370, 450, 515]
  ;['Descripción', 'Cant.', 'Precio Unit.', 'ITBIS', 'Total'].forEach((h, i) => {
    page.drawText(h, { x: colX[i], y: y + 6, size: 8, font: bold, color: WHITE })
  })
  y -= 4

  const items: any[] = quote.items ?? []
  let rowY = y - 16
  items.forEach((item: any, idx: number) => {
    if (idx % 2 === 0) {
      page.drawRectangle({ x: 40, y: rowY - 2, width: width - 80, height: 18, color: LIGHT })
    }
    const desc = (item.description?.length ?? 0) > 55 ? item.description.slice(0, 52) + '…' : item.description
    const lineTotal = item.quantity * item.unitPrice + (item.isExempt ? 0 : (item.taxAmount ?? 0))
    page.drawText(desc ?? '',                        { x: colX[0], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(String(item.quantity),             { x: colX[1], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(fmt(item.unitPrice),               { x: colX[2], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(item.isExempt ? 'Exento' : fmt(item.taxAmount ?? 0), { x: colX[3], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(fmt(lineTotal),                    { x: colX[4], y: rowY + 4, size: 8, font: bold,    color: BLACK })
    rowY -= 20
  })

  // ── Totals ───────────────────────────────────────────────────
  rowY -= 8
  page.drawLine({ start: { x: 40, y: rowY }, end: { x: width - 40, y: rowY }, thickness: 0.5, color: LIGHT })
  rowY -= 18
  const totX = width - 200

  const totLines = [
    { label: 'Subtotal:', value: fmt(quote.subtotal ?? 0) },
    { label: 'ITBIS:',   value: fmt(quote.taxAmount ?? 0) },
  ]
  for (const t of totLines) {
    page.drawText(t.label, { x: totX, y: rowY, size: 9, font: regular, color: GRAY })
    page.drawText(t.value, { x: totX + 95, y: rowY, size: 9, font: regular, color: BLACK })
    rowY -= 16
  }
  page.drawRectangle({ x: totX - 10, y: rowY - 4, width: 165, height: 22, color: BRAND })
  page.drawText('TOTAL:',                { x: totX,      y: rowY + 4, size: 11, font: bold, color: WHITE })
  page.drawText(fmt(quote.total ?? 0),   { x: totX + 95, y: rowY + 4, size: 11, font: bold, color: WHITE })
  rowY -= 30

  // ── Terms ────────────────────────────────────────────────────
  if (quote.terms) {
    rowY -= 6
    page.drawText('Términos y condiciones:', { x: 40, y: rowY, size: 8, font: bold, color: GRAY })
    rowY -= 13
    const words = quote.terms.split(' ')
    let line = ''
    for (const w of words) {
      if ((line + w).length > 95) {
        page.drawText(line.trim(), { x: 40, y: rowY, size: 8, font: regular, color: GRAY })
        rowY -= 12; line = w + ' '
      } else { line += w + ' ' }
    }
    if (line.trim()) { page.drawText(line.trim(), { x: 40, y: rowY, size: 8, font: regular, color: GRAY }); rowY -= 12 }
  }

  // ── Notes ────────────────────────────────────────────────────
  if (quote.notes) {
    rowY -= 6
    page.drawText('Notas:', { x: 40, y: rowY, size: 8, font: bold, color: GRAY })
    rowY -= 13
    const words = quote.notes.split(' ')
    let line = ''
    for (const w of words) {
      if ((line + w).length > 95) {
        page.drawText(line.trim(), { x: 40, y: rowY, size: 8, font: regular, color: GRAY })
        rowY -= 12; line = w + ' '
      } else { line += w + ' ' }
    }
    if (line.trim()) { page.drawText(line.trim(), { x: 40, y: rowY, size: 8, font: regular, color: GRAY }) }
  }

  // ── Watermark ────────────────────────────────────────────────
  if (quote.status === 'REJECTED') {
    page.drawText('RECHAZADA', { x: 100, y: 250, size: 75, font: bold, color: rgb(0.85, 0.15, 0.15), opacity: 0.12, rotate: degrees(35) })
  } else if (quote.status === 'CONVERTED') {
    page.drawText('CONVERTIDA', { x: 80, y: 250, size: 72, font: bold, color: rgb(0.40, 0.10, 0.75), opacity: 0.10, rotate: degrees(35) })
  }

  // ── Footer ────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width, height: 42, color: BRAND })
  page.drawText('HAX ESTUDIO CREATIVO EIRL  ·  RNC: 133-290251  ·  erp.hax.com.do',
    { x: 40, y: 22, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText(`Generado el ${new Date().toLocaleDateString('es-DO')}`,
    { x: width - 155, y: 22, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText('Este documento no es un comprobante fiscal',
    { x: 40, y: 9, size: 7, font: regular, color: rgb(0.6, 0.65, 0.7) })

  return doc.save()
}

/** Generate PDF — uses custom template if one is active, falls back to built-in */
export async function generateQuotePdfWithTemplate(quote: any): Promise<Uint8Array> {
  const customTpl = await getActiveTemplate('QUOTE' as any)

  if (customTpl) {
    logger.info(`[PDF] Using custom template "${customTpl.name}" for quote ${quote.id}`)
    const data = buildQuoteTemplateData(quote)
    return renderTemplateToPdf(customTpl.html, data)
  }

  return generateQuotePdf(quote)
}

function buildQuoteTemplateData(quote: any) {
  return {
    company: { name: 'HAX ESTUDIO CREATIVO EIRL', rnc: '133-290251', address: 'Santo Domingo, RD' },
    quote: {
      number: quote.number,
      status: STATUS_LABEL[quote.status] ?? quote.status,
      createdAt: quote.createdAt,
      validUntil: quote.validUntil,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      total: quote.total,
      businessUnit: quote.businessUnit,
      notes: quote.notes,
      terms: quote.terms,
    },
    client: quote.client ?? {},
    items: (quote.items ?? []).map((i: any) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
      taxAmount: i.taxAmount,
      subtotal: i.subtotal,
      total: i.total,
      isExempt: i.isExempt,
    })),
    isAccepted:  quote.status === 'ACCEPTED',
    isRejected:  quote.status === 'REJECTED',
    isConverted: quote.status === 'CONVERTED',
    generatedAt: new Date().toLocaleDateString('es-DO'),
  }
}

/** Stream saved PDF or generate on-the-fly */
export async function getQuotePdfBytes(quoteId: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      client: true,
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!quote) throw new Error('Cotización no encontrada')

  // Try to serve from disk first
  if ((quote as any).pdfPath && (quote as any).pdfStatus === 'READY') {
    const fullPath = path.join(path.resolve(process.cwd(), '../../storage'), (quote as any).pdfPath)
    if (fs.existsSync(fullPath)) {
      return { bytes: fs.readFileSync(fullPath), filename: path.basename(fullPath) }
    }
  }

  const bytes = await generateQuotePdfWithTemplate(quote)
  const filename = `cotizacion-${quote.number}.pdf`
  return { bytes, filename }
}

/** Generate and save to disk, update Quote record */
export async function generateAndSaveQuotePdf(quoteId: string): Promise<string | null> {
  let quote: any
  try {
    quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { client: true, items: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!quote) return null

    await prisma.quote.update({ where: { id: quoteId }, data: { pdfStatus: 'GENERATING' as any } })

    const bytes = await generateQuotePdfWithTemplate(quote)

    const filename = `cotizacion_${quote.id}_${quote.number}_${fmtShort(quote.createdAt)}.pdf`
    const dir      = path.join(STORAGE_DIR, 'cotizaciones')
    const filePath = path.join(dir, filename)
    const relPath  = `pdfs/cotizaciones/${filename}`

    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, bytes)

    await prisma.quote.update({
      where: { id: quoteId },
      data: { pdfPath: relPath, pdfGeneratedAt: new Date(), pdfStatus: 'READY' as any },
    })

    logger.info(`[PDF] Quote ${quoteId} → ${relPath}`)
    return relPath
  } catch (err: any) {
    logger.error(`[PDF] Failed to generate quote PDF for ${quoteId}:`, err.message)
    try {
      await prisma.quote.update({ where: { id: quoteId }, data: { pdfStatus: 'ERROR' as any } })
    } catch { /* ignore */ }
    return null
  }
}
