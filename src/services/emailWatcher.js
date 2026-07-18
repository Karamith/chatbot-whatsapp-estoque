const Imap = require('imap');
const { simpleParser } = require('mailparser');
const cron = require('node-cron');
const config = require('../config');
const emailParser = require('./emailParser');

let imapConnection = null;
let isPolling = false;

function createImapConfig() {
  return {
    user: config.IMAP_USER,
    password: config.IMAP_PASS,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  };
}

/**
 * Conecta via IMAP e busca os e-mails não lidos
 */
function checkUnreadEmails(ioInstance) {
  if (isPolling) {
    return;
  }
  
  if (!config.IMAP_ENABLED || !config.IMAP_USER || !config.IMAP_PASS) {
    return;
  }

  isPolling = true;
  const imap = new Imap(createImapConfig());

  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('[IMAP] Erro ao abrir a caixa de entrada:', err);
        imap.end();
        isPolling = false;
        return;
      }

      // Busca apenas e-mails não lidos (UNSEEN)
      imap.search(['UNSEEN'], (err, results) => {
        if (err) {
          console.error('[IMAP] Erro ao buscar e-mails:', err);
          imap.end();
          isPolling = false;
          return;
        }

        if (!results || results.length === 0) {
          imap.end();
          isPolling = false;
          return;
        }

        console.log(`[IMAP] Encontrados ${results.length} novos e-mails. Processando...`);

        // Busca o cabeçalho e corpo dos e-mails
        const f = imap.fetch(results, { bodies: '' });
        
        f.on('message', (msg, seqno) => {
          msg.on('body', (stream, info) => {
            simpleParser(stream, async (err, parsed) => {
              if (err) {
                console.error('[IMAP] Erro ao fazer o parse do e-mail:', err);
                return;
              }
              
              const subject = parsed.subject || '';
              const textBody = parsed.text || '';
              const fromEmail = parsed.from && parsed.from.value && parsed.from.value[0] ? parsed.from.value[0].address : '';
              
              try {
                // FASE 2: Ler e analisar o Cérebro (Dry-run, sem alterar banco na Fase 3)
                console.log(`[FASE 2 - MOTOR] 📩 Analisando e-mail de ${fromEmail} - Assunto: ${subject}`);
                
                // Chamada para a Fase 2 (emailParser) ativada!
                await emailParser.processEmailContent(subject, textBody, fromEmail, ioInstance);
              } catch (parseError) {
                console.error('[IMAP] Erro no parser ao processar e-mail:', parseError);
              }
            });
          });

          msg.once('attributes', (attrs) => {
            const uid = attrs.uid;
            // Marca o e-mail como lido para não ser processado novamente
            imap.addFlags(uid, ['\\Seen'], (err) => {
              if (err) {
                console.error(`[IMAP] Erro ao marcar e-mail UID ${uid} como lido:`, err);
              }
            });
          });
        });

        f.once('error', (err) => {
          console.error('[IMAP] Erro na stream de busca:', err);
        });

        f.once('end', () => {
          console.log('[IMAP] Todos os e-mails novos foram lidos.');
          imap.end();
        });
      });
    });
  });

  imap.once('error', (err) => {
    console.error('[IMAP] Erro de conexão:', err.message);
    isPolling = false;
  });

  imap.once('end', () => {
    isPolling = false;
  });

  imap.connect();
}

/**
 * Inicia o serviço que checa e-mails a cada X minutos via cron
 */
function startEmailWatcher(ioInstance) {
  if (!config.IMAP_ENABLED) {
    console.log('📧 Serviço de e-mail (IMAP) desabilitado no .env (IMAP_ENABLED).');
    return;
  }
  
  if (!config.IMAP_USER || !config.IMAP_PASS) {
    console.warn('⚠️ AVISO: IMAP_USER e IMAP_PASS não configurados. A automação de e-mail não funcionará.');
    return;
  }

  console.log('📧 Serviço de E-mail (IMAP) ativado! Lendo a cada 30 segundos...');
  
  // Roda a cada 30 segundos (sintaxe de 6 campos do node-cron)
  cron.schedule('*/30 * * * * *', () => {
    checkUnreadEmails(ioInstance);
  });
  
  // Dispara uma vez ao iniciar
  setTimeout(() => {
    checkUnreadEmails(ioInstance);
  }, 5000); // aguarda 5s para o app levantar todo o resto
}

module.exports = {
  startEmailWatcher
};
