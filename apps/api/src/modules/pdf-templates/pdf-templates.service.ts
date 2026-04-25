import { prisma } from '../../config/database'
import { AppError, NotFoundError } from '../../middleware/errorHandler'
import { compileTemplate, renderTemplateToPdf } from '../../services/template-renderer.service'
import { PdfTemplateType } from '@prisma/client'

// ── CRUD ──────────────────────────────────────────────────────

export async function listTemplates(type?: PdfTemplateType) {
  return prisma.pdfTemplate.findMany({
    where: type ? { type } : {},
    select: { id: true, type: true, name: true, description: true, isActive: true, createdAt: true, updatedAt: true },
    orderBy: [{ type: 'asc' }, { isActive: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getTemplate(id: string) {
  const t = await prisma.pdfTemplate.findUnique({ where: { id } })
  if (!t) throw new NotFoundError('Plantilla')
  return t
}

export async function createTemplate(data: {
  type: PdfTemplateType
  name: string
  description?: string
  html: string
}) {
  // Validate Handlebars syntax
  try { compileTemplate(data.html) } catch (e: any) {
    throw new AppError(`Sintaxis inválida en la plantilla: ${e.message}`, 400)
  }
  return prisma.pdfTemplate.create({ data })
}

export async function updateTemplate(id: string, data: {
  name?: string
  description?: string
  html?: string
}) {
  const existing = await prisma.pdfTemplate.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Plantilla')

  if (data.html) {
    try { compileTemplate(data.html) } catch (e: any) {
      throw new AppError(`Sintaxis inválida en la plantilla: ${e.message}`, 400)
    }
  }

  return prisma.pdfTemplate.update({ where: { id }, data })
}

export async function deleteTemplate(id: string) {
  const existing = await prisma.pdfTemplate.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Plantilla')
  if (existing.isActive) throw new AppError('No se puede eliminar la plantilla activa. Activa otra primero.', 400)
  return prisma.pdfTemplate.delete({ where: { id } })
}

/** Set a template as the active one for its type (deactivates others of same type) */
export async function activateTemplate(id: string) {
  const template = await prisma.pdfTemplate.findUnique({ where: { id } })
  if (!template) throw new NotFoundError('Plantilla')

  // Deactivate all templates of same type, then activate this one
  await prisma.$transaction([
    prisma.pdfTemplate.updateMany({
      where: { type: template.type },
      data: { isActive: false },
    }),
    prisma.pdfTemplate.update({
      where: { id },
      data: { isActive: true },
    }),
  ])
  return prisma.pdfTemplate.findUnique({ where: { id } })
}

/** Deactivate all templates for a type (revert to built-in) */
export async function deactivateTemplates(type: PdfTemplateType) {
  await prisma.pdfTemplate.updateMany({ where: { type }, data: { isActive: false } })
  return { message: 'Plantillas desactivadas. Se usará la plantilla integrada.' }
}

/** Get the active custom template for a type (null = use built-in) */
export async function getActiveTemplate(type: PdfTemplateType) {
  return prisma.pdfTemplate.findFirst({
    where: { type, isActive: true },
    select: { id: true, html: true, name: true },
  })
}

/** Render a preview PDF with sample data */
export async function previewTemplate(id: string): Promise<Uint8Array> {
  const template = await prisma.pdfTemplate.findUnique({ where: { id } })
  if (!template) throw new NotFoundError('Plantilla')

  const sampleData = getSampleData(template.type)
  return renderTemplateToPdf(template.html, sampleData)
}

// ── Sample data for previews ──────────────────────────────────

function getSampleData(type: PdfTemplateType): object {
  const company = { name: 'HAX ESTUDIO CREATIVO EIRL', rnc: '133-290251', address: 'Santo Domingo, RD' }

  if (type === 'QUOTE') {
    return {
      company,
      quote: {
        number: 'COT-H-00001',
        status: 'BORRADOR',
        createdAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
        businessUnit: 'HAX',
        notes: 'Gracias por solicitar nuestra cotización.',
        terms: 'Válida por 30 días. Precios sujetos a cambio sin previo aviso.',
      },
      client: { name: 'Empresa Ejemplo SRL', rnc: '1-31-12345-6', email: 'info@ejemplo.com', phone: '809-555-0100' },
      items: [
        { description: 'Diseño de identidad visual', quantity: 1, unitPrice: 5000, taxRate: 0.18, taxAmount: 900, total: 5900, isExempt: false },
        { description: 'Desarrollo web — landing page', quantity: 1, unitPrice: 5000, taxRate: 0.18, taxAmount: 900, total: 5900, isExempt: false },
      ],
      isAccepted: false,
      isRejected: false,
      isConverted: false,
      generatedAt: new Date().toLocaleDateString('es-DO'),
    }
  }

  if (type === 'INVOICE' || type === 'CREDIT_NOTE') {
    return {
      company,
      invoice: {
        number: 'INV-0001',
        ncf: 'E310000000001',
        type: type === 'CREDIT_NOTE' ? 'NOTA DE CRÉDITO' : 'FACTURA DE CRÉDITO FISCAL',
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        subtotal: 10000,
        taxAmount: 1800,
        total: 11800,
        amountPaid: 0,
        amountDue: 11800,
        status: 'APPROVED',
        paymentStatus: 'PENDING',
        businessUnit: 'HAX',
        notes: 'Gracias por su preferencia.',
      },
      client: { name: 'Empresa Ejemplo SRL', rnc: '1-31-12345-6', email: 'info@ejemplo.com', address: 'Av. Principal #1, Santo Domingo' },
      items: [
        { description: 'Servicio de diseño gráfico', quantity: 1, unitPrice: 5000, taxRate: 0.18, taxAmount: 900, total: 5900 },
        { description: 'Desarrollo web — landing page', quantity: 1, unitPrice: 5000, taxRate: 0.18, taxAmount: 900, total: 5900 },
      ],
      isApproved: true,
      isCancelled: false,
      isPaid: false,
      originalNcf: type === 'CREDIT_NOTE' ? 'E310000000000' : null,
    }
  }

  if (type === 'PAYROLL_SLIP') {
    return {
      company,
      employee: { name: 'Juan Pérez Martínez', position: 'Diseñador Senior', cedula: '001-1234567-8', type: 'SALARIED' },
      payroll: { period: '2026-04', paidAt: new Date().toISOString(), businessUnit: 'HAX' },
      grossSalary: 60000,
      afpEmployee: 1722,
      sfsEmployee: 1824,
      isr: 0,
      otherDeductions: 0,
      netSalary: 56454,
      afpEmployer: 4260,
      sfsEmployer: 4254,
      sfsRiesgoLaboral: 720,
      totalDeductions: 3546,
      periodLabel: 'Abril 2026',
    }
  }

  if (type === 'REPORT_PNL') {
    return {
      company,
      period: '2026-04',
      periodLabel: 'Abril 2026',
      businessUnit: 'Consolidado',
      grossRevenue: 850000,
      taxRevenue: 153000,
      collectedRevenue: 720000,
      totalExpenses: 320000,
      taxExpenses: 57600,
      netIncome: 530000,
      margin: '62.4%',
      generatedAt: new Date().toLocaleDateString('es-DO'),
    }
  }

  if (type === 'REPORT_BALANCE') {
    return {
      company,
      generatedAt: new Date().toLocaleDateString('es-DO'),
      businessUnit: 'Consolidado',
      assets: { cash: 450000, accountsReceivable: 180000, total: 630000 },
      equity: 310000,
    }
  }

  if (type === 'REPORT_CASHFLOW') {
    return {
      company,
      period: '2026-04',
      periodLabel: 'Abril 2026',
      businessUnit: 'Consolidado',
      totalInflows: 720000,
      totalOutflows: 320000,
      netCashFlow: 400000,
      inflows: [
        { paidAt: new Date().toISOString(), method: 'TRANSFER', amount: 350000 },
        { paidAt: new Date().toISOString(), method: 'TRANSFER', amount: 370000 },
      ],
      outflows: [
        { paidAt: new Date().toISOString(), category: 'GENERAL', total: 200000 },
        { paidAt: new Date().toISOString(), category: 'SALARIES', total: 120000 },
      ],
      generatedAt: new Date().toLocaleDateString('es-DO'),
    }
  }

  return { company }
}
