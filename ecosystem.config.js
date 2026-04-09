// ============================================
// PM2 — ERP Hax Production Config
// ============================================

module.exports = {
  apps: [
    // ─── API (Express) ──────────────────────────
    {
      name: 'erp-hax-api',
      script: './apps/api/dist/index.js',
      instances: 2,          // 2 workers (ajustar según CPU VPS)
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        API_PORT: 4000,
      },
      error_file: './logs/api-error.log',
      out_file:   './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 5000,
      autorestart: true,
    },

    // ─── Web (Next.js) ──────────────────────────
    {
      name: 'erp-hax-web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: './apps/web',
      instances: 1,
      watch: false,
      max_memory_restart: '800M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/web-error.log',
      out_file:   './logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 5000,
      autorestart: true,
    },
  ],
}
