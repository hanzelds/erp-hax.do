import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import QRCode from 'qrcode'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { prisma } from '../config/database'
import { logger } from '../config/logger'
import { getActiveTemplate } from '../modules/pdf-templates/pdf-templates.service'
import { renderTemplateToPdf } from './template-renderer.service'

const BRAND  = rgb(0.161, 0.235, 0.310)  // #293C4F
const GRAY   = rgb(0.45,  0.45,  0.45)
const LIGHT  = rgb(0.96,  0.97,  0.98)
const RED    = rgb(0.80,  0.10,  0.10)
const GREEN  = rgb(0.13,  0.55,  0.13)
const WHITE  = rgb(1,     1,     1)
const BLACK  = rgb(0,     0,     0)

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

const NCF_TYPE: Record<string, string> = {
  CREDITO_FISCAL:   'B01 — Crédito Fiscal',
  CONSUMO:          'B02 — Consumidor Final',
  CONSUMIDOR_FINAL: 'B02 — Consumidor Final',
  NOTA_DEBITO:      'B03 — Nota de Débito',
  NOTA_CREDITO:     'B04 — Nota de Crédito',
  REGIMEN_ESPECIAL: 'B14 — Régimen Especial',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:     'BORRADOR',
  SENDING:   'ENVIANDO',
  APPROVED:  'APROBADA',
  REJECTED:  'RECHAZADA',
  CANCELLED: 'ANULADA',
  PAID:      'PAGADA',
  IN_PROCESS:'EN PROCESO',
}

async function generateQrDataUrl(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, { width: 80, margin: 0, color: { dark: '#293C4F', light: '#FFFFFF' } })
  } catch { return null }
}

export async function generateInvoicePdf(invoice: any): Promise<Uint8Array> {
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

  const docLabel = invoice.type === 'NOTA_CREDITO'    ? 'NOTA DE CRÉDITO' :
                   invoice.type === 'NOTA_DEBITO'     ? 'NOTA DE DÉBITO'  :
                   invoice.type === 'REGIMEN_ESPECIAL'? 'FACTURA B14 — RÉGIMEN ESPECIAL' :
                   'FACTURA'
  page.drawText(docLabel,          { x: width - 180, y: height - 36, size: 13, font: bold,    color: WHITE })
  page.drawText(`N° ${invoice.number}`, { x: width - 180, y: height - 54, size: 11, font: bold,    color: WHITE })
  const buLabel = invoice.businessUnit === 'HAX' ? 'Hax Estudio' : 'Koder'
  page.drawText(buLabel,           { x: width - 180, y: height - 70, size: 9,  font: regular, color: rgb(0.8, 0.85, 0.9) })

  // ── NCF + Type + Dates row ───────────────────────────────────
  let y = height - 100
  page.drawRectangle({ x: 0, y: y - 26, width, height: 28, color: LIGHT })

  if (invoice.ncf) {
    page.drawText('e-CF:', { x: 40, y: y - 10, size: 8, font: bold, color: GRAY })
    page.drawText(invoice.ncf, { x: 72, y: y - 10, size: 9, font: bold, color: BRAND })
  }
  page.drawText(NCF_TYPE[invoice.type] ?? invoice.type, { x: 195, y: y - 10, size: 8, font: regular, color: GRAY })
  page.drawText(`Emisión: ${fmtDate(invoice.issueDate)}`, { x: width - 235, y: y - 10, size: 8, font: regular, color: GRAY })
  if (invoice.dueDate) {
    page.drawText(`Vence: ${fmtDate(invoice.dueDate)}`, { x: width - 110, y: y - 10, size: 8, font: regular, color: GRAY })
  }

  // ── Original invoice ref (credit notes) ────────────────────
  if (invoice.type === 'NOTA_CREDITO' && invoice.originalInvoice?.ncf) {
    y -= 36
    page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 20, color: rgb(1, 0.97, 0.88) })
    page.drawText(`Referencia: Anula parcial o totalmente la factura ${invoice.originalInvoice.ncf}`,
      { x: 48, y: y + 4, size: 8, font: regular, color: rgb(0.6, 0.35, 0) })
  }

  y -= 42

  // ── Bill-to ──────────────────────────────────────────────────
  page.drawText('FACTURAR A:', { x: 40, y, size: 8, font: bold, color: GRAY })
  y -= 16
  const client = invoice.client
  page.drawText(client?.name ?? '—', { x: 40, y, size: 11, font: bold, color: BLACK })
  y -= 15
  if (client?.rnc) { page.drawText(`RNC / Cédula: ${client.rnc}`, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 13 }
  if (client?.email) { page.drawText(client.email, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 13 }
  if (client?.address) { page.drawText(client.address, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 13 }

  y -= 12

  // ── Items table ──────────────────────────────────────────────
  page.drawRectangle({ x: 40, y: y - 2, width: width - 80, height: 22, color: BRAND })
  const colX = [48, 310, 370, 450, 515]
  ;['Descripción', 'Cant.', 'Precio Unit.', 'ITBIS', 'Total'].forEach((h, i) => {
    page.drawText(h, { x: colX[i], y: y + 6, size: 8, font: bold, color: WHITE })
  })
  y -= 4

  const items: any[] = invoice.items ?? []
  let rowY = y - 16
  items.forEach((item: any, idx: number) => {
    if (idx % 2 === 0) {
      page.drawRectangle({ x: 40, y: rowY - 2, width: width - 80, height: 18, color: LIGHT })
    }
    const desc = (item.description?.length ?? 0) > 55 ? item.description.slice(0, 52) + '…' : item.description
    const lineTotal = item.quantity * item.unitPrice + (item.taxAmount ?? 0)
    page.drawText(desc ?? '',              { x: colX[0], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(String(item.quantity),   { x: colX[1], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(fmt(item.unitPrice),     { x: colX[2], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(item.isExempt ? 'Exento' : fmt(item.taxAmount ?? 0), { x: colX[3], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(fmt(lineTotal),          { x: colX[4], y: rowY + 4, size: 8, font: bold,    color: BLACK })
    rowY -= 20
  })

  // ── Totals ───────────────────────────────────────────────────
  rowY -= 8
  page.drawLine({ start: { x: 40, y: rowY }, end: { x: width - 40, y: rowY }, thickness: 0.5, color: LIGHT })
  rowY -= 18
  const totX = width - 200

  const isRegimenEspecial = invoice.type === 'REGIMEN_ESPECIAL'
  const totLines = [
    { label: 'Subtotal:', value: fmt(invoice.subtotal ?? 0) },
    { label: isRegimenEspecial ? 'ITBIS (B14):' : 'ITBIS (18%):', value: isRegimenEspecial ? 'Exento' : fmt(invoice.taxAmount ?? 0) },
  ]
  for (const t of totLines) {
    page.drawText(t.label, { x: totX, y: rowY, size: 9, font: regular, color: GRAY })
    page.drawText(t.value, { x: totX + 95, y: rowY, size: 9, font: regular, color: BLACK })
    rowY -= 16
  }
  page.drawRectangle({ x: totX - 10, y: rowY - 4, width: 165, height: 22, color: BRAND })
  page.drawText('TOTAL:',              { x: totX,      y: rowY + 4, size: 11, font: bold, color: WHITE })
  page.drawText(fmt(invoice.total ?? 0), { x: totX + 95, y: rowY + 4, size: 11, font: bold, color: WHITE })
  rowY -= 30

  if ((invoice.amountPaid ?? 0) > 0) {
    page.drawText(`Pagado: ${fmt(invoice.amountPaid)}`, { x: totX, y: rowY, size: 9, font: regular, color: GRAY })
    rowY -= 14
    page.drawText(`Saldo: ${fmt(invoice.amountDue)}`, {
      x: totX, y: rowY, size: 9, font: bold, color: invoice.amountDue > 0 ? RED : GREEN,
    })
    rowY -= 20
  }

  // ── QR Code (if xml url or ncf) ──────────────────────────────
  const qrUrl = invoice.xmlUrl || (invoice.ncf ? `https://dgii.gov.do/verificacion/${invoice.ncf}` : null)
  if (qrUrl) {
    const qrDataUrl = await generateQrDataUrl(qrUrl)
    if (qrDataUrl) {
      const qrBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64')
      const qrImg   = await doc.embedPng(qrBytes)
      page.drawImage(qrImg, { x: 40, y: rowY - 80, width: 80, height: 80 })
      page.drawText('Verificar en DGII', { x: 40, y: rowY - 90, size: 7, font: regular, color: GRAY })
    }
  }

  // ── Notes ───────────────────────────────────────────────────
  if (invoice.notes) {
    rowY -= 10
    page.drawText('Notas:', { x: 140, y: rowY, size: 8, font: bold, color: GRAY })
    rowY -= 13
    const words = invoice.notes.split(' ')
    let line = ''
    for (const w of words) {
      if ((line + w).length > 75) {
        page.drawText(line.trim(), { x: 140, y: rowY, size: 8, font: regular, color: GRAY })
        rowY -= 12; line = w + ' '
      } else { line += w + ' ' }
    }
    if (line.trim()) { page.drawText(line.trim(), { x: 140, y: rowY, size: 8, font: regular, color: GRAY }) }
  }

  // ── Fiscal legend ─────────────────────────────────────────────
  page.drawText('Este documento es una representación impresa del e-CF emitido ante la DGII.',
    { x: 40, y: 55, size: 7, font: regular, color: GRAY })

  // ── Footer ────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width, height: 42, color: BRAND })
  page.drawText('HAX ESTUDIO CREATIVO EIRL  ·  RNC: 133-290251  ·  erp.hax.com.do',
    { x: 40, y: 22, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText(`Generado el ${new Date().toLocaleDateString('es-DO')}`,
    { x: width - 155, y: 22, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText('Documento fiscal — conservar por 10 años',
    { x: 40, y: 9, size: 7, font: regular, color: rgb(0.6, 0.65, 0.7) })

  // ── Watermark ────────────────────────────────────────────────
  if (invoice.status === 'CANCELLED') {
    page.drawText('ANULADA', {
      x: 130, y: 250, size: 90, font: bold,
      color: rgb(0.85, 0.15, 0.15), opacity: 0.12, rotate: degrees(35),
    })
  } else if (invoice.paymentStatus === 'PAID' || invoice.status === 'PAID') {
    page.drawText('PAGADA', {
      x: 130, y: 250, size: 90, font: bold,
      color: rgb(0.13, 0.55, 0.13), opacity: 0.10, rotate: degrees(35),
    })
  }

  return doc.save()
}

/** Generate PDF — uses custom template if one is active, falls back to built-in */
export async function generateInvoicePdfWithTemplate(invoice: any): Promise<Uint8Array> {
  const templateType = invoice.type === 'NOTA_CREDITO' ? 'CREDIT_NOTE' : 'INVOICE'
  // REGIMEN_ESPECIAL uses INVOICE template — ITBIS already 0 in data
  const customTpl    = await getActiveTemplate(templateType as any)

  if (customTpl) {
    logger.info(`[PDF] Using custom template "${customTpl.name}" for ${invoice.id}`)
    const data = buildInvoiceTemplateData(invoice)
    return renderTemplateToPdf(customTpl.html, data)
  }

  // Fall back to built-in pdf-lib renderer
  return generateInvoicePdf(invoice)
}

function buildInvoiceTemplateData(invoice: any) {
  return {
    company: { name: 'HAX ESTUDIO CREATIVO EIRL', rnc: '133-290251', address: 'Santo Domingo, RD' },
    invoice: {
      number: invoice.number,
      ncf: invoice.ncf,
      type: invoice.type === 'NOTA_CREDITO'    ? 'NOTA DE CRÉDITO' :
            invoice.type === 'CONSUMO'          ? 'FACTURA CONSUMIDOR FINAL' :
            invoice.type === 'REGIMEN_ESPECIAL' ? 'FACTURA RÉGIMEN ESPECIAL (B14)' :
            'FACTURA DE CRÉDITO FISCAL',
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
      amountPaid: invoice.amountPaid ?? 0,
      amountDue: invoice.amountDue ?? 0,
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
      businessUnit: invoice.businessUnit,
      notes: invoice.notes,
    },
    client: invoice.client ?? {},
    items: (invoice.items ?? []).map((i: any) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
      taxAmount: i.taxAmount,
      subtotal: i.subtotal,
      total: i.total,
      isExempt: i.isExempt,
    })),
    isApproved: invoice.status === 'APPROVED',
    isCancelled: invoice.status === 'CANCELLED',
    isPaid: invoice.paymentStatus === 'PAID' || invoice.status === 'PAID',
    originalNcf: invoice.originalInvoice?.ncf ?? null,
    generatedAt: new Date().toLocaleDateString('es-DO'),
  }
}

/** Generate and persist PDF to disk, update Invoice record */
export async function generateAndSaveInvoicePdf(invoiceId: string): Promise<string | null> {
  let invoice: any
  try {
    invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: true,
        items: { orderBy: { sortOrder: 'asc' } },
        originalInvoice: { select: { ncf: true, number: true } },
      },
    })
    if (!invoice) return null

    // Mark as generating
    await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfStatus: 'GENERATING' } })

    const bytes = await generateInvoicePdfWithTemplate(invoice)

    // Determine sub-folder
    const subfolder = invoice.type === 'NOTA_CREDITO' ? 'notas-credito' : 'facturas'
    const filename  = `${subfolder === 'notas-credito' ? 'nota_credito' : 'factura'}_${invoice.id}_${invoice.ncf ?? invoice.number}_${fmtShort(invoice.issueDate)}.pdf`
    const dir       = path.join(STORAGE_DIR, subfolder)
    const filePath  = path.join(dir, filename)
    const relPath   = `pdfs/${subfolder}/${filename}`

    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, bytes)

    const hash    = crypto.createHash('sha256').update(bytes).digest('hex')
    const sizeBytes = bytes.byteLength

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        pdfPath: relPath,
        pdfGeneratedAt: new Date(),
        pdfStatus: 'READY',
      },
    })

    logger.info(`[PDF] Invoice ${invoiceId} → ${relPath} (${sizeBytes} bytes, sha256: ${hash.slice(0, 8)}…)`)
    return relPath
  } catch (err: any) {
    logger.error(`[PDF] Failed to generate invoice PDF for ${invoiceId}:`, err.message)
    try {
      await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfStatus: 'ERROR' } })
    } catch { /* ignore */ }
    return null
  }
}

/** Stream saved PDF or generate on-the-fly */
export async function getInvoicePdfBytes(invoiceId: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      items: { orderBy: { sortOrder: 'asc' } },
      originalInvoice: { select: { ncf: true, number: true } },
    },
  })
  if (!invoice) throw new Error('Factura no encontrada')

  // Try to serve from disk first
  if (invoice.pdfPath && invoice.pdfStatus === 'READY') {
    const fullPath = path.join(path.resolve(process.cwd(), '../../storage'), invoice.pdfPath)
    if (fs.existsSync(fullPath)) {
      return { bytes: fs.readFileSync(fullPath), filename: path.basename(fullPath) }
    }
  }

  // Fall back to on-the-fly generation (with custom template support)
  const bytes = await generateInvoicePdfWithTemplate(invoice)
  const filename = `factura-${invoice.number}.pdf`
  return { bytes, filename }
}
