const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const os = require('os');
const config = require('../config');
const { handleIncomingMessage } = require('../chatbot/handler');

let client;

// Armazenar sessoes FORA do OneDrive para evitar conflitos de sincronizacao
// que causam o erro "Execution context was destroyed"
const SESSION_PATH = path.join(os.homedir(), '.chatbot-whatsapp-sessions');

function createClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
    }
  });
}

function registerEvents(c) {
  c.on('qr', (qr) => {
    console.log('\n======================================================');
    console.log('📱 ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP');
    console.log('======================================================\n');
    qrcode.generate(qr, { small: true });
  });

  c.on('ready', () => {
    console.log('\n✅ BOT INICIADO E PRONTO PARA RESPONDER!');
    console.log('Conectado ao número:', c.info.wid.user);
  });

  c.on('message', async (message) => {
    try {
      if (message.isStatus || message.fromMe) return;
      if (message.from.endsWith('@g.us')) return;
      console.log(`[MSG] ${message.from}: ${message.body}`);
      await handleIncomingMessage(message, c);
    } catch (error) {
      console.error('[ERRO] Falha ao processar mensagem recebida:', error.message);
    }
  });

  c.on('disconnected', (reason) => {
    console.log('❌ WhatsApp Desconectado. Motivo:', reason);
    console.log('Reiniciando o cliente em 5 segundos...');
    setTimeout(() => c.initialize(), 5000);
  });
}

async function initWhatsApp() {
  console.log('🤖 Iniciando o cliente WhatsApp...');
  console.log(`📂 Sessões armazenadas em: ${SESSION_PATH}`);

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      client = createClient();
      registerEvents(client);
      await client.initialize();
      return client; // Sucesso - sai do loop
    } catch (err) {
      console.error(`[ERRO] Falha ao inicializar o WhatsApp (tentativa ${attempt}/${maxRetries}):`, err.message);
      try { await client.destroy(); } catch (_) {}

      if (attempt < maxRetries) {
        console.log('Tentando novamente em 10 segundos...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.error('[ERRO FATAL] Não foi possível iniciar o WhatsApp após múltiplas tentativas.');
        console.error(`Dica: Apague a pasta "${SESSION_PATH}" e tente novamente.`);
      }
    }
  }

  return client;
}

function getClient() {
  return client;
}

module.exports = {
  initWhatsApp,
  getClient
};
