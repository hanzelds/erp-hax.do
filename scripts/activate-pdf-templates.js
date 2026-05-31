/**
 * activate-pdf-templates.js
 * ─────────────────────────
 * Reads template HTML from seed-pdf-templates.js and inserts
 * directly into the DB via Prisma (no API auth needed).
 *
 * Usage: node scripts/activate-pdf-templates.js
 */
'use strict'

const path = require('path')
process.chdir(path.join(__dirname, '..', 'apps', 'api'))

const { PrismaClient } = require(path.join(__dirname, '..', 'node_modules', '.prisma', 'client'))
const prisma = new PrismaClient()

// ── Extract templates by requiring the seed script as a pseudo-module ─────────
// We build a wrapper that captures the exported variables
const fs   = require('fs')
const raw  = fs.readFileSync(path.join(__dirname, 'seed-pdf-templates.js'), 'utf8')

// Trim everything after "── HTTP helpers" to remove the main() call
const trimmed = raw.replace(/\/\/ ── HTTP helpers[\s\S]*$/, '\nmodule.exports={INVOICE_HTML,CREDIT_NOTE_HTML,QUOTE_HTML}')

// Write a temp file and require it
const tmp = path.join(__dirname, '_tpl_tmp.js')
fs.writeFileSync(tmp, trimmed)

let templates
try {
  templates = require(tmp)
} finally {
  fs.unlinkSync(tmp)
}

const { INVOICE_HTML, CREDIT_NOTE_HTML, QUOTE_HTML } = templates

if (!INVOICE_HTML || !QUOTE_HTML) {
  console.error('❌  Could not extract templates from seed-pdf-templates.js')
  process.exit(1)
}

async function main() {
  const defs = [
    { type: 'INVOICE',     name: 'HAX Bauhaus — Factura',         html: INVOICE_HTML },
    { type: 'CREDIT_NOTE', name: 'HAX Bauhaus — Nota de Crédito', html: CREDIT_NOTE_HTML },
    { type: 'QUOTE',       name: 'HAX Bauhaus — Cotización',      html: QUOTE_HTML },
  ]

  for (const d of defs) {
    console.log(`📄  ${d.type}...`)
    await prisma.pdfTemplate.updateMany({ where: { type: d.type }, data: { isActive: false } })
    const t = await prisma.pdfTemplate.create({
      data: { type: d.type, name: d.name, html: d.html,
              description: 'Bauhaus Precision — carta 8.5×11 · DM Mono + Instrument Sans + Fraunces',
              isActive: true },
    })
    console.log(`  ✅  Created ${t.id} (active)`)
  }

  console.log('\n🎉  All templates active. Regenerate PDFs to see the new design.')
  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
