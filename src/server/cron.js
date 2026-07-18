const cron = require('node-cron');
const queries = require('../database/queries');
const { getClient } = require('../whatsapp/client');

function startCronJobs() {
  // Roda todos os dias às 10:00 da manhã
  // "0 10 * * *" = minuto 0, hora 10, todos os dias
  cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Iniciando verificação de peças de reposição pendentes...');
    
    try {
      const client = getClient();
      if (!client) {
        console.warn('[CRON] Cliente WhatsApp não está conectado.');
        return;
      }

      const pendencias = queries.buscarTodasReposicoesPendentesCron();
      if (!pendencias || pendencias.length === 0) {
        console.log('[CRON] Nenhuma reposição pendente.');
        return;
      }

      // Agrupar por técnico (telefone)
      const pendenciasPorTecnico = {};
      const agora = new Date();

      pendencias.forEach(p => {
        // Ignora se não houver telefone
        if (!p.telefone_tecnico) return;

        const msDiff = agora - new Date(p.finalizado_em);
        const diasAtraso = Math.floor(msDiff / (1000 * 60 * 60 * 24));
        
        const tel = p.telefone_tecnico;
        if (!pendenciasPorTecnico[tel]) {
          pendenciasPorTecnico[tel] = {
            nome: p.tecnico_nome,
            itens: [],
            temAtrasoGrave: false
          };
        }

        pendenciasPorTecnico[tel].itens.push({ ...p, dias_atraso: diasAtraso });
        
        if (diasAtraso >= 7) {
          pendenciasPorTecnico[tel].temAtrasoGrave = true;
        }
      });

      // Disparar mensagens
      for (const [telefone, dados] of Object.entries(pendenciasPorTecnico)) {
        let deveEnviar = false;
        
        if (dados.temAtrasoGrave) {
          deveEnviar = true; // Se tem peça >= 7 dias, avisa diariamente
        } else {
          // Verifica se alguma peça bate na regra dos dias pares (2, 4, 6)
          const temDiaPar = dados.itens.some(i => i.dias_atraso > 0 && i.dias_atraso % 2 === 0);
          if (temDiaPar) {
            deveEnviar = true;
          }
        }

        if (deveEnviar) {
          let lista = '';
          dados.itens.forEach((item, index) => {
            const diasMsg = item.dias_atraso > 0 ? ` (${item.dias_atraso} dias de atraso)` : '';
            lista += `${index + 1} - ${item.descricao_peca || item.codigo_peca} (Cliente: ${item.cliente})${diasMsg}\n`;
          });

          const mensagem = `⚠️ *AVISO DE REPOSIÇÃO PENDENTE* ⚠️\n\nOlá ${dados.nome}, você tem as seguintes peças aguardando pedido de reposição:\n\n${lista}\nPor favor, digite *4* no menu principal do bot para dar a baixa nestes itens!`;

          const chatId = telefone.includes('@') ? telefone : `${telefone}@c.us`;
          await client.sendMessage(chatId, mensagem).catch(err => {
            console.error(`[CRON] Erro ao enviar mensagem para ${telefone}:`, err.message);
          });
        }
      }
      
      console.log('[CRON] Verificação finalizada.');
    } catch (err) {
      console.error('[CRON] Erro durante a execução:', err);
    }
  });
  
  console.log('⏰ Gatilho (cron) de reposições agendado para as 10:00 da manhã.');
}

module.exports = { startCronJobs };
