import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const BRAND = rgb(0.161, 0.235, 0.31)   // #293c4f
const GRAY  = rgb(0.45, 0.45, 0.45)
const LIGHT = rgb(0.96, 0.97, 0.98)
const RED   = rgb(0.8, 0.1, 0.1)
const WHITE = rgb(1, 1, 1)
const BLACK = rgb(0, 0, 0)

function fmt(n: number) {
  return 'RD$ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })
}

const NCF_TYPE: Record<string, string> = {
  CREDITO_FISCAL:    'B01 — Crédito Fiscal',
  CONSUMIDOR_FINAL:  'B02 — Consumidor Final',
  NOTA_DEBITO:       'B03 — Nota de Débito',
  NOTA_CREDITO:      'B04 — Nota de Crédito',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:     'BORRADOR',
  SENDING:   'ENVIANDO',
  APPROVED:  'APROBADA',
  REJECTED:  'RECHAZADA',
  CANCELLED: 'ANULADA',
  PAID:      'PAGADA',
}

export async function generateInvoicePdf(invoice: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()

  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  let y = height - 40

  // ── Header band ───────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: BRAND })

  // Company name
  page.drawText('HAX ESTUDIO CREATIVO EIRL', {
    x: 40, y: height - 38, size: 14, font: bold, color: WHITE,
  })
  page.drawText('RNC: 133290251', {
    x: 40, y: height - 56, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9),
  })
  page.drawText('Santo Domingo, República Dominicana', {
    x: 40, y: height - 70, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9),
  })

  // Invoice number (right side of header)
  const invoiceLabel = invoice.type === 'NOTA_CREDITO' ? 'NOTA DE CRÉDITO' :
                       invoice.type === 'NOTA_DEBITO'  ? 'NOTA DE DÉBITO'  : 'FACTURA'
  page.drawText(invoiceLabel, {
    x: width - 180, y: height - 38, size: 13, font: bold, color: WHITE,
  })
  page.drawText(`N° ${invoice.number}`, {
    x: width - 180, y: height - 56, size: 11, font: bold, color: WHITE,
  })

  // Status badge (if not APPROVED/PAID)
  if (invoice.status === 'CANCELLED' || invoice.status === 'REJECTED') {
    page.drawRectangle({ x: width - 130, y: height - 82, width: 90, height: 20, color: RED })
    page.drawText(STATUS_LABEL[invoice.status] ?? invoice.status, {
      x: width - 125, y: height - 76, size: 9, font: bold, color: WHITE,
    })
  }

  y = height - 110

  // ── NCF + Dates row ───────────────────────────────────────
  page.drawRectangle({ x: 0, y: y - 30, width, height: 32, color: LIGHT })

  if (invoice.ncf) {
    page.drawText('NCF:', { x: 40, y: y - 12, size: 8, font: bold, color: GRAY })
    page.drawText(invoice.ncf, { x: 70, y: y - 12, size: 9, font: bold, color: BRAND })
  }

  const typeLabel = NCF_TYPE[invoice.type] ?? invoice.type
  page.drawText(typeLabel, { x: 200, y: y - 12, size: 8, font: regular, color: GRAY })

  page.drawText(`Fecha: ${fmtDate(invoice.issueDate)}`, {
    x: width - 220, y: y - 12, size: 8, font: regular, color: GRAY,
  })
  if (invoice.dueDate) {
    page.drawText(`Vence: ${fmtDate(invoice.dueDate)}`, {
      x: width - 120, y: y - 12, size: 8, font: regular, color: GRAY,
    })
  }

  y -= 50

  // ── Bill-to box ───────────────────────────────────────────
  page.drawText('FACTURAR A:', { x: 40, y, size: 8, font: bold, color: GRAY })
  y -= 16

  const client = invoice.client
  page.drawText(client?.name ?? '—', { x: 40, y, size: 11, font: bold, color: BLACK })
  y -= 15
  if (client?.rnc) {
    page.drawText(`RNC / Cédula: ${client.rnc}`, { x: 40, y, size: 9, font: regular, color: GRAY })
    y -= 13
  }
  if (client?.email) {
    page.drawText(client.email, { x: 40, y, size: 9, font: regular, color: GRAY })
    y -= 13
  }
  if (client?.address) {
    page.drawText(client.address, { x: 40, y, size: 9, font: regular, color: GRAY })
    y -= 13
  }

  // Business unit tag
  const buLabel = `Unidad: ${invoice.businessUnit}`
  page.drawText(buLabel, { x: width - 140, y: y + 35, size: 9, font: bold, color: BRAND })

  y -= 20

  // ── Items table header ────────────────────────────────────
  page.drawRectangle({ x: 40, y: y - 2, width: width - 80, height: 22, color: BRAND })
  const headers = ['Descripción', 'Cant.', 'Precio Unit.', 'ITBIS', 'Total']
  const colX    = [48, 310, 370, 450, 515]
  headers.forEach((h, i) => {
    page.drawText(h, { x: colX[i], y: y + 6, size: 8, font: bold, color: WHITE })
  })

  y -= 4

  // ── Items rows ────────────────────────────────────────────
  const items: any[] = invoice.items ?? []
  let rowY = y - 16

  items.forEach((item: any, idx: number) => {
    if (idx % 2 === 0) {
      page.drawRectangle({ x: 40, y: rowY - 2, width: width - 80, height: 18, color: LIGHT })
    }

    const desc = item.description?.length > 55 ? item.description.slice(0, 52) + '…' : item.description
    page.drawText(desc ?? '', { x: colX[0], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(String(item.quantity), { x: colX[1], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(fmt(item.unitPrice), { x: colX[2], y: rowY + 4, size: 8, font: regular, color: BLACK })
    page.drawText(item.isExempt ? 'Exento' : fmt(item.taxAmount ?? 0), { x: colX[3], y: rowY + 4, size: 8, font: regular, color: BLACK })
    const lineTotal = item.quantity * item.unitPrice + (item.taxAmount ?? 0)
    page.drawText(fmt(lineTotal), { x: colX[4], y: rowY + 4, size: 8, font: bold, color: BLACK })

    rowY -= 20
  })

  // ── Divider ───────────────────────────────────────────────
  rowY -= 8
  page.drawLine({ start: { x: 40, y: rowY }, end: { x: width - 40, y: rowY }, thickness: 0.5, color: LIGHT })

  // ── Totals block (right-aligned) ──────────────────────────
  rowY -= 18
  const totX = width - 200

  const totals = [
    { label: 'Subtotal:', value: fmt(invoice.subtotal ?? 0) },
    { label: `ITBIS (18%):`, value: fmt(invoice.taxAmount ?? 0) },
  ]

  for (const t of totals) {
    page.drawText(t.label, { x: totX, y: rowY, size: 9, font: regular, color: GRAY })
    page.drawText(t.value, { x: totX + 90, y: rowY, size: 9, font: regular, color: BLACK })
    rowY -= 16
  }

  // Total row with background
  page.drawRectangle({ x: totX - 10, y: rowY - 4, width: 165, height: 22, color: BRAND })
  page.drawText('TOTAL:', { x: totX, y: rowY + 4, size: 11, font: bold, color: WHITE })
  page.drawText(fmt(invoice.total ?? 0), { x: totX + 90, y: rowY + 4, size: 11, font: bold, color: WHITE })

  rowY -= 30

  // Amount paid / due (if partially paid)
  if ((invoice.amountPaid ?? 0) > 0) {
    page.drawText(`Pagado: ${fmt(invoice.amountPaid)}`, { x: totX, y: rowY, size: 9, font: regular, color: GRAY })
    rowY -= 14
    page.drawText(`Saldo pendiente: ${fmt(invoice.amountDue)}`, {
      x: totX, y: rowY, size: 9, font: bold, color: invoice.amountDue > 0 ? RED : GRAY,
    })
    rowY -= 20
  }

  // ── Notes ─────────────────────────────────────────────────
  if (invoice.notes) {
    rowY -= 10
    page.drawText('Notas:', { x: 40, y: rowY, size: 8, font: bold, color: GRAY })
    rowY -= 14
    // wrap notes at 90 chars
    const words = invoice.notes.split(' ')
    let line = ''
    for (const w of words) {
      if ((line + w).length > 90) {
        page.drawText(line.trim(), { x: 40, y: rowY, size: 8, font: regular, color: GRAY })
        rowY -= 13
        line = w + ' '
      } else {
        line += w + ' '
      }
    }
    if (line.trim()) {
      page.drawText(line.trim(), { x: 40, y: rowY, size: 8, font: regular, color: GRAY })
      rowY -= 13
    }
  }

  // ── Footer ────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width, height: 36, color: BRAND })
  page.drawText('HAX ESTUDIO CREATIVO EIRL  |  RNC: 133290251  |  erp.hax.com.do', {
    x: 40, y: 14, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9),
  })
  page.drawText(`Generado el ${new Date().toLocaleDateString('es-DO')}`, {
    x: width - 160, y: 14, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9),
  })

  return doc.save()
}
