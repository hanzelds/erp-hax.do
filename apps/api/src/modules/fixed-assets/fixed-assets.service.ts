import { prisma } from '../../config/database'
import { NotFoundError, AppError } from '../../middleware/errorHandler'
import { parsePagination } from '../../utils/response'

async function autoJournalEntry(opts: {
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE'
  businessUnit: 'HAX' | 'KODER'
  description: string
  debitCode: string
  creditCode: string
  amount: number
  period: string
}) {
  if (opts.amount <= 0) return null
  const [debit, credit] = await Promise.all([
    prisma.account.findUnique({ where: { code: opts.debitCode } }),
    prisma.account.findUnique({ where: { code: opts.creditCode } }),
  ])
  if (!debit || !credit) return null
  return prisma.journalEntry.create({
    data: {
      type: opts.type,
      businessUnit: opts.businessUnit as any,
      description: opts.description,
      debitAccountId: debit.id,
      creditAccountId: credit.id,
      amount: opts.amount,
      period: opts.period,
    },
  })
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function dateToPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function listFixedAssets(query: any) {
  const { page, limit, skip } = parsePagination(query)
  const where: any = {}
  if (query.businessUnit) where.businessUnit = query.businessUnit
  if (query.status) where.status = query.status
  if (query.category) where.category = query.category

  const [data, total] = await Promise.all([
    prisma.fixedAsset.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { depreciationEntries: true } },
      },
    }),
    prisma.fixedAsset.count({ where }),
  ])

  return { data, total, page, limit }
}

export async function getFixedAsset(id: string) {
  const asset = await prisma.fixedAsset.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      depreciationEntries: { orderBy: { period: 'desc' } },
    },
  })
  if (!asset) throw new NotFoundError('Activo fijo')
  return asset
}

export async function createFixedAsset(data: any) {
  const asset = await prisma.fixedAsset.create({
    data: {
      name: data.name,
      category: data.category,
      businessUnit: data.businessUnit,
      purchaseDate: new Date(data.purchaseDate),
      purchaseValue: data.purchaseValue,
      usefulLifeMonths: data.usefulLifeMonths,
      salvageValue: data.salvageValue ?? 0,
      accumulatedDepreciation: 0,
      bookValue: data.purchaseValue,
      status: 'ACTIVE',
      supplierId: data.supplierId,
      ncfCompra: data.ncfCompra,
      notes: data.notes,
    },
  })

  // Journal entry: Dr 1301 Activos fijos / Cr 2101 CxP proveedores
  const period = dateToPeriod(new Date(data.purchaseDate))
  await autoJournalEntry({
    type: 'INVOICE',
    businessUnit: data.businessUnit as 'HAX' | 'KODER',
    description: `Adquisición activo fijo: ${data.name}`,
    debitCode: '1301',
    creditCode: '2101',
    amount: data.purchaseValue,
    period,
  })

  return asset
}

export async function updateFixedAsset(id: string, data: any) {
  const asset = await prisma.fixedAsset.findUnique({ where: { id } })
  if (!asset) throw new NotFoundError('Activo fijo')
  if (asset.status === 'RETIRED') throw new AppError('No se puede editar un activo retirado', 400)

  const updateData: any = {}
  const allowedFields = ['name', 'category', 'notes', 'ncfCompra', 'supplierId', 'usefulLifeMonths', 'salvageValue']
  for (const field of allowedFields) {
    if (data[field] !== undefined) updateData[field] = data[field]
  }

  return prisma.fixedAsset.update({ where: { id }, data: updateData })
}

export async function retireFixedAsset(id: string) {
  const asset = await prisma.fixedAsset.findUnique({ where: { id } })
  if (!asset) throw new NotFoundError('Activo fijo')
  if (asset.status === 'RETIRED') throw new AppError('El activo ya está retirado', 400)

  const period = currentPeriod()

  // Retirement journal entries
  // Dr 1302 Depreciación acumulada (accumulated) / Cr 1301 Activos fijos (purchaseValue)
  // If bookValue > 0, Dr 5101 Gastos operativos (loss) / Cr 1301 (remaining)
  await autoJournalEntry({
    type: 'INVOICE',
    businessUnit: asset.businessUnit as 'HAX' | 'KODER',
    description: `Baja activo fijo: ${asset.name} - depreciación acumulada`,
    debitCode: '1302',
    creditCode: '1301',
    amount: asset.accumulatedDepreciation,
    period,
  })

  if (asset.bookValue > 0) {
    await autoJournalEntry({
      type: 'INVOICE',
      businessUnit: asset.businessUnit as 'HAX' | 'KODER',
      description: `Baja activo fijo: ${asset.name} - valor en libros residual`,
      debitCode: '5101',
      creditCode: '1301',
      amount: asset.bookValue,
      period,
    })
  }

  return prisma.fixedAsset.update({
    where: { id },
    data: { status: 'RETIRED' },
  })
}

/** Dry-run: returns what depreciation would be without writing to DB */
export async function previewDepreciation(assetId?: string) {
  const period = currentPeriod()
  const where: any = { status: 'ACTIVE' }
  if (assetId) where.id = assetId

  const assets = await prisma.fixedAsset.findMany({ where })
  const previews: any[] = []

  for (const asset of assets) {
    const existing = await prisma.depreciationEntry.findFirst({ where: { assetId: asset.id, period } })
    if (existing) {
      previews.push({ assetId: asset.id, name: asset.name, skipped: true, reason: 'Ya depreciado en este período' })
      continue
    }
    const depreciableValue    = asset.purchaseValue - asset.salvageValue
    const monthlyDepreciation = depreciableValue / asset.usefulLifeMonths
    const remaining           = depreciableValue - asset.accumulatedDepreciation
    if (remaining <= 0) {
      previews.push({ assetId: asset.id, name: asset.name, skipped: true, reason: 'Totalmente depreciado' })
      continue
    }
    const amount = Math.min(monthlyDepreciation, remaining)
    previews.push({
      assetId: asset.id, name: asset.name, category: asset.category,
      businessUnit: asset.businessUnit, currentBookValue: asset.bookValue,
      depreciationAmount: amount, newBookValue: asset.bookValue - amount, period, skipped: false,
    })
  }

  const totalAmount = previews.filter((p) => !p.skipped).reduce((s, p) => s + p.depreciationAmount, 0)
  return { period, totalAmount, count: previews.filter((p) => !p.skipped).length, previews }
}

export async function calculateDepreciation(assetId?: string) {
  const period = currentPeriod()

  // Find active assets (optionally scoped to one asset)
  const where: any = { status: 'ACTIVE' }
  if (assetId) where.id = assetId

  const assets = await prisma.fixedAsset.findMany({ where })

  const results: any[] = []

  for (const asset of assets) {
    // Check if depreciation already run for this period
    const existing = await prisma.depreciationEntry.findFirst({
      where: { assetId: asset.id, period },
    })
    if (existing) {
      results.push({ assetId: asset.id, name: asset.name, skipped: true, reason: 'Ya depreciado en este período' })
      continue
    }

    // Straight-line depreciation: (purchaseValue - salvageValue) / usefulLifeMonths
    const depreciableValue = asset.purchaseValue - asset.salvageValue
    const monthlyDepreciation = depreciableValue / asset.usefulLifeMonths

    // Don't depreciate below salvage value
    const remainingDepreciable = depreciableValue - asset.accumulatedDepreciation
    if (remainingDepreciable <= 0) {
      results.push({ assetId: asset.id, name: asset.name, skipped: true, reason: 'Totalmente depreciado' })
      continue
    }

    const depreciationAmount = Math.min(monthlyDepreciation, remainingDepreciable)

    // Create journal entry: Dr 5104 Depreciación / Cr 1302 Depreciación acumulada
    const journalEntry = await autoJournalEntry({
      type: 'INVOICE',
      businessUnit: asset.businessUnit as 'HAX' | 'KODER',
      description: `Depreciación mensual: ${asset.name} (${period})`,
      debitCode: '5104',
      creditCode: '1302',
      amount: depreciationAmount,
      period,
    })

    // Create depreciation entry
    const depEntry = await prisma.depreciationEntry.create({
      data: {
        assetId: asset.id,
        period,
        amount: depreciationAmount,
        journalEntryId: journalEntry?.id,
      },
    })

    // Update asset accumulated depreciation and book value
    const newAccumulated = asset.accumulatedDepreciation + depreciationAmount
    const newBookValue = asset.purchaseValue - newAccumulated

    await prisma.fixedAsset.update({
      where: { id: asset.id },
      data: {
        accumulatedDepreciation: newAccumulated,
        bookValue: newBookValue,
      },
    })

    results.push({
      assetId: asset.id,
      name: asset.name,
      period,
      amount: depreciationAmount,
      depreciationEntryId: depEntry.id,
    })
  }

  return { period, processed: results.length, results }
}
