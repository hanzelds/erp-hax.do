/**
 * Template Renderer Service
 *
 * Renders an HTML template (Handlebars syntax) + injects data,
 * then converts to PDF via Puppeteer.
 *
 * Variable syntax  : {{variable}}
 * Loops            : {{#each items}} … {{/each}}
 * Conditionals     : {{#if approved}} … {{/if}}
 * Helpers          : {{fmt amount}}  {{date issueDate}}  {{upper name}}
 */

import Handlebars from 'handlebars'
import puppeteer  from 'puppeteer'
import { logger } from '../config/logger'

// ── Handlebars helpers ────────────────────────────────────────

Handlebars.registerHelper('fmt', (n: number) => {
  if (typeof n !== 'number') return n
  return 'RD$ ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
})

Handlebars.registerHelper('date', (d: string | Date) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })
})

Handlebars.registerHelper('dateShort', (d: string | Date) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-DO')
})

Handlebars.registerHelper('upper', (s: string) => (s ?? '').toUpperCase())

Handlebars.registerHelper('pct', (n: number) => {
  if (typeof n !== 'number') return n
  return (n * 100).toFixed(2) + '%'
})

Handlebars.registerHelper('ifEq', function (this: any, a: any, b: any, opts: any) {
  return a === b ? opts.fn(this) : opts.inverse(this)
})

Handlebars.registerHelper('ifNot', function (this: any, v: any, opts: any) {
  return !v ? opts.fn(this) : opts.inverse(this)
})

// ── Renderer ──────────────────────────────────────────────────

let _browser: any = null

async function getBrowser() {
  if (_browser) {
    try { await _browser.pages(); return _browser } catch { _browser = null }
  }
  _browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  return _browser
}

export async function renderTemplateToPdf(html: string, data: object): Promise<Uint8Array> {
  // 1. Compile + inject data
  const compiled = Handlebars.compile(html, { noEscape: false })
  const rendered = compiled(data)

  // 2. Launch Puppeteer and render
  const browser = await getBrowser()
  const page    = await browser.newPage()

  try {
    await page.setContent(rendered, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format:            'A4',
      printBackground:   true,
      margin:            { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return new Uint8Array(pdfBuffer)
  } finally {
    await page.close()
  }
}

/** Compile a template string and return it (validates Handlebars syntax) */
export function compileTemplate(html: string): string {
  Handlebars.compile(html)   // throws if syntax error
  return html
}
