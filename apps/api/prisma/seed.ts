import { PrismaClient, UserRole, AccountType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de ERP Hax...')

  // ─── Admin user ───────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Hax2025!', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'hanzel@hax.com.do' },
    update: {},
    create: {
      name: 'Hanzel De Los Santos',
      email: 'hanzel@hax.com.do',
      password: hashedPassword,
      role: UserRole.ADMIN,
    },
  })
  console.log(`✅ Admin creado: ${admin.email}`)

  // ─── Catálogo de cuentas (Plan de cuentas RD) ─────────
  const accounts = [
    // ACTIVOS
    { code: '1000', name: 'Activos', type: AccountType.ASSET },
    { code: '1100', name: 'Activos Corrientes', type: AccountType.ASSET },
    { code: '1101', name: 'Caja', type: AccountType.ASSET },
    { code: '1102', name: 'Banco', type: AccountType.ASSET },
    { code: '1103', name: 'Cuentas por Cobrar', type: AccountType.ASSET },
    { code: '1104', name: 'ITBIS por Cobrar', type: AccountType.ASSET },
    { code: '1200', name: 'Activos No Corrientes', type: AccountType.ASSET },
    { code: '1201', name: 'Equipos y Mobiliario', type: AccountType.ASSET },

    // PASIVOS
    { code: '2000', name: 'Pasivos', type: AccountType.LIABILITY },
    { code: '2100', name: 'Pasivos Corrientes', type: AccountType.LIABILITY },
    { code: '2101', name: 'Cuentas por Pagar', type: AccountType.LIABILITY },
    { code: '2102', name: 'Cuentas por Pagar Empleados', type: AccountType.LIABILITY },
    { code: '2103', name: 'ITBIS por Pagar', type: AccountType.LIABILITY },
    { code: '2104', name: 'TSS por Pagar', type: AccountType.LIABILITY },
    { code: '2105', name: 'ISR por Pagar', type: AccountType.LIABILITY },

    // PATRIMONIO
    { code: '3000', name: 'Patrimonio', type: AccountType.EQUITY },
    { code: '3001', name: 'Capital Social', type: AccountType.EQUITY },
    { code: '3002', name: 'Utilidades Retenidas', type: AccountType.EQUITY },

    // INGRESOS
    { code: '4000', name: 'Ingresos', type: AccountType.INCOME },
    { code: '4001', name: 'Ingresos por Servicios Hax', type: AccountType.INCOME },
    { code: '4002', name: 'Ingresos por Servicios Koder', type: AccountType.INCOME },
    { code: '4003', name: 'Otros Ingresos', type: AccountType.INCOME },

    // GASTOS
    { code: '5000', name: 'Gastos', type: AccountType.EXPENSE },
    { code: '5001', name: 'Gastos Operativos', type: AccountType.EXPENSE },
    { code: '5002', name: 'Gastos de Marketing', type: AccountType.EXPENSE },
    { code: '5003', name: 'Gastos de Nómina', type: AccountType.EXPENSE },
    { code: '5004', name: 'Gastos de Tecnología', type: AccountType.EXPENSE },
    { code: '5005', name: 'Gastos Administrativos', type: AccountType.EXPENSE },
  ]

  for (const account of accounts) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    })
  }
  console.log(`✅ Plan de cuentas creado: ${accounts.length} cuentas`)

  // ─── Período fiscal inicial ────────────────────────────
  const currentPeriod = new Date().toISOString().slice(0, 7) // "2025-01"
  await prisma.fiscalPeriod.upsert({
    where: { period: currentPeriod },
    update: {},
    create: { period: currentPeriod },
  })
  console.log(`✅ Período fiscal inicial: ${currentPeriod}`)

  console.log('\n🎉 Seed completado exitosamente')
  console.log('─────────────────────────────────')
  console.log(`📧 Admin email: hanzel@hax.com.do`)
  console.log(`🔑 Admin password: Hax2025!`)
  console.log('─────────────────────────────────')
  console.log('⚠️  Cambiar la contraseña en producción!')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
