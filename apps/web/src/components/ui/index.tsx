import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

// ── Card ────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-100 shadow-sm',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-5',
        padding === 'lg' && 'p-6',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-gray-900 font-semibold text-sm">{title}</h3>
        {subtitle && (
          <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Stat card ───────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string
  sub?: string
  trend?: { value: string; up: boolean }
  icon?: React.ReactNode
  accent?: string
}

export function StatCard({ label, value, sub, trend, icon, accent }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">
          {label}
        </p>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: accent ? `${accent}15` : '#eef1f4' }}
          >
            <span style={{ color: accent ?? '#293c4f' }}>{icon}</span>
          </div>
        )}
      </div>
      <p className="text-gray-900 text-2xl font-bold tracking-tight">{value}</p>
      <div className="flex items-center gap-2 mt-1.5">
        {trend && (
          <span
            className={cn(
              'text-xs font-medium',
              trend.up ? 'text-green-600' : 'text-red-500'
            )}
          >
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
        {sub && <span className="text-gray-400 text-xs">{sub}</span>}
      </div>
    </div>
  )
}

// ── Badge ───────────────────────────────────────────────────────
type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted'

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger:  'bg-red-100 text-red-600',
  info:    'bg-blue-100 text-blue-700',
  muted:   'bg-gray-50 text-gray-400 border border-gray-200',
}

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

// ── Invoice status badge ────────────────────────────────────────
const invoiceVariants: Record<string, BadgeVariant> = {
  DRAFT:     'muted',
  SENDING:   'info',
  APPROVED:  'success',
  REJECTED:  'danger',
  PAID:      'success',
  CANCELLED: 'warning',
}

const invoiceLabels: Record<string, string> = {
  DRAFT:     'Borrador',
  SENDING:   'Enviando',
  APPROVED:  'Aprobada',
  REJECTED:  'Rechazada',
  PAID:      'Pagada',
  CANCELLED: 'Anulada',
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={invoiceVariants[status] ?? 'default'}>
      {invoiceLabels[status] ?? status}
    </Badge>
  )
}

// ── Skeleton ────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-100 rounded-md',
        className
      )}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-7 w-32 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

// ── Page header ─────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-gray-900 text-xl font-bold">{title}</h1>
        {subtitle && (
          <p className="text-gray-500 text-sm mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── Button ──────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
  asChild?: boolean
}

const buttonBase =
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]'

const buttonVariantStyles: Record<ButtonVariant, string> = {
  primary:   'text-white shadow-sm hover:opacity-90',
  secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
  ghost:     'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  danger:    'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100',
}

const buttonSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-sm px-5 py-2.5',
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  asChild = false,
  className,
  style,
  ...props
}: ButtonProps) {
  const isPrimary = variant === 'primary'
  const Comp = asChild ? Slot : 'button'

  // When asChild, Slot requires exactly one child — render children only
  if (asChild) {
    return (
      <Slot
        className={cn(buttonBase, buttonVariantStyles[variant], buttonSizeStyles[size], className)}
        style={isPrimary ? { backgroundColor: '#293c4f', ...style } : style}
        {...props}
      >
        {children}
      </Slot>
    )
  }

  return (
    <button
      className={cn(buttonBase, buttonVariantStyles[variant], buttonSizeStyles[size], className)}
      style={isPrimary ? { backgroundColor: '#293c4f', ...style } : style}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}

// ── Empty state ─────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
          {icon}
        </div>
      )}
      <p className="text-gray-700 font-medium text-sm">{title}</p>
      {description && (
        <p className="text-gray-400 text-xs mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
