require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  BACKOFFICE_PHONE: process.env.BACKOFFICE_PHONE,
  EXCEL_FILE_PATH: process.env.EXCEL_FILE_PATH || './data/estoque.xlsx',
  CLIENTES_FILE_PATH: process.env.CLIENTES_FILE_PATH || './data/clientes.xlsx',
  SESSION_TIMEOUT_MINUTES: parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 30,
  FUZZY_THRESHOLD: parseFloat(process.env.FUZZY_THRESHOLD) || 0.4,
  FUZZY_MAX_RESULTS: parseInt(process.env.FUZZY_MAX_RESULTS, 10) || 10,
  
  // Configuracoes de E-mail
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER,
  BASE_URL: 'http://66.94.100.86:3000',
  
  // Configuracoes de IMAP (Recebimento para Kanban)
  IMAP_ENABLED: process.env.IMAP_ENABLED === 'true',
  IMAP_USER: process.env.IMAP_USER || process.env.SMTP_USER,
  IMAP_PASS: process.env.IMAP_PASS || process.env.SMTP_PASS,
  
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-key-condado',
  TV_API_KEY: process.env.TV_API_KEY || 'default-tv-key-123'
};
