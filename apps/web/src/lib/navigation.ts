import {
  LayoutDashboard, FileText, Users, Receipt, CreditCard, BarChart3,
  BookOpen, UserCheck, Settings, Truck, Package, Landmark,
  ShoppingCart, RefreshCcw, Monitor, PiggyBank, Layers, ClipboardList,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label:       string
  href:        string
  icon:        LucideIcon
  module:      string   // matches permission key
  badge?:      string
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
      { label: 'Dashboard',   href: '/dashboard',           icon: LayoutDashboard, module: 'dashboard',   description: 'Resumen financiero' },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { label: 'Facturación', href: '/dashboard/invoices',  icon: FileText,        module: 'invoices',    description: 'Facturas electrónicas' },
      { label: 'Clientes',    href: '/dashboard/clients',   icon: Users,           module: 'clients',     description: 'Gestión de clientes' },
      { label: 'Cotizaciones',href: '/dashboard/quotes',    icon: ClipboardList,   module: 'quotes',      description: 'Propuestas y cotizaciones' },
      { label: 'Cobros',      href: '/dashboard/payments',  icon: CreditCard,      module: 'payments',    description: 'Pagos y cobros' },
    ],
  },
  {
    title: 'Compras',
    items: [
      { label: 'Proveedores', href: '/dashboard/suppliers', icon: Truck,           module: 'suppliers',   description: 'Gestión de proveedores' },
      { label: 'Gastos',      href: '/dashboard/expenses',  icon: Receipt,         module: 'expenses',    description: 'Control de gastos' },
      { label: 'Productos',   href: '/dashboard/products',  icon: Package,         module: 'products',    description: 'Productos y servicios' },
    ],
  },
  {
    title: 'Finanzas',
    items: [
      { label: 'Cuentas Bancarias', href: '/dashboard/bank-accounts',      icon: Landmark,  module: 'bank-accounts',       description: 'Cuentas y transacciones' },
      { label: 'Contabilidad',      href: '/dashboard/accounting',          icon: BookOpen,  module: 'accounting',          description: 'Asientos y cuentas' },
      { label: 'Activos Fijos',     href: '/dashboard/fixed-assets',        icon: Layers,    module: 'fixed-assets',        description: 'Depreciación de activos' },
      { label: 'Presupuestos',      href: '/dashboard/budgets',             icon: PiggyBank, module: 'budgets',             description: 'Ejecución presupuestaria' },
      { label: 'Conciliación',      href: '/dashboard/bank-reconciliation', icon: Monitor,   module: 'bank-reconciliation', description: 'Conciliación bancaria' },
      { label: 'Reportes',          href: '/dashboard/reports',             icon: BarChart3, module: 'reports',             description: '606 · 607 · P&L' },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { label: 'Nómina', href: '/dashboard/payroll', icon: UserCheck, module: 'payroll', description: 'Empleados y pagos' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Configuración', href: '/dashboard/settings', icon: Settings, module: 'settings', description: 'Ajustes del sistema' },
    ],
  },
]
