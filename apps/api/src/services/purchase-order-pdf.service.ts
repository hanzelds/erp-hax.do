import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import { prisma } from '../config/database'
import { getActiveTemplate } from '../modules/pdf-templates/pdf-templates.service'
import { renderTemplateToPdf } from './template-renderer.service'

const BRAND = rgb(0.161, 0.235, 0.310)
const GRAY  = rgb(0.45,  0.45,  0.45)
const LIGHT = rgb(0.96,  0.97,  0.98)
const WHITE = rgb(1,     1,     1)
const BLACK = rgb(0,     0,     0)
const PURP  = rgb(0.45,  0.10,  0.75)

function fmt(n: number) {
  return 'RD$ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:     'BORRADOR',
  SENT:      'ENVIADA',
  CONFIRMED: 'CONFIRMADA',
  RECEIVED:  'RECIBIDA',
  CANCELLED: 'CANCELADA',
}

function buildPOTemplateData(po: any, cfg: any) {
  const company = {
    name:    cfg?.companyName ?? 'HAX ESTUDIO CREATIVO EIRL',
    rnc:     cfg?.rnc         ?? '133-290251',
    address: cfg?.address     ?? 'Santo Domingo, República Dominicana',
  }
  return {
    company,
    po: {
      number:       po.number,
      status:       STATUS_LABEL[po.status] ?? po.status,
      businessUnit: po.businessUnit,
      createdAt:    po.createdAt,
      subtotal:     po.subtotal ?? 0,
      taxAmount:    po.taxAmount ?? 0,
      total:        po.total ?? 0,
      isCredit:     po.isCredit ?? false,
      paymentTerms: po.paymentTerms ?? null,
      dueDate:      po.dueDate ?? null,
      notes:        po.notes ?? null,
    },
    supplier: po.supplier ? {
      name:  po.supplier.name,
      rnc:   po.supplier.rnc   ?? null,
      email: po.supplier.email ?? null,
      phone: po.supplier.phone ?? null,
    } : null,
    items: (po.items ?? []).map((item: any) => ({
      description: item.description,
      quantity:    item.quantity,
      unitPrice:   item.unitPrice,
      taxAmount:   item.taxAmount ?? 0,
      total:       item.total ?? 0,
      isExempt:    item.isExempt ?? false,
    })),
    isCancelled:  po.status === 'CANCELLED',
    generatedAt:  new Date().toLocaleDateString('es-DO'),
  }
}

export async function getPurchaseOrderPdfBytes(poId: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const po = await (prisma.purchaseOrder as any).findUnique({
    where: { id: poId },
    include: {
      supplier: true,
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!po) throw new Error('Orden de compra no encontrada')

  const cfg = await prisma.companyConfig.findUnique({ where: { id: 'main' } })

  // Use custom Handlebars template if one is active
  const customTpl = await getActiveTemplate('PURCHASE_ORDER' as any)
  if (customTpl) {
    const data  = buildPOTemplateData(po, cfg)
    const bytes = await renderTemplateToPdf(customTpl.html, data)
    return { bytes, filename: `oc-${po.number}.pdf` }
  }

  const doc  = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const { width, height } = page.getSize()

  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  const companyName = cfg?.companyName ?? 'HAX ESTUDIO CREATIVO EIRL'
  const companyRnc  = cfg?.rnc        ?? '133-290251'
  const buLabel     = po.businessUnit === 'HAX' ? 'Hax Estudio Creativo' : po.businessUnit === 'KODER' ? 'KODER' : 'Al Dia ERP'

  // ── Header band ──────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: BRAND })
  page.drawText(companyName, { x: 40, y: height - 36, size: 13, font: bold, color: WHITE })
  page.drawText(`RNC: ${companyRnc}`, { x: 40, y: height - 53, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText('Santo Domingo, República Dominicana', { x: 40, y: height - 67, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9) })

  page.drawText('ORDEN DE COMPRA', { x: width - 200, y: height - 36, size: 12, font: bold, color: WHITE })
  page.drawText(`N° ${po.number}`, { x: width - 200, y: height - 53, size: 11, font: bold, color: WHITE })
  page.drawText(buLabel, { x: width - 200, y: height - 68, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9) })

  // ── Status row ───────────────────────────────────────────────
  let y = height - 100
  page.drawRectangle({ x: 0, y: y - 26, width, height: 28, color: LIGHT })

  const statusTxt = STATUS_LABEL[po.status] ?? po.status
  page.drawText(`Estado: ${statusTxt}`, { x: 40, y: y - 10, size: 8, font: bold, color: GRAY })
  page.drawText(`Emisión: ${fmtDate(po.createdAt)}`, { x: 250, y: y - 10, size: 8, font: regular, color: GRAY })

  if (po.isCredit) {
    const termsTxt = `Crédito ${po.paymentTerms ?? 30} días`
    page.drawText(termsTxt, { x: width - 170, y: y - 10, size: 8, font: bold, color: PURP })
    if (po.dueDate) {
      page.drawText(`Vence: ${fmtDate(po.dueDate)}`, { x: width - 110, y: y - 10, size: 8, font: regular, color: GRAY })
    }
  }

  y -= 42

  // ── Supplier info ────────────────────────────────────────────
  page.drawText('PROVEEDOR:', { x: 40, y, size: 8, font: bold, color: GRAY })
  y -= 16
  const supplier = po.supplier
  page.drawText(supplier?.name ?? '—', { x: 40, y, size: 11, font: bold, color: BLACK })
  y -= 15
  if (supplier?.rnc)     { page.drawText(`RNC: ${supplier.rnc}`, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 13 }
  if (supplier?.email)   { page.drawText(supplier.email, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 13 }
  if (supplier?.phone)   { page.drawText(supplier.phone, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 13 }

  y -= 12

  // ── Items table ──────────────────────────────────────────────
  page.drawRectangle({ x: 40, y: y - 2, width: width - 80, height: 22, color: BRAND })
  const colX = [48, 310, 370, 450, 515]
  ;['Descripción', 'Cant.', 'Precio Unit.', 'ITBIS', 'Total'].forEach((h, i) => {
    page.drawText(h, { x: colX[i], y: y + 6, size: 8, font: bold, color: WHITE })
  })
  y -= 4

  const items: any[] = po.items ?? []
  let rowY = y - 16
  items.forEach((item: any, idx: number) => {
    if (idx % 2 === 0) {
      page.drawRectangle({ x: 40, y: rowY - 2, width: width - 80, height: 18, color: LIGHT })
    }
    const desc = (item.description?.length ?? 0) > 55 ? item.description.slice(0, 52) + '…' : item.description
    page.drawText(desc ?? '',             { x: colX[0], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(String(item.quantity),  { x: colX[1], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(fmt(item.unitPrice),    { x: colX[2], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(fmt(item.taxAmount ?? 0), { x: colX[3], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(fmt(item.total ?? 0),   { x: colX[4], y: rowY + 4, size: 8, font: bold,    color: BLACK })
    rowY -= 20
  })

  // ── Totals ───────────────────────────────────────────────────
  rowY -= 8
  page.drawLine({ start: { x: 40, y: rowY }, end: { x: width - 40, y: rowY }, thickness: 0.5, color: LIGHT })
  rowY -= 18
  const totX = width - 200

  const totLines = [
    { label: 'Subtotal:', value: fmt(po.subtotal ?? 0) },
    { label: 'ITBIS:',   value: fmt(po.taxAmount ?? 0) },
  ]
  for (const t of totLines) {
    page.drawText(t.label, { x: totX, y: rowY, size: 9, font: regular, color: GRAY })
    page.drawText(t.value, { x: totX + 95, y: rowY, size: 9, font: regular, color: BLACK })
    rowY -= 16
  }
  page.drawRectangle({ x: totX - 10, y: rowY - 4, width: 165, height: 22, color: BRAND })
  page.drawText('TOTAL:',          { x: totX,      y: rowY + 4, size: 11, font: bold, color: WHITE })
  page.drawText(fmt(po.total ?? 0), { x: totX + 95, y: rowY + 4, size: 11, font: bold, color: WHITE })
  rowY -= 30

  // ── Notes ────────────────────────────────────────────────────
  if (po.notes) {
    rowY -= 6
    page.drawText('Notas:', { x: 40, y: rowY, size: 8, font: bold, color: GRAY })
    rowY -= 13
    const words = po.notes.split(' ')
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
  if (po.status === 'CANCELLED') {
    page.drawText('CANCELADA', { x: 90, y: 250, size: 72, font: bold, color: rgb(0.85, 0.15, 0.15), opacity: 0.12, rotate: degrees(35) })
  }

  // ── Footer ───────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width, height: 42, color: BRAND })
  page.drawText(`${companyName}  ·  RNC: ${companyRnc}  ·  erp.hax.com.do`,
    { x: 40, y: 22, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText(`Generado el ${new Date().toLocaleDateString('es-DO')}`,
    { x: width - 155, y: 22, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText('Documento interno — no es un comprobante fiscal',
    { x: 40, y: 9, size: 7, font: regular, color: rgb(0.6, 0.65, 0.7) })

  const bytes = await doc.save()
  return { bytes, filename: `oc-${po.number}.pdf` }
}
