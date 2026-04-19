import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib'
import * as path from 'path'
import * as fs from 'fs'

const BRAND  = rgb(0.161, 0.235, 0.310)
const GRAY   = rgb(0.45,  0.45,  0.45)
const LIGHT  = rgb(0.96,  0.97,  0.98)
const WHITE  = rgb(1,     1,     1)
const BLACK  = rgb(0,     0,     0)
const GREEN  = rgb(0.13,  0.55,  0.13)
const RED    = rgb(0.75,  0.10,  0.10)

const STORAGE_DIR = path.resolve(process.cwd(), '../../storage/pdfs')

function fmt(n: number) {
  return 'RD$ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
function pct(n: number) {
  return (n * 100).toFixed(1) + '%'
}
function periodLabel(period: string) {
  const [year, month] = period.split('-')
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${months[parseInt(month) - 1]} ${year}`
}
function nowLabel() {
  return new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })
}

async function buildHeader(doc: PDFDocument, page: PDFPage, title: string, subtitle: string) {
  const { width, height } = page.getSize()
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: BRAND })
  page.drawText('HAX ESTUDIO CREATIVO EIRL', { x: 40, y: height - 30, size: 13, font: bold, color: WHITE })
  page.drawText('RNC: 133-290251  ·  Santo Domingo, RD', { x: 40, y: height - 47, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText(title,    { x: width - 260, y: height - 30, size: 12, font: bold,    color: WHITE })
  page.drawText(subtitle, { x: width - 260, y: height - 48, size: 9,  font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText(`Generado: ${nowLabel()}`, { x: width - 260, y: height - 63, size: 8, font: regular, color: rgb(0.7, 0.75, 0.8) })

  return { bold, regular }
}

async function buildFooter(doc: PDFDocument, page: PDFPage, pageNum = 1) {
  const { width } = page.getSize()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  page.drawRectangle({ x: 0, y: 0, width, height: 36, color: BRAND })
  page.drawText('HAX ESTUDIO CREATIVO EIRL  ·  RNC: 133-290251  ·  erp.hax.com.do',
    { x: 40, y: 18, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText(`Página ${pageNum}`, { x: width - 80, y: 18, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText('Documento confidencial — uso interno', { x: 40, y: 6, size: 7, font: regular, color: rgb(0.6, 0.65, 0.7) })
}

function sectionHeader(page: PDFPage, bold: any, y: number, label: string, width: number) {
  page.drawRectangle({ x: 40, y: y - 2, width: width - 80, height: 20, color: BRAND })
  page.drawText(label, { x: 48, y: y + 4, size: 9, font: bold, color: WHITE })
  return y - 28
}

function dataRow(page: PDFPage, regular: any, bold: any, y: number, label: string,
  value: string, width: number, idx: number, valueColor = BLACK) {
  if (idx % 2 === 0) {
    page.drawRectangle({ x: 40, y: y - 4, width: width - 80, height: 18, color: LIGHT })
  }
  page.drawText(label, { x: 48, y, size: 9, font: regular, color: BLACK })
  page.drawText(value, { x: width - 180, y, size: 9, font: bold, color: valueColor })
  return y - 20
}

// ── P&L ───────────────────────────────────────────────────────────────────

export async function generatePnlPdf(data: any, period: string, businessUnit?: string): Promise<Uint8Array> {
  const doc  = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const { width, height } = page.getSize()

  const buLabel = businessUnit ? ` — ${businessUnit}` : ' — Consolidado'
  const { bold, regular } = await buildHeader(doc, page, 'ESTADO DE RESULTADOS', `${periodLabel(period)}${buLabel}`)

  let y = height - 105

  // Revenue
  y = sectionHeader(page, bold, y, 'INGRESOS', width)
  y = dataRow(page, regular, bold, y, 'Ingresos brutos (facturado)', fmt(data.grossRevenue), width, 0)
  y = dataRow(page, regular, bold, y, 'ITBIS en ingresos', fmt(data.taxRevenue ?? 0), width, 1)
  y = dataRow(page, regular, bold, y, 'Ingresos netos (cobrado)', fmt(data.collectedRevenue), width, 2)
  y -= 8

  // Expenses
  y = sectionHeader(page, bold, y, 'GASTOS', width)
  y = dataRow(page, regular, bold, y, 'Total gastos operativos', fmt(data.totalExpenses), width, 0, RED)
  y = dataRow(page, regular, bold, y, 'ITBIS en gastos (crédito fiscal)', fmt(data.taxExpenses ?? 0), width, 1)
  y -= 8

  // Net
  const netColor = data.netIncome >= 0 ? GREEN : RED
  page.drawRectangle({ x: 40, y: y - 6, width: width - 80, height: 30, color: BRAND })
  page.drawText('UTILIDAD / PÉRDIDA NETA:', { x: 48, y: y + 6, size: 11, font: bold, color: WHITE })
  const netLabel = (data.netIncome >= 0 ? '+' : '') + fmt(data.netIncome)
  page.drawText(netLabel, { x: width - 190, y: y + 6, size: 12, font: bold, color: WHITE })
  y -= 50

  // Margin indicators
  if (data.grossRevenue > 0) {
    const margin = data.netIncome / data.grossRevenue
    const marginColor = margin >= 0 ? GREEN : RED
    page.drawText('Indicadores de desempeño', { x: 40, y, size: 9, font: bold, color: GRAY }); y -= 18
    y = dataRow(page, regular, bold, y, 'Margen neto sobre ingresos brutos', pct(margin), width, 0, marginColor)
    const taxEffective = data.grossRevenue > 0 ? data.taxRevenue / data.grossRevenue : 0
    y = dataRow(page, regular, bold, y, 'ITBIS efectivo sobre ingresos', pct(taxEffective), width, 1)
  }

  await buildFooter(doc, page)
  return doc.save()
}

// ── Balance Sheet ─────────────────────────────────────────────────────────

export async function generateBalancePdf(data: any, businessUnit?: string): Promise<Uint8Array> {
  const doc  = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const { width, height } = page.getSize()

  const buLabel = businessUnit ? ` — ${businessUnit}` : ' — Consolidado'
  const { bold, regular } = await buildHeader(doc, page, 'BALANCE GENERAL', `Al ${nowLabel()}${buLabel}`)

  let y = height - 105

  // Assets
  y = sectionHeader(page, bold, y, 'ACTIVOS', width)
  y = dataRow(page, regular, bold, y, 'Efectivo y equivalentes (bancos)', fmt(data.assets?.cash ?? 0), width, 0)
  y = dataRow(page, regular, bold, y, 'Cuentas por cobrar', fmt(data.assets?.accountsReceivable ?? 0), width, 1)
  y -= 8
  page.drawRectangle({ x: 250, y: y - 4, width: width - 290, height: 20, color: LIGHT })
  page.drawText('Total Activos:', { x: 48, y, size: 10, font: bold, color: BLACK })
  page.drawText(fmt(data.assets?.total ?? 0), { x: width - 180, y, size: 10, font: bold, color: GREEN })
  y -= 34

  // Equity / patrimonio
  y = sectionHeader(page, bold, y, 'PATRIMONIO', width)
  const equityColor = (data.equity ?? 0) >= 0 ? GREEN : RED
  y = dataRow(page, regular, bold, y, 'Patrimonio neto (ingresos − gastos)', fmt(data.equity ?? 0), width, 0, equityColor)

  await buildFooter(doc, page)
  return doc.save()
}

// ── Cash Flow ─────────────────────────────────────────────────────────────

export async function generateCashFlowPdf(data: any, period: string, businessUnit?: string): Promise<Uint8Array> {
  const doc  = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const { width, height } = page.getSize()

  const buLabel = businessUnit ? ` — ${businessUnit}` : ' — Consolidado'
  const { bold, regular } = await buildHeader(doc, page, 'FLUJO DE CAJA', `${periodLabel(period)}${buLabel}`)

  let y = height - 105

  // Summary boxes
  page.drawRectangle({ x: 40, y: y - 50, width: (width - 100) / 3, height: 55, color: LIGHT })
  page.drawText('Entradas', { x: 55, y: y - 14, size: 9, font: bold, color: GRAY })
  page.drawText(fmt(data.totalInflows), { x: 55, y: y - 30, size: 11, font: bold, color: GREEN })

  const midX = 40 + (width - 100) / 3 + 10
  page.drawRectangle({ x: midX, y: y - 50, width: (width - 100) / 3, height: 55, color: LIGHT })
  page.drawText('Salidas', { x: midX + 10, y: y - 14, size: 9, font: bold, color: GRAY })
  page.drawText(fmt(data.totalOutflows), { x: midX + 10, y: y - 30, size: 11, font: bold, color: RED })

  const lastX = midX + (width - 100) / 3 + 10
  const netColor = data.netCashFlow >= 0 ? GREEN : RED
  page.drawRectangle({ x: lastX, y: y - 50, width: (width - 100) / 3, height: 55, color: BRAND })
  page.drawText('Flujo Neto', { x: lastX + 10, y: y - 14, size: 9, font: bold, color: WHITE })
  page.drawText(fmt(data.netCashFlow), { x: lastX + 10, y: y - 30, size: 11, font: bold, color: WHITE })

  y -= 68

  // Inflows detail
  if (data.inflows?.length > 0) {
    y = sectionHeader(page, bold, y, `ENTRADAS (${data.inflows.length} cobros)`, width)
    const shown = data.inflows.slice(0, 20)
    for (let i = 0; i < shown.length; i++) {
      const inflow = shown[i]
      const dateStr = new Date(inflow.paidAt).toLocaleDateString('es-DO')
      y = dataRow(page, regular, bold, y, `${dateStr}  ·  ${inflow.method ?? ''}`, fmt(inflow.amount), width, i)
      if (y < 120) break
    }
    y -= 8
  }

  // Outflows detail
  if (data.outflows?.length > 0 && y > 180) {
    y = sectionHeader(page, bold, y, `SALIDAS (${data.outflows.length} pagos)`, width)
    const shown = data.outflows.slice(0, 20)
    for (let i = 0; i < shown.length; i++) {
      const outflow = shown[i]
      const dateStr = new Date(outflow.paidAt).toLocaleDateString('es-DO')
      y = dataRow(page, regular, bold, y, `${dateStr}  ·  ${outflow.category ?? ''}`, `(${fmt(outflow.total)})`, width, i, RED)
      if (y < 80) break
    }
  }

  await buildFooter(doc, page)
  return doc.save()
}

/** Save report PDF to disk and return path */
export async function saveReportPdf(
  bytes: Uint8Array,
  type: 'pnl' | 'balance' | 'cashflow',
  period: string,
  businessUnit?: string
): Promise<string> {
  const buSuffix = businessUnit ? `_${businessUnit.toLowerCase()}` : '_consolidado'
  const filename = `reporte_${type}${buSuffix}_${period.replace('-', '')}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`
  const dir      = path.join(STORAGE_DIR, 'reportes')
  const filePath = path.join(dir, filename)

  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, bytes)

  return `pdfs/reportes/${filename}`
}
