import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Currency formatter (DOP) ──────────────────────────────────
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ── Date formatters ───────────────────────────────────────────
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDatetime(date: string | Date): string {
  return new Intl.DateTimeFormat('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatPeriod(period: string): string {
  // "2025-01" → "Enero 2025"
  const [year, month] = period.split('-')
  return new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric' })
    .format(new Date(parseInt(year), parseInt(month) - 1))
}

// ── Status labels ─────────────────────────────────────────────
export const invoiceStatusLabel: Record<string, string> = {
  DRAFT:     'Borrador',
  SENDING:   'Enviando',
  APPROVED:  'Aprobada',
  REJECTED:  'Rechazada',
  PAID:      'Pagada',
  CANCELLED: 'Anulada',
}

export const paymentStatusLabel: Record<string, string> = {
  PENDING: 'Pendiente',
  PARTIAL: 'Parcial',
  PAID:    'Pagada',
}

export const businessUnitLabel: Record<string, string> = {
  HAX:   'Hax Estudio',
  KODER: 'Koder',
}

/**
 * Descarga/abre un PDF desde un endpoint autenticado.
 * Usa el token del localStorage para incluirlo en el header Authorization.
 */
export async function openPdf(apiPath: string, filename?: string): Promise<void> {
  const base  = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('hax_token') ?? '')
    : ''

  const res = await fetch(`${base}${apiPath}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json?.error ?? `Error ${res.status}`)
  }

  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.target = '_blank'
  if (filename) a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
