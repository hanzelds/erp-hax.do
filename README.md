# ERP HAX V1

Sistema ERP interno para **HAX ESTUDIO CREATIVO EIRL**  
RNC: `133290251` | Dominio: `erp.hax.com.do`

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 + TailwindCSS + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| Base de datos | PostgreSQL 16 + Prisma ORM |
| Queue / Caché | Redis + BullMQ |
| Auth | JWT (8h) + bcrypt |
| Fiscal | Alanube API → DGII |
| Infra | Ubuntu 24 · Nginx · PM2 · Let's Encrypt |

---

## Desarrollo local

### Requisitos
- Node.js 20+
- Docker Desktop

### 1. Clonar y configurar entorno

```bash
git clone <repo>
cd erp-hax
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
# Editar las variables en ambos archivos
```

### 2. Levantar base de datos y Redis

```bash
docker-compose up -d
# PostgreSQL en :5432
# Redis en :6379
# Adminer (UI de DB) en :8080
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Migraciones y seed inicial

```bash
npm run db:migrate      # Crear tablas
npm run db:generate     # Generar Prisma Client
npm run db:seed         # Datos iniciales (usuario admin + catálogo de cuentas)
```


### 5. Iniciar en desarrollo

```bash
npm run dev
# API:      http://localhost:4000
# Web:      http://localhost:3000
# DB UI:    http://localhost:8080
```

---

## Despliegue en VPS

### Prerrequisitos
- VPS Ubuntu 24 LTS
- DNS: `erp.hax.com.do` apuntando a la IP del VPS
- Acceso SSH con llave

### Deploy automático

```bash
# En el VPS, desde el directorio del proyecto:
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### SSL (después del deploy)

```bash
sudo certbot --nginx -d erp.hax.com.do \
  --email hanzel@hax.com.do \
  --agree-tos --non-interactive
```

### Comandos PM2 útiles

```bash
pm2 status                    # Ver procesos
pm2 logs erp-hax-api          # Logs de la API
pm2 logs erp-hax-web          # Logs del frontend
pm2 restart erp-hax-api       # Reiniciar API
pm2 reload ecosystem.config.js --env production  # Reload sin downtime
```

---

## Estructura del proyecto

```
erp-hax/
├── apps/
│   ├── api/                    ← Express + Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma   ← Todas las tablas
│   │   │   └── seed.ts         ← Datos iniciales
│   │   └── src/
│   │       ├── config/         ← DB, env, logger
│   │       ├── middleware/     ← Auth, errores
│   │       ├── modules/        ← Un carpeta por módulo
│   │       │   ├── auth/
│   │       │   ├── clients/
│   │       │   ├── invoices/   ← Alanube integrado aquí
│   │       │   ├── expenses/
│   │       │   ├── payments/
│   │       │   ├── accounting/
│   │       │   ├── reports/
│   │       │   └── payroll/
│   │       ├── services/       ← AlanubeService, EmailService
│   │       └── utils/          ← audit, response helpers
│   └── web/                    ← Next.js 14
│       └── src/
│           ├── app/            ← App Router pages
│           ├── components/     ← UI, layout, shared
│           └── lib/            ← api client, auth store
├── nginx/
│   └── erp-hax.conf            ← Config Nginx producción
├── scripts/
│   └── deploy.sh               ← Deploy automatizado VPS
├── ecosystem.config.js         ← PM2 producción
├── docker-compose.yml          ← Desarrollo local
└── .env.example                ← Variables de entorno
```

---

## Módulos V1

| Módulo | Estado |
|---|---|
| Auth + Usuarios | 🔜 Siguiente paso |
| Clientes | 🔜 |
| Facturación + Alanube | 🔜 |
| Gastos | 🔜 |
| Pagos | 🔜 |
| Contabilidad automática | 🔜 |
| Reportes (606/607/P&L) | 🔜 |
| Dashboard | 🔜 |
| Nómina | 🔜 |

---

## Variables críticas para producción

```env
JWT_SECRET=           # Mínimo 64 caracteres aleatorios
JWT_REFRESH_SECRET=   # Mínimo 64 caracteres aleatorios
DATABASE_URL=         # Con password seguro
ALANUBE_API_KEY=      # Obtener en Alanube
ALANUBE_ENV=production
NODE_ENV=production
```

Generar secretos seguros:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Seguridad (HAX Security Core)

- ✅ HTTPS obligatorio (Nginx + Certbot)
- ✅ Rate limiting (20 req/s general, 5 req/min en login)
- ✅ Firewall UFW (solo puertos 80, 443, SSH)
- ✅ Fail2Ban activo
- ✅ Puertos internos (3000, 4000, 5432, 6379) bloqueados externamente
- ✅ JWT con expiración 8h
- ✅ bcrypt para contraseñas
- ✅ Audit log en toda acción crítica
- ✅ Helmet (headers de seguridad)
- ✅ CORS restringido a dominio

---

**HAX ESTUDIO CREATIVO EIRL** | info@hax.com.do | RNC: 133290251
