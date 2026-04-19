import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../config/database'
import { logger } from '../config/logger'

const BRAND = rgb(0.161, 0.235, 0.310) // #293C4F
const GRAY  = rgb(0.45,  0.45,  0.45)
const LIGHT = rgb(0.96,  0.97,  0.98)
const WHITE = rgb(1,     1,     1)
const BLACK = rgb(0,     0,     0)
const GREEN = rgb(0.13,  0.55,  0.13)

const STORAGE_DIR = path.resolve(process.cwd(), '../../storage/pdfs')

function fmt(n: number) {
  return 'RD$ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function periodLabel(period: string) {
  const [year, month] = period.split('-')
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${months[parseInt(month) - 1]} ${year}`
}

function drawRow(page: any, x: number, y: number, label: string, value: string,
  bold: any, regular: any, highlight = false, width = 515) {
  if (highlight) {
    page.drawRectangle({ x: x - 8, y: y - 4, width: width - x + 8 + 40, height: 20, color: LIGHT })
  }
  page.drawText(label, { x, y, size: 9, font: regular, color: GRAY })
  page.drawText(value, { x: x + 260, y, size: 9, font: bold, color: BLACK, textAlign: 'right' })
}

export async function generatePayrollSlipPdf(payrollId: string, employeeId: string): Promise<Uint8Array> {
  const item = await prisma.payrollItem.findFirst({
    where: { payrollId, employeeId },
    include: {
      employee: true,
      payroll: true,
    },
  })
  if (!item) throw new Error('Ítem de nómina no encontrado')

  const doc  = await PDFDocument.create()
  const page = doc.addPage([595, 720])
  const { width, height } = page.getSize()

  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  // ── Header ────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: BRAND })
  page.drawText('HAX ESTUDIO CREATIVO EIRL', { x: 40, y: height - 30, size: 13, font: bold, color: WHITE })
  page.drawText('RNC: 133-290251  ·  Santo Domingo, RD', { x: 40, y: height - 47, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9) })

  page.drawText('COMPROBANTE DE NÓMINA', { x: width - 220, y: height - 30, size: 11, font: bold, color: WHITE })
  page.drawText(periodLabel(item.payroll.period), { x: width - 220, y: height - 47, size: 9, font: regular, color: rgb(0.8, 0.85, 0.9) })
  const buLabel = item.payroll.businessUnit === 'HAX' ? 'Hax Estudio' : 'Koder'
  page.drawText(buLabel, { x: width - 220, y: height - 62, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })

  let y = height - 105

  // ── Employee info ─────────────────────────────────────────────
  page.drawText('EMPLEADO', { x: 40, y, size: 8, font: bold, color: GRAY })
  y -= 18
  page.drawText(item.employee.name, { x: 40, y, size: 14, font: bold, color: BLACK })
  y -= 16
  if (item.employee.position) {
    page.drawText(item.employee.position, { x: 40, y, size: 10, font: regular, color: GRAY }); y -= 13
  }
  if (item.employee.cedula) {
    page.drawText(`Cédula: ${item.employee.cedula}`, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 13
  }
  page.drawText(`Tipo: ${item.employee.type === 'SALARIED' ? 'Asalariado' : 'Por hora'}`, { x: 40, y, size: 9, font: regular, color: GRAY }); y -= 24

  // ── Divider ───────────────────────────────────────────────────
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: LIGHT })
  y -= 20

  // ── Earnings section ──────────────────────────────────────────
  page.drawText('INGRESOS', { x: 40, y, size: 9, font: bold, color: BRAND })
  y -= 18
  drawRow(page, 40, y, 'Salario bruto del período', fmt(item.grossSalary), bold, regular, false, width)
  y -= 22

  // ── Deductions section ────────────────────────────────────────
  page.drawText('DEDUCCIONES', { x: 40, y, size: 9, font: bold, color: rgb(0.7, 0.2, 0.2) })
  y -= 18

  const deductions = [
    { label: `AFP (empleado ${(2.87).toFixed(2)}%)`, value: item.afpEmployee, show: item.afpEmployee > 0 },
    { label: `SFS (empleado ${(3.04).toFixed(2)}%)`, value: item.sfsEmployee, show: item.sfsEmployee > 0 },
    { label: 'ISR retenido',                          value: item.isr,        show: item.isr > 0 },
    { label: 'Otras deducciones',                     value: item.otherDeductions, show: item.otherDeductions > 0 },
  ]

  const totalDeductions = item.afpEmployee + item.sfsEmployee + item.isr + item.otherDeductions

  for (const d of deductions) {
    if (!d.show) continue
    drawRow(page, 40, y, d.label, `(${fmt(d.value)})`, bold, regular, false, width)
    y -= 20
  }

  if (totalDeductions > 0) {
    y -= 4
    page.drawLine({ start: { x: 250, y }, end: { x: width - 40, y }, thickness: 0.5, color: LIGHT })
    y -= 14
    page.drawText('Total deducciones:', { x: 40, y, size: 9, font: regular, color: GRAY })
    page.drawText(`(${fmt(totalDeductions)})`, { x: 300, y, size: 9, font: bold, color: rgb(0.7, 0.2, 0.2) })
    y -= 24
  }

  // ── Net salary highlight ──────────────────────────────────────
  page.drawRectangle({ x: 40, y: y - 6, width: width - 80, height: 30, color: BRAND })
  page.drawText('SALARIO NETO A PAGAR:', { x: 48, y: y + 6, size: 11, font: bold, color: WHITE })
  page.drawText(fmt(item.netSalary), { x: width - 160, y: y + 6, size: 13, font: bold, color: WHITE })
  y -= 42

  // ── Employer costs (informational) ───────────────────────────
  if (item.afpEmployer + item.sfsEmployer + item.sfsRiesgoLaboral > 0) {
    page.drawText('CARGAS PATRONALES (referencia)', { x: 40, y, size: 8, font: bold, color: GRAY })
    y -= 16
    const patronal = [
      { label: `AFP (patronal ${(7.10).toFixed(2)}%)`, value: item.afpEmployer },
      { label: `SFS (patronal ${(7.09).toFixed(2)}%)`, value: item.sfsEmployer },
      { label: `Riesgo Laboral ${(1.20).toFixed(2)}%`, value: item.sfsRiesgoLaboral },
    ]
    for (const p of patronal) {
      if (p.value <= 0) continue
      page.drawText(p.label, { x: 40, y, size: 8, font: regular, color: GRAY })
      page.drawText(fmt(p.value), { x: 300, y, size: 8, font: regular, color: GRAY })
      y -= 16
    }
    y -= 8
  }

  // ── Payment info ──────────────────────────────────────────────
  if (item.payroll.paidAt) {
    page.drawText(`Fecha de pago: ${new Date(item.payroll.paidAt).toLocaleDateString('es-DO')}`,
      { x: 40, y, size: 8, font: regular, color: GRAY })
    y -= 14
  }
  page.drawText('Método de pago: Transferencia bancaria', { x: 40, y, size: 8, font: regular, color: GRAY })

  // ── Footer ────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width, height: 38, color: BRAND })
  page.drawText('HAX ESTUDIO CREATIVO EIRL  ·  RNC: 133-290251  ·  erp.hax.com.do',
    { x: 40, y: 20, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText(`Generado el ${new Date().toLocaleDateString('es-DO')}`,
    { x: width - 155, y: 20, size: 8, font: regular, color: rgb(0.8, 0.85, 0.9) })
  page.drawText('Este comprobante no tiene valor fiscal. Solo para efectos informativos.',
    { x: 40, y: 7, size: 7, font: regular, color: rgb(0.6, 0.65, 0.7) })

  return doc.save()
}

/** Generate and persist payroll slip to disk, update PayrollItem record */
export async function generateAndSavePayrollSlip(payrollId: string, employeeId: string): Promise<string | null> {
  try {
    await prisma.payrollItem.updateMany({
      where: { payrollId, employeeId },
      data: { pdfStatus: 'GENERATING' },
    })

    const bytes    = await generatePayrollSlipPdf(payrollId, employeeId)
    const item     = await prisma.payrollItem.findFirst({ where: { payrollId, employeeId }, include: { payroll: true } })
    if (!item) return null

    const filename = `nomina_${employeeId}_${item.payroll.period}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.pdf`
    const dir      = path.join(STORAGE_DIR, 'nomina')
    const filePath = path.join(dir, filename)
    const relPath  = `pdfs/nomina/${filename}`

    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, bytes)

    await prisma.payrollItem.updateMany({
      where: { payrollId, employeeId },
      data: { pdfPath: relPath, pdfGeneratedAt: new Date(), pdfStatus: 'READY' },
    })

    logger.info(`[PDF] Payroll slip ${payrollId}/${employeeId} → ${relPath}`)
    return relPath
  } catch (err: any) {
    logger.error(`[PDF] Payroll slip error ${payrollId}/${employeeId}:`, err.message)
    try {
      await prisma.payrollItem.updateMany({
        where: { payrollId, employeeId },
        data: { pdfStatus: 'ERROR' },
      })
    } catch { /* ignore */ }
    return null
  }
}

/** Generate all slips for a payroll run (called after processPayment) */
export async function generateAllPayrollSlips(payrollId: string): Promise<void> {
  const payroll = await prisma.payroll.findUnique({
    where: { id: payrollId },
    include: { items: { select: { employeeId: true } } },
  })
  if (!payroll) return

  for (const item of payroll.items) {
    try {
      await generateAndSavePayrollSlip(payrollId, item.employeeId)
    } catch (err: any) {
      logger.error(`[PDF] Slip error for employee ${item.employeeId}:`, err.message)
    }
  }
}
