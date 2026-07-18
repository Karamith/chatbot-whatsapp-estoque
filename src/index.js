// ============================================
// CHATBOT WHATSAPP - CONSULTA DE ESTOQUE
// Arquivo principal - Inicia o servidor
// ============================================

const express = require('express');
const config = require('./config');
const { initDatabase } = require('./database/connection');
const { loadExcel, loadEdicula } = require('./estoque/excel');
const { loadClientesEquipamentos } = require('./clientes/excel');
// const { handleIncomingMessage } = require('./chatbot/handler');
const { initWhatsApp } = require('./whatsapp/client');
const webServer = require('./server/app');

// Se desejar um servidor web para verificaÃ§Ãµes, pode-se descomentar as linhas abaixo
// const app = express();
// app.use(express.json());
// app.get('/health', (req, res) => { res.json({ status: 'ok' }); });

const { startCronJobs } = require('./server/cron');
const { startEmailWatcher } = require('./services/emailWatcher');

// Inicialização
async function startServer() {
  console.log('Iniciando o servidor...');
  
  await initDatabase();
  loadExcel();
  loadEdicula();
  loadClientesEquipamentos();
  
  // Iniciar servidor web do Dashboard
  await webServer.startServer(config.PORT || 3000);
  
  // Iniciar bot de WhatsApp
  await initWhatsApp();
  
  // Iniciar tarefas agendadas (Cron)
  startCronJobs();
  
  // Iniciar varredura de e-mails (IMAP) para automação do Kanban
  startEmailWatcher(webServer.io);
}

startServer().catch(console.error);
