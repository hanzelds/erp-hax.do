import {
  LayoutDashboard,
  FileText,
  Users,
  Receipt,
  CreditCard,
  TrendingUp,
  BarChart3,
  BookOpen,
  UserCheck,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: string
  description?: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: 'Principal',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        description: 'Resumen financiero',
      },
    ],
  },
  {
    title: 'Ventas',
    items: [
      {
        label: 'Facturación',
        href: '/invoices',
        icon: FileText,
        description: 'Facturas electrónicas',
      },
      {
        label: 'Clientes',
        href: '/clients',
        icon: Users,
        description: 'Gestión de clientes',
      },
      {
        label: 'Cobros',
        href: '/payments',
        icon: CreditCard,
        description: 'Pagos y cobros',
      },
      {
        label: 'CRM',
        href: '/crm',
        icon: TrendingUp,
        description: 'Pipeline de ventas',
      },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      {
        label: 'Gastos',
        href: '/expenses',
        icon: Receipt,
        description: 'Control de gastos',
      },
      {
        label: 'Contabilidad',
        href: '/accounting',
        icon: BookOpen,
        description: 'Asientos y cuentas',
      },
      {
        label: 'Reportes',
        href: '/reports',
        icon: BarChart3,
        description: '606 · 607 · P&L',
      },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      {
        label: 'Nómina',
        href: '/payroll',
        icon: UserCheck,
        description: 'Empleados y pagos',
      },
    ],
  },
  {
    title: 'Sistema',
    items: [
      {
        label: 'Configuración',
        href: '/settings',
        icon: Settings,
        description: 'Ajustes del sistema',
      },
    ],
  },
]
