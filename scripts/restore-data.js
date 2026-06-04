'use strict'
const path = require('path')
process.chdir(path.join(__dirname, '..', 'apps', 'api'))
const { PrismaClient } = require(path.join(__dirname, '..', 'node_modules', '.prisma', 'client'))
const p = new PrismaClient()

async function main() {
  console.log('🔄 Restaurando datos de ERP Hax...\n')

  // ── Company Config ────────────────────────────────────
  await p.companyConfig.upsert({
    where: { id: 'main' },
    update: {},
    create: {
      id:          'main',
      companyName: 'HAX ESTUDIO CREATIVO EIRL',
      rnc:         '133290251',
      address:     'Santo Domingo, RD',
    },
  })
  console.log('✅ CompanyConfig restaurado')

  // ── EcfConfig ─────────────────────────────────────────
  await p.ecfConfig.upsert({
    where: { id: 'main' },
    update: {},
    create: {
      id:                  'main',
      legacyNcfEnabled:    true,
      ncfCreditoFiscal:    17,
      ncfConsumidor:       1,
      ncfNotaDebito:       1,
      ncfNotaCredito:      1,
      ncfCompras:          1,
      ncfGastosMenores:    1,
      ncfRegimen:          1,
      ncfGubernamental:    1,
      ncfExportaciones:    1,
      ncfPagosExterior:    1,
      itbisRate:           0.18,
      maxRetroactiveDays:  5,
      autoJournalEntries:  true,
      requireRncB01:       false,
    },
  })
  console.log('✅ EcfConfig restaurado (NCF Crédito Fiscal: B0100000017)')

  // ── Products ──────────────────────────────────────────
  const products = [
    { name: 'PLAN LITE - Personalizado', description: 'Gestión de Redes Sociales enfocado a contenido semanal:\n• 3 publicaciones semanales.\n• 4 stories semanales.\n• 1 reel semanal\n• Visitas necesarias al mes\n• Community Management.\n• Estrategias de cotenido.\n• Segmentación de anuncios.\n• Informes y estadisticas.', unitPrice: 10000, taxRate: 0.18 },
    { name: 'Publicación de Instagram', description: null, unitPrice: 0, taxRate: 0.18 },
    { name: 'Reels', description: null, unitPrice: 0, taxRate: 0.18 },
    { name: 'Plantillas de documentos', description: null, unitPrice: 0, taxRate: 0.18 },
    { name: 'Corrección al manual de identidad', description: null, unitPrice: 6000, taxRate: 0.18 },
    { name: 'Memorias de venta', description: null, unitPrice: 0, taxRate: 0.18 },
    { name: 'Diseño de Dossier inmobiliario', description: null, unitPrice: 0, taxRate: 0.18 },
    { name: 'Diseño de Catálogo', description: null, unitPrice: 0, taxRate: 0.18 },
    { name: 'Gestión de Redes Sociales - Personalizado', description: '10 Publicaciones mensuales en feed\n1 Reel semanal\nHasta 4 stories semanales\nCopywriting publicitario alineado a la marca\nAsesoría y pauta en campañas de promoción\n3 Visitas para creación de contenido (fotos y vídeos)\nReporte trimestral de métricas.', unitPrice: 0, taxRate: 0.18 },
    { name: 'Gestión y asesoria de marca personal', description: '4 Publicaciones mensuales en feed\n1 Reel semanal\nHasta 3 stories semanales\nCopywriting publicitario alineado a la marca\nAsesoría y pauta en campañas de promoción\n2 Visitas para creación de contenido (fotos y vídeos)\nReporte trimestral de métricas', unitPrice: 0, taxRate: 0.18 },
    { name: 'Diseño de valla publicitaria', description: null, unitPrice: 0, taxRate: 0.18 },
    { name: 'Diseño de Flyer', description: null, unitPrice: 0, taxRate: 0.18 },
  ]

  let prodCount = 0
  for (const prod of products) {
    await p.product.upsert({
      where: { code: prod.name.toLowerCase().replace(/\s+/g, '-').slice(0, 40) + '-hax' },
      update: {},
      create: {
        businessUnit: 'HAX',
        code:         prod.name.toLowerCase().replace(/\s+/g, '-').slice(0, 40) + '-hax',
        name:         prod.name,
        description:  prod.description,
        type:         'SERVICE',
        unitPrice:    prod.unitPrice,
        taxRate:      prod.taxRate,
        isExempt:     false,
        isActive:     true,
      },
    })
    prodCount++
  }
  console.log(`✅ ${prodCount} productos restaurados`)

  // ── Clients ────────────────────────────────────────────
  const clients = [
    { name: 'SUMERCA SRL', rnc: '130630242', address: 'La Romana', businessUnit: 'HAX' },
    { name: 'Marcelle Sanchez', rnc: null, address: null, businessUnit: 'HAX' },
  ]

  let clientCount = 0
  for (const c of clients) {
    try {
      await p.client.create({
        data: {
          name:    c.name,
          rnc:     c.rnc,
          address: c.address,
        },
      })
      clientCount++
    } catch (e) {
      console.log(`  ⚠️  Cliente ${c.name} ya existe o error: ${e.message}`)
    }
  }
  console.log(`✅ ${clientCount} clientes restaurados`)

  console.log('\n🎉 Restauración completada.')
  console.log('⚠️  Las facturas e historial de pagos no pudieron recuperarse.')
  console.log('    Deben ser recreadas manualmente.')
  await p.$disconnect()
}

main().catch(async e => {
  console.error('❌', e.message)
  await p.$disconnect()
  process.exit(1)
})
