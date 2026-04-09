#!/bin/bash
# ============================================================
# ERP HAX — Script de instalación y despliegue en VPS
# Ubuntu 24 LTS | erp.hax.com.do
# ============================================================

set -e  # Detener si hay error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║       ERP HAX — Deploy Script V1         ║"
echo "║    HAX ESTUDIO CREATIVO EIRL              ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ─── PASO 1: Actualizar sistema ──────────────────────────
echo -e "${YELLOW}[1/10] Actualizando sistema...${NC}"
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ufw fail2ban

# ─── PASO 2: Node.js 20 ──────────────────────────────────
echo -e "${YELLOW}[2/10] Instalando Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
echo -e "${GREEN}Node.js: $(node --version) | npm: $(npm --version)${NC}"

# ─── PASO 3: PostgreSQL 16 ───────────────────────────────
echo -e "${YELLOW}[3/10] Instalando PostgreSQL 16...${NC}"
sudo apt install -y postgresql-16 postgresql-client-16

sudo systemctl enable postgresql
sudo systemctl start postgresql

# Crear usuario y base de datos
sudo -u postgres psql << EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hax_user') THEN
    CREATE USER hax_user WITH PASSWORD 'CAMBIAR_EN_PRODUCCION';
  END IF;
END
\$\$;
CREATE DATABASE erp_hax_prod OWNER hax_user;
GRANT ALL PRIVILEGES ON DATABASE erp_hax_prod TO hax_user;
EOF

echo -e "${GREEN}PostgreSQL configurado${NC}"

# ─── PASO 4: Redis ───────────────────────────────────────
echo -e "${YELLOW}[4/10] Instalando Redis...${NC}"
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
echo -e "${GREEN}Redis: $(redis-cli ping)${NC}"

# ─── PASO 5: Nginx ───────────────────────────────────────
echo -e "${YELLOW}[5/10] Instalando Nginx...${NC}"
sudo apt install -y nginx
sudo systemctl enable nginx

# Copiar config
sudo cp nginx/erp-hax.conf /etc/nginx/sites-available/erp-hax
sudo ln -sf /etc/nginx/sites-available/erp-hax /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
echo -e "${GREEN}Nginx configurado${NC}"

# ─── PASO 6: Certbot (SSL) ───────────────────────────────
echo -e "${YELLOW}[6/10] Instalando Certbot (SSL)...${NC}"
sudo apt install -y certbot python3-certbot-nginx

# NOTA: ejecutar manualmente con el dominio real:
# sudo certbot --nginx -d erp.hax.com.do --email hanzel@hax.com.do --agree-tos --non-interactive
echo -e "${YELLOW}⚠  Certbot instalado. Ejecutar SSL manualmente (ver README)${NC}"

# ─── PASO 7: PM2 ─────────────────────────────────────────
echo -e "${YELLOW}[7/10] Instalando PM2...${NC}"
sudo npm install -g pm2
pm2 startup systemd -u $USER --hp $HOME
echo -e "${GREEN}PM2 instalado${NC}"

# ─── PASO 8: Firewall (UFW) ──────────────────────────────
echo -e "${YELLOW}[8/10] Configurando firewall...${NC}"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Bloquear acceso directo a puertos internos desde exterior
sudo ufw deny 3000/tcp
sudo ufw deny 4000/tcp
sudo ufw deny 5432/tcp
sudo ufw deny 6379/tcp
sudo ufw --force enable
echo -e "${GREEN}Firewall activo${NC}"

# ─── PASO 9: Fail2Ban ────────────────────────────────────
echo -e "${YELLOW}[9/10] Configurando Fail2Ban...${NC}"
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
echo -e "${GREEN}Fail2Ban activo${NC}"

# ─── PASO 10: Build y Deploy ─────────────────────────────
echo -e "${YELLOW}[10/10] Instalando dependencias y compilando...${NC}"
npm install
npm run build

# Ejecutar migraciones
cd apps/api && npx prisma migrate deploy && npx prisma db seed && cd ../..

# Crear directorio de logs
mkdir -p logs

# Iniciar con PM2
pm2 start ecosystem.config.js --env production
pm2 save

# Recargar Nginx
sudo systemctl reload nginx

echo -e "${GREEN}"
echo "╔══════════════════════════════════════════╗"
echo "║   ✅ ERP HAX desplegado exitosamente!    ║"
echo "╠══════════════════════════════════════════╣"
echo "║  🌐 https://erp.hax.com.do              ║"
echo "║  📡 API: puerto 4000 (interno)           ║"
echo "║  🖥  Web: puerto 3000 (interno)           ║"
echo "╠══════════════════════════════════════════╣"
echo "║  ⚠  PENDIENTE: ejecutar SSL Certbot      ║"
echo "║  ⚠  Cambiar contraseñas de producción   ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"
