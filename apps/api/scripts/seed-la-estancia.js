const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 1. Crear o encontrar el cliente
  let client = await prisma.client.findFirst({
    where: { name: { contains: 'La Estancia', mode: 'insensitive' } }
  })

  if (!client) {
    client = await prisma.client.create({
      data: {
        name:         'La Estancia Real Estate',
        email:        'ventas@laestanciarealestaterd.com',
        phone:        '+1 (849) 581-6928',
        address:      'La Estancia Golf & Country Club, San Rafael del Yuma, La Altagracia',
        city:         'San Rafael del Yuma, La Altagracia',
        isActive:     true,
      }
    })
    console.log('✅ Cliente creado:', client.id)
  } else {
    console.log('ℹ️  Cliente existente:', client.id)
  }

  // 2. Verificar que no existe ya la oportunidad
  const exists = await prisma.crmOpportunity.findFirst({
    where: { clientId: client.id, title: { contains: 'La Estancia' } }
  })
  if (exists) {
    console.log('ℹ️  Oportunidad ya existe:', exists.id)
    return
  }

  // 3. Crear la oportunidad CRM
  const opp = await prisma.crmOpportunity.create({
    data: {
      clientId:     client.id,
      businessUnit: 'KODER',
      title:        'Transformación Digital — La Estancia Real Estate',
      description: [
        'Proyecto inmobiliario de alto valor en Zona Este RD.',
        '3M m² + campo de golf P.B. Dye. Proyectos activos: Palmarés, Aflora, Vistas de Thamana, Villas La Estancia.',
        'Tickets promedio: US$146K–$500K+. Feria propia (3ra edición oct 2025). 7,296 seguidores Instagram.',
        '',
        'OPORTUNIDADES KODER:',
        '• Rediseño web profesional (actualmente Wix básico, sin captación real)',
        '• Landing pages dedicadas por proyecto con formulario inteligente de precalificación',
        '• CRM integrado con seguimiento automatizado de leads',
        '• Botón WhatsApp flotante + chatbot 24/7 para consultas de inversión',
        '• SEO orgánico — sin blog ni posicionamiento actualmente',
        '• Catálogo de propiedades con filtros y buscador',
      ].join('\n'),
      value:        480000,
      probability:  40,
      status:       'LEAD',
      leadSource:   'COLD_OUTREACH',
      contactName:  'Daniela Mussa Pérez',
      contactPhone: '+1 (849) 581-6928',
      assignedTo:   'Hanzel',
      notes: [
        'Lead Score interno: 84/100 — Prioridad B alto, casi A.',
        'Sitio web: laestanciarealestaterd.com (Wix). Email: ventas@laestanciarealestaterd.com.',
        'Tel alt: +1 (829) 828-7787. Instagram: @laestanciard / @laestanciarealestate.',
        'Contacto identificado: Daniela Mussa Pérez (directiva).',
        'Cada visita al sitio que no convierte = dinero perdido dado ticket promedio US$146K+.',
        'Acceso al beach club en Dominicus. Entre Sto. Dgo. y Punta Cana (5 min aeropuerto La Romana).',
      ].join('\n'),
      expectedDate: new Date('2025-09-30'),
    }
  })

  console.log('✅ Oportunidad CRM creada:', opp.id)
  console.log('   Título:      ', opp.title)
  console.log('   Valor:       RD$', opp.value.toLocaleString())
  console.log('   Probabilidad:', opp.probability + '%')
  console.log('   Contacto:    ', opp.contactName)
}

main()
  .catch(e => { console.error('❌', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
