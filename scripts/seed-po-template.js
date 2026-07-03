/**
 * seed-po-template.js
 * Inserts the HAX Bauhaus template for PURCHASE_ORDER directly into the DB.
 * Run: node scripts/seed-po-template.js
 */
'use strict'

process.chdir('/mnt/volume-us-dodso/var/www/erp-hax/apps/api')
process.env.DATABASE_URL = 'postgresql://hax_user:d6NkFj9l4pEsMbnpllOqERCbTvjjwia5@localhost:5432/erp_hax'

const { PrismaClient } = require('/mnt/volume-us-dodso/var/www/erp-hax/apps/api/node_modules/@prisma/client')
const prisma = new PrismaClient()

const LOGO_PATHS = `
  <path fill="rgba(255,255,255,0.35)" d="m1.36,50.21c.62-.29.97-.45,1.04-.5.07-.05.23-.14.47-.29.24-.14.41-.26.5-.36.1-.1.24-.23.43-.39.19-.17.32-.33.39-.5.07-.17.15-.36.25-.57.1-.22.17-.45.22-.72.05-.26.07-.54.07-.82V10.26c0-.67-.24-1.24-.72-1.72-.48-.48-1.05-.72-1.72-.72H0c1-.62,2.81-1.79,5.41-3.51,2.61-1.72,4.63-3.06,6.06-4.02.62-.38,1.26-.39,1.9-.04.65.36.97.9.97,1.61v22.8c.57-.62,1.1-1.16,1.58-1.61.48-.45,1.04-.96,1.69-1.51.65-.55,1.25-1.03,1.83-1.43.57-.41,1.19-.8,1.86-1.18.67-.38,1.34-.69,2.01-.93.67-.24,1.39-.42,2.15-.54.76-.12,1.54-.15,2.33-.11.79.05,1.61.17,2.47.36,2.77.77,4.88,2.38,6.31,4.84,1.43,2.46,2.15,5.41,2.15,8.86v17.14c0,2.68.33,5.28,1,7.82.67,2.53,1.82,4.73,3.44,6.6,1.63,1.86,3.56,2.82,5.81,2.87,1.39.05,2.75-.22,4.09-.79,1.34-.57,2.2-1.32,2.58-2.22.19-.48.1-.99-.29-1.54-.38-.55-.94-1.23-1.69-2.04-.74-.81-1.28-1.55-1.61-2.22-.91-1.67-.87-3.05.11-4.12.98-1.08,2.55-1.66,4.7-1.76,1.53-.05,2.89.26,4.09.93,1.19.67,2,1.65,2.4,2.94s.08,2.87-.97,4.73c-1.58,2.77-4.15,4.72-7.71,5.84-3.56,1.12-7.33,1.21-11.3.25-2.25-.53-4.24-1.5-5.99-2.9-1.75-1.41-3.11-2.93-4.09-4.55-.98-1.63-1.79-3.43-2.44-5.41-.65-1.98-1.09-3.66-1.33-5.02-.24-1.36-.38-2.69-.43-3.98v-14.06c0-5.5-1.24-8.72-3.73-9.68-.62-.24-1.25-.35-1.9-.32-.65.02-1.22.08-1.72.18-.5.1-1.09.35-1.76.75-.67.41-1.18.74-1.54,1-.36.26-.88.72-1.58,1.36-.69.65-1.14,1.06-1.33,1.25-.19.19-.6.62-1.22,1.29v20.3c0,.29.01.56.04.82.02.26.1.5.22.72.12.22.22.41.29.57.07.17.2.33.39.5.19.17.32.3.39.39.07.1.24.22.5.36.26.14.43.24.5.29.07.05.25.14.54.29s.45.22.5.22H1.36Z"/>
  <path fill="rgba(255,255,255,0.35)" d="m75.08,45.91c0,.29.02.55.07.79.05.24.1.45.14.65.05.19.13.38.25.57.12.19.22.35.29.47.07.12.2.25.39.39.19.14.33.26.43.36.1.1.25.2.47.32.22.12.36.19.43.22.07.02.23.1.47.22.24.12.41.2.5.25h-8.89c-1.15,0-2.13-.42-2.94-1.25-.81-.84-1.22-1.83-1.22-2.98v-2.08c-4.02,4.21-8.01,6.31-11.98,6.31-3.54,0-6.61-1.19-9.22-3.59-2.61-2.39-3.88-5.09-3.84-8.1.05-1.96.6-3.56,1.65-4.8,1.05-1.24,2.39-2.1,4.02-2.58,1.53-.48,4.37-.86,8.53-1.15,4.16-.29,6.96-.81,8.39-1.58,1.43-.81,2.21-1.86,2.33-3.16.12-1.29-.39-2.46-1.54-3.51-1-.91-2.31-1.58-3.91-2.01-1.6-.43-3.07-.55-4.41-.36,2.39-.91,4.74-1.22,7.06-.93,2.32.29,4.41.93,6.27,1.94,1.86,1,3.37,2.51,4.52,4.52s1.72,4.28,1.72,6.81v14.27Zm8.03-21.59c-1.77-3.2-4.54-5.58-8.32-7.14-3.78-1.55-7.67-2.16-11.69-1.83-2.92.29-5.32,1.22-7.21,2.8-1.89,1.58-2.86,3.68-2.9,6.31,0,1.15-.38,2.14-1.15,2.98-.76.84-1.7,1.26-2.8,1.26-1.34,0-2.27-.57-2.8-1.72-.53-1.15-.48-2.32.14-3.51.62-1.48,1.74-2.86,3.37-4.12,1.62-1.27,3.56-2.32,5.81-3.16,2.25-.84,4.68-1.45,7.31-1.83,2.39-.38,4.86-.59,7.42-.61,2.56-.02,5.21.13,7.96.47,2.75.33,5.24,1.08,7.46,2.22,2.22,1.15,3.84,2.65,4.84,4.52.38.72.79,1.48,1.22,2.29.43.81.91,1.71,1.43,2.65.53.96.94,1.72,1.22,2.29.48.86.81,1.51,1,1.94,2.2-3.01,3.85-5.26,4.95-6.74.43-.53.63-1.04.61-1.54-.03-.5-.28-1.16-.75-1.97-.67-1.15-1.17-2.01-1.51-2.58h6.88c-1.1,1.48-2.75,3.69-4.95,6.63-2.2,2.94-3.85,5.15-4.95,6.63,3.16,5.79,6.41,11.76,9.75,17.93.48.91,1.24,1.36,2.29,1.36h.22v.29h-12.91v-.29h.22c.33,0,.59-.14.75-.43.17-.29.18-.57.04-.86-.72-1.29-1.77-3.24-3.16-5.84-1.39-2.61-2.44-4.58-3.16-5.92-.57.81-1.46,2.02-2.65,3.62-1.2,1.6-2.08,2.79-2.65,3.55-.43.57-.63,1.11-.61,1.61s.27,1.16.75,1.97c.53.86,1.03,1.72,1.51,2.58h-6.88c1.24-1.67,3.02-4.05,5.34-7.14,2.32-3.08,3.98-5.29,4.98-6.63-2.34-4.4-4.11-7.7-5.31-9.9-.14-.29-.36-.68-.65-1.18s-.45-.82-.5-.97Zm-17.64,2.51c-.57,1.24-1.5,2.28-2.76,3.12-1.27.84-2.58,1.48-3.94,1.94-1.36.45-2.7.94-4.02,1.47-1.32.53-2.41,1.22-3.3,2.08-.88.86-1.4,1.94-1.54,3.23-.24,2.73.51,5.02,2.26,6.88,1.74,1.86,3.91,2.51,6.49,1.94,1.96-.43,4.23-2.01,6.81-4.73v-15.92Z"/>
`

const LOGO_SVG_DARK = `
  <path fill="#17394f" stroke-width="0" d="m1.36,50.21c.62-.29.97-.45,1.04-.5.07-.05.23-.14.47-.29.24-.14.41-.26.5-.36.1-.1.24-.23.43-.39.19-.17.32-.33.39-.5.07-.17.15-.36.25-.57.1-.22.17-.45.22-.72.05-.26.07-.54.07-.82V10.26c0-.67-.24-1.24-.72-1.72-.48-.48-1.05-.72-1.72-.72H0c1-.62,2.81-1.79,5.41-3.51,2.61-1.72,4.63-3.06,6.06-4.02.62-.38,1.26-.39,1.9-.04.65.36.97.9.97,1.61v22.8c.57-.62,1.1-1.16,1.58-1.61.48-.45,1.04-.96,1.69-1.51.65-.55,1.25-1.03,1.83-1.43.57-.41,1.19-.8,1.86-1.18.67-.38,1.34-.69,2.01-.93.67-.24,1.39-.42,2.15-.54.76-.12,1.54-.15,2.33-.11.79.05,1.61.17,2.47.36,2.77.77,4.88,2.38,6.31,4.84,1.43,2.46,2.15,5.41,2.15,8.86v17.14c0,2.68.33,5.28,1,7.82.67,2.53,1.82,4.73,3.44,6.6,1.63,1.86,3.56,2.82,5.81,2.87,1.39.05,2.75-.22,4.09-.79,1.34-.57,2.2-1.32,2.58-2.22.19-.48.1-.99-.29-1.54-.38-.55-.94-1.23-1.69-2.04-.74-.81-1.28-1.55-1.61-2.22-.91-1.67-.87-3.05.11-4.12.98-1.08,2.55-1.66,4.7-1.76,1.53-.05,2.89.26,4.09.93,1.19.67,2,1.65,2.4,2.94s.08,2.87-.97,4.73c-1.58,2.77-4.15,4.72-7.71,5.84-3.56,1.12-7.33,1.21-11.3.25-2.25-.53-4.24-1.5-5.99-2.9-1.75-1.41-3.11-2.93-4.09-4.55-.98-1.63-1.79-3.43-2.44-5.41-.65-1.98-1.09-3.66-1.33-5.02-.24-1.36-.38-2.69-.43-3.98v-14.06c0-5.5-1.24-8.72-3.73-9.68-.62-.24-1.25-.35-1.9-.32-.65.02-1.22.08-1.72.18-.5.1-1.09.35-1.76.75-.67.41-1.18.74-1.54,1-.36.26-.88.72-1.58,1.36-.69.65-1.14,1.06-1.33,1.25-.19.19-.6.62-1.22,1.29v20.3c0,.29.01.56.04.82.02.26.1.5.22.72.12.22.22.41.29.57.07.17.2.33.39.5.19.17.32.3.39.39.07.1.24.22.5.36.26.14.43.24.5.29.07.05.25.14.54.29s.45.22.5.22H1.36Z"/>
  <path fill="#17394f" stroke-width="0" d="m75.08,45.91c0,.29.02.55.07.79.05.24.1.45.14.65.05.19.13.38.25.57.12.19.22.35.29.47.07.12.2.25.39.39.19.14.33.26.43.36.1.1.25.2.47.32.22.12.36.19.43.22.07.02.23.1.47.22.24.12.41.2.5.25h-8.89c-1.15,0-2.13-.42-2.94-1.25-.81-.84-1.22-1.83-1.22-2.98v-2.08c-4.02,4.21-8.01,6.31-11.98,6.31-3.54,0-6.61-1.19-9.22-3.59-2.61-2.39-3.88-5.09-3.84-8.1.05-1.96.6-3.56,1.65-4.8,1.05-1.24,2.39-2.1,4.02-2.58,1.53-.48,4.37-.86,8.53-1.15,4.16-.29,6.96-.81,8.39-1.58,1.43-.81,2.21-1.86,2.33-3.16.12-1.29-.39-2.46-1.54-3.51-1-.91-2.31-1.58-3.91-2.01-1.6-.43-3.07-.55-4.41-.36,2.39-.91,4.74-1.22,7.06-.93,2.32.29,4.41.93,6.27,1.94,1.86,1,3.37,2.51,4.52,4.52s1.72,4.28,1.72,6.81v14.27Zm8.03-21.59c-1.77-3.2-4.54-5.58-8.32-7.14-3.78-1.55-7.67-2.16-11.69-1.83-2.92.29-5.32,1.22-7.21,2.8-1.89,1.58-2.86,3.68-2.9,6.31,0,1.15-.38,2.14-1.15,2.98-.76.84-1.7,1.26-2.8,1.26-1.34,0-2.27-.57-2.8-1.72-.53-1.15-.48-2.32.14-3.51.62-1.48,1.74-2.86,3.37-4.12,1.62-1.27,3.56-2.32,5.81-3.16,2.25-.84,4.68-1.45,7.31-1.83,2.39-.38,4.86-.59,7.42-.61,2.56-.02,5.21.13,7.96.47,2.75.33,5.24,1.08,7.46,2.22,2.22,1.15,3.84,2.65,4.84,4.52.38.72.79,1.48,1.22,2.29.43.81.91,1.71,1.43,2.65.53.96.94,1.72,1.22,2.29.48.86.81,1.51,1,1.94,2.2-3.01,3.85-5.26,4.95-6.74.43-.53.63-1.04.61-1.54-.03-.5-.28-1.16-.75-1.97-.67-1.15-1.17-2.01-1.51-2.58h6.88c-1.1,1.48-2.75,3.69-4.95,6.63-2.2,2.94-3.85,5.15-4.95,6.63,3.16,5.79,6.41,11.76,9.75,17.93.48.91,1.24,1.36,2.29,1.36h.22v.29h-12.91v-.29h.22c.33,0,.59-.14.75-.43.17-.29.18-.57.04-.86-.72-1.29-1.77-3.24-3.16-5.84-1.39-2.61-2.44-4.58-3.16-5.92-.57.81-1.46,2.02-2.65,3.62-1.2,1.6-2.08,2.79-2.65,3.55-.43.57-.63,1.11-.61,1.61s.27,1.16.75,1.97c.53.86,1.03,1.72,1.51,2.58h-6.88c1.24-1.67,3.02-4.05,5.34-7.14,2.32-3.08,3.98-5.29,4.98-6.63-2.34-4.4-4.11-7.7-5.31-9.9-.14-.29-.36-.68-.65-1.18s-.45-.82-.5-.97Zm-17.64,2.51c-.57,1.24-1.5,2.28-2.76,3.12-1.27.84-2.58,1.48-3.94,1.94-1.36.45-2.7.94-4.02,1.47-1.32.53-2.41,1.22-3.3,2.08-.88.86-1.4,1.94-1.54,3.23-.24,2.73.51,5.02,2.26,6.88,1.74,1.86,3.91,2.51,6.49,1.94,1.96-.43,4.23-2.01,6.81-4.73v-15.92Z"/>
`

const PO_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Orden de Compra {{po.number}} — HAX Estudio Creativo</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 8.5in 11in; margin: 0; }
    body { font-family: 'Inter', sans-serif; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .inv { background: #fff; width: 8.5in; min-height: 11in; position: relative; overflow: hidden; display: flex; flex-direction: column; }
    .inv-watermark { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 96px; font-weight: 700; letter-spacing: 0.08em; pointer-events: none; z-index: 100; white-space: nowrap; opacity: 0.07; }
    {{#if isCancelled}}.inv-watermark { display: block; color: #991b1b; }{{/if}}
    .inv-header { padding: 32px 40px 28px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #17394f; }
    .inv-logo svg { width: 140px; height: auto; display: block; }
    .inv-logo-meta { font-size: 10px; color: #64748b; margin-top: 10px; line-height: 1.85; }
    .inv-logo-meta strong { color: #17394f; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; display: block; margin-bottom: 2px; }
    .inv-logo-meta span { display: block; }
    .inv-doc { text-align: right; }
    .inv-doc-type { font-size: 9.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; margin-top: 4px; }
    .inv-ncf { font-size: 26px; font-weight: 700; color: #17394f; letter-spacing: -0.5px; line-height: 1.1; margin-top: 3px; }
    .inv-num { font-size: 11px; color: #64748b; margin-bottom: 2px; }
    .inv-badge { display: inline-block; padding: 3px 10px; border-radius: 3px; font-size: 9.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 6px; }
    .badge-draft     { background: #f1f5f9; color: #64748b; }
    .badge-sent      { background: #dbeafe; color: #1d4ed8; }
    .badge-confirmed { background: #fef9c3; color: #854d0e; }
    .badge-received  { background: #dcfce7; color: #15803d; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
    .badge-credit    { background: #f5f3ff; color: #6d28d9; }
    .inv-client { padding: 0 40px; border-bottom: 1px solid #e5e7eb; }
    .inv-client-inner { display: grid; grid-template-columns: 1fr 1px 220px; }
    .inv-cl-left  { padding: 24px 32px 24px 0; }
    .inv-cl-divider { background: #e5e7eb; margin: 16px 0; }
    .inv-cl-right { padding: 24px 0 24px 32px; display: flex; flex-direction: column; justify-content: space-between; }
    .lbl { font-size: 9px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; margin-bottom: 7px; display: block; }
    .inv-cl-name { font-size: 14px; font-weight: 600; color: #0f172a; line-height: 1.35; }
    .inv-cl-sub { font-size: 11px; color: #64748b; margin-top: 3px; }
    .inv-date-row { display: flex; justify-content: space-between; align-items: baseline; }
    .inv-date-lbl { font-size: 11px; color: #94a3b8; }
    .inv-date-val { font-size: 13px; font-weight: 500; color: #0f172a; }
    .mt-10 { margin-top: 10px; }
    .credit-band { background: #f5f3ff; border-left: 3px solid #7c3aed; padding: 10px 40px; display: flex; align-items: center; gap: 24px; border-bottom: 1px solid #e5e7eb; }
    .credit-band .cb-lbl { font-size: 9px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #7c3aed; }
    .credit-band .cb-val { font-size: 12px; font-weight: 600; color: #4c1d95; margin-top: 2px; }
    .inv-items-head { background: #f8fafc; padding: 10px 40px; display: grid; grid-template-columns: 1fr 52px 108px 108px 108px; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
    .inv-items-head span { font-size: 9.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #94a3b8; }
    .inv-items-head span:not(:first-child) { text-align: right; }
    .inv-row { padding: 12px 40px; display: grid; grid-template-columns: 1fr 52px 108px 108px 108px; border-bottom: 1px solid #f1f5f9; align-items: center; }
    .inv-row:nth-child(odd) { background: #fafbfc; }
    .inv-row:last-child { border-bottom: none; }
    .inv-row-desc { font-size: 12.5px; font-weight: 500; color: #0f172a; }
    .inv-row-exempt { font-size: 10px; color: #15803d; font-weight: 500; margin-top: 2px; }
    .inv-row-qty   { font-size: 12.5px; color: #94a3b8; text-align: right; }
    .inv-row-price { font-size: 12.5px; color: #64748b; text-align: right; }
    .inv-row-tax   { font-size: 12.5px; color: #94a3b8; text-align: right; }
    .inv-row-tax-exempt { font-size: 11px; color: #15803d; text-align: right; font-weight: 500; }
    .inv-row-total { font-size: 13px; font-weight: 600; color: #17394f; text-align: right; }
    .inv-totals-wrap { display: flex; justify-content: flex-end; padding: 20px 40px 0; }
    .inv-totals { width: 270px; }
    .inv-tot-row  { display: flex; justify-content: space-between; font-size: 12.5px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; }
    .inv-tot-due  { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; color: #17394f; padding-top: 12px; border-top: 2px solid #17394f; margin-top: 4px; }
    .inv-notes { padding: 16px 40px 0; border-top: 1px solid #f1f5f9; }
    .inv-notes-text { font-size: 11.5px; color: #64748b; line-height: 1.6; font-style: italic; }
    .inv-footer { background: #17394f; padding: 14px 40px; display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
    .inv-footer-left { font-size: 10px; color: rgba(255,255,255,0.5); }
    .inv-footer-right { display: flex; align-items: center; gap: 8px; }
    .inv-footer-right svg { width: 30px; height: auto; }
    .inv-footer-right span { font-size: 10px; color: rgba(255,255,255,0.5); }
  </style>
</head>
<body>
<div class="inv">

  <div class="inv-watermark">{{#if isCancelled}}CANCELADA{{/if}}</div>

  <div class="inv-header">
    <div class="inv-logo">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 66.5">
        <g>${LOGO_SVG_DARK}</g>
      </svg>
      <div class="inv-logo-meta">
        <strong>{{company.name}}</strong>
        <span>RNC {{company.rnc}}</span>
        {{#if company.address}}<span>{{company.address}}</span>{{/if}}
        {{#if po.businessUnit}}<span>{{po.businessUnit}}</span>{{/if}}
      </div>
    </div>
    <div class="inv-doc">
      <div class="inv-num">No. {{po.number}}</div>
      <div class="inv-ncf">Orden de Compra</div>
      <div class="inv-doc-type">ORDEN DE COMPRA</div>
      {{#ifEq po.status "DRAFT"}}<span class="inv-badge badge-draft">Borrador</span>{{/ifEq}}
      {{#ifEq po.status "BORRADOR"}}<span class="inv-badge badge-draft">Borrador</span>{{/ifEq}}
      {{#ifEq po.status "SENT"}}<span class="inv-badge badge-sent">Enviada</span>{{/ifEq}}
      {{#ifEq po.status "ENVIADA"}}<span class="inv-badge badge-sent">Enviada</span>{{/ifEq}}
      {{#ifEq po.status "CONFIRMED"}}<span class="inv-badge badge-confirmed">Confirmada</span>{{/ifEq}}
      {{#ifEq po.status "CONFIRMADA"}}<span class="inv-badge badge-confirmed">Confirmada</span>{{/ifEq}}
      {{#ifEq po.status "RECEIVED"}}<span class="inv-badge badge-received">Recibida</span>{{/ifEq}}
      {{#ifEq po.status "RECIBIDA"}}<span class="inv-badge badge-received">Recibida</span>{{/ifEq}}
      {{#ifEq po.status "CANCELLED"}}<span class="inv-badge badge-cancelled">Cancelada</span>{{/ifEq}}
      {{#ifEq po.status "CANCELADA"}}<span class="inv-badge badge-cancelled">Cancelada</span>{{/ifEq}}
      {{#if po.isCredit}}<span class="inv-badge badge-credit">Crédito {{po.paymentTerms}}d</span>{{/if}}
    </div>
  </div>

  <div class="inv-client">
    <div class="inv-client-inner">
      <div class="inv-cl-left">
        <span class="lbl">Proveedor</span>
        <div class="inv-cl-name">{{supplier.name}}</div>
        {{#if supplier.rnc}}<div class="inv-cl-sub">RNC {{supplier.rnc}}</div>{{/if}}
        {{#if supplier.email}}<div class="inv-cl-sub">{{supplier.email}}</div>{{/if}}
        {{#if supplier.phone}}<div class="inv-cl-sub">{{supplier.phone}}</div>{{/if}}
      </div>
      <div class="inv-cl-divider"></div>
      <div class="inv-cl-right">
        <div>
          <div class="inv-date-row">
            <span class="inv-date-lbl">Fecha</span>
            <span class="inv-date-val">{{dateShort po.createdAt}}</span>
          </div>
          {{#if po.isCredit}}
          {{#if po.dueDate}}
          <div class="inv-date-row mt-10">
            <span class="inv-date-lbl">Vence</span>
            <span class="inv-date-val">{{dateShort po.dueDate}}</span>
          </div>
          {{/if}}
          {{/if}}
        </div>
      </div>
    </div>
  </div>

  {{#if po.isCredit}}
  <div class="credit-band">
    <div>
      <div class="cb-lbl">Tipo de pago</div>
      <div class="cb-val">Compra a crédito — {{po.paymentTerms}} días</div>
    </div>
    {{#if po.dueDate}}
    <div>
      <div class="cb-lbl">Fecha límite de pago</div>
      <div class="cb-val">{{date po.dueDate}}</div>
    </div>
    {{/if}}
  </div>
  {{/if}}

  <div class="inv-items-head">
    <span>Descripción</span>
    <span>Cant.</span>
    <span>P. Unit.</span>
    <span>ITBIS</span>
    <span>Total</span>
  </div>

  {{#each items}}
  <div class="inv-row">
    <div>
      <div class="inv-row-desc">{{description}}</div>
      {{#if isExempt}}<div class="inv-row-exempt">✓ Exento de ITBIS</div>{{/if}}
    </div>
    <div class="inv-row-qty">{{num quantity}}</div>
    <div class="inv-row-price">{{fmt unitPrice}}</div>
    <div>
      {{#if isExempt}}
        <div class="inv-row-tax-exempt">Exento</div>
      {{else}}
        <div class="inv-row-tax">{{fmt taxAmount}}</div>
      {{/if}}
    </div>
    <div class="inv-row-total">{{fmt total}}</div>
  </div>
  {{/each}}

  <div class="inv-totals-wrap">
    <div class="inv-totals">
      <div class="inv-tot-row"><span>Subtotal</span><span>{{fmt po.subtotal}}</span></div>
      <div class="inv-tot-row"><span>ITBIS</span><span>{{fmt po.taxAmount}}</span></div>
      <div class="inv-tot-due"><span>Total</span><span>{{fmt po.total}}</span></div>
    </div>
  </div>

  {{#if po.notes}}
  <div class="inv-notes" style="margin-top:16px;">
    <span class="lbl">Notas</span>
    <div class="inv-notes-text">{{po.notes}}</div>
  </div>
  {{/if}}

  <div class="inv-footer">
    <div class="inv-footer-left">Documento interno — no es un comprobante fiscal. Generado el {{generatedAt}}.</div>
    <div class="inv-footer-right">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 66.5">
        ${LOGO_PATHS}
      </svg>
      <span>hax.com.do</span>
    </div>
  </div>

</div>
</body></html>`

async function main() {
  console.log('📄  Upserting PURCHASE_ORDER template...')

  await prisma.pdfTemplate.updateMany({
    where: { type: 'PURCHASE_ORDER' },
    data: { isActive: false },
  })

  const created = await prisma.pdfTemplate.create({
    data: {
      type: 'PURCHASE_ORDER',
      name: 'HAX Bauhaus — Orden de Compra',
      description: 'Diseño Bauhaus Precision — misma familia visual que Facturas y Cotizaciones',
      html: PO_HTML,
      isActive: true,
    },
  })

  console.log(`✅ Creada y activada: ${created.id}`)
  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
