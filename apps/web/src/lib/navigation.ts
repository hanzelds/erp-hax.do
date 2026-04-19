import {
  LayoutDashboard,
  FileText,
  Users,
  Receipt,
  CreditCard,
  BarChart3,
  BookOpen,
  UserCheck,
  Settings,
  Truck,
  Package,
  Landmark,
  ShoppingCart,
  RefreshCcw,
  Monitor,
  PiggyBank,
  Layers,
  ClipboardList,
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
        href: '/dashboard/invoices',
        icon: FileText,
        description: 'Facturas electrónicas',
      },
      {
        label: 'Clientes',
        href: '/dashboard/clients',
        icon: Users,
        description: 'Gestión de clientes',
      },
      {
        label: 'Cotizaciones',
        href: '/dashboard/quotes',
        icon: ClipboardList,
        description: 'Propuestas y cotizaciones',
      },
    ],
  },
  {
    title: 'Compras',
    items: [
      {
        label: 'Proveedores',
        href: '/dashboard/suppliers',
        icon: Truck,
        description: 'Gestión de proveedores',
      },
      {
        label: 'Órdenes de Compra',
        href: '/dashboard/purchase-orders',
        icon: ShoppingCart,
        description: 'Órdenes y recepción',
      },
      {
        label: 'Gastos',
        href: '/dashboard/expenses',
        icon: Receipt,
        description: 'Control de gastos',
      },
    ],
  },
  {
    title: 'Inventario',
    items: [
      {
        label: 'Productos',
        href: '/dashboard/products',
        icon: Package,
        description: 'Productos y servicios',
      },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      {
        label: 'Cuentas Bancarias',
        href: '/dashboard/bank-accounts',
        icon: Landmark,
        description: 'Cuentas y transacciones',
      },
      {
        label: 'Pagos Recurrentes',
        href: '/dashboard/recurring-payments',
        icon: RefreshCcw,
        description: 'Suscripciones y recurrentes',
      },
      {
        label: 'Cobros',
        href: '/dashboard/payments',
        icon: CreditCard,
        description: 'Pagos y cobros',
      },
      {
        label: 'Contabilidad',
        href: '/dashboard/accounting',
        icon: BookOpen,
        description: 'Asientos y cuentas',
      },
      {
        label: 'Activos Fijos',
        href: '/dashboard/fixed-assets',
        icon: Layers,
        description: 'Depreciación de activos',
      },
      {
        label: 'Presupuestos',
        href: '/dashboard/budgets',
        icon: PiggyBank,
        description: 'Ejecución presupuestaria',
      },
      {
        label: 'Conciliación',
        href: '/dashboard/bank-reconciliation',
        icon: Monitor,
        description: 'Conciliación bancaria',
      },
      {
        label: 'Reportes',
        href: '/dashboard/reports',
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
        href: '/dashboard/payroll',
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
        href: '/dashboard/settings',
        icon: Settings,
        description: 'Ajustes del sistema',
      },
    ],
  },
]
