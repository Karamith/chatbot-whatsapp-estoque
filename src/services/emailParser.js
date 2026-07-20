const queries = require('../database/queries');
const { getClient } = require('../whatsapp/client');

const APPROVAL_KEYWORDS = [
  'ok', 'de acordo', 'aprovado', 'aprovamos', 'pode prosseguir',
  'pode faturar', 'fature', 'pode seguir', 'dê seguimento',
  'de seguimento', 'concordo', 'autorizo', 'autorizamos',
  'sim', 'seguir com', 'mandar', 'pode mandar', 'confirmo',
  'liberado', 'pedido liberado', 'pedido aprovado', 'libere', 
  'liberar', 'aprovar', 'aprove', 'pode aprovar'
];

/**
 * Procura um ID de pedido no texto.
 * Ex: "#42", "#PD-42", "PD-0042"
 */
function extractPedidoId(text) {
  if (!text) return null;
  // Match para "#123", "#PD-123", "PD-0042", ou "PD #74"
  const match = text.match(/PD\s*[#-]?\s*0*(\d+)/i) || text.match(/#0*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Procura por um número de orçamento (exatamente 6 dígitos)
 */
function extractOrcamento(text) {
  if (!text) return null;
  const match = text.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

/**
 * Procura por um número de Pedido de Venda (PV) do Protheus (exatamente 5 dígitos, muitas vezes com 'PV' antes)
 */
function extractPedidoVenda(text) {
  if (!text) return null;
  const match = text.match(/PV\s*[#-]?\s*(\d{5})/i) || text.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}

/**
 * Verifica se o texto contém palavras de aprovação
 */
function hasApprovalKeyword(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return APPROVAL_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Processa um e-mail recebido e decide se avança o Kanban.
 */
async function processEmailContent(subject, textBody, fromEmail, ioInstance) {
  // 1. Vincular E-mail -> PD
  const fullTextToSearchPD = `${subject}\n${textBody}`;
  const pedidoId = extractPedidoId(fullTextToSearchPD);

  if (!pedidoId) {
    console.log('[E-MAIL PARSER] Nenhum #PD- detectado. Ignorando e-mail.');
    return;
  }

  // 2. Busca o Pedido atual
  const pedido = queries.buscarPedidoPorId(pedidoId);
  if (!pedido) {
    console.log(`[E-MAIL PARSER] Pedido #${pedidoId} não encontrado no banco.`);
    return;
  }

  const currentStatus = pedido.status_pedido;
  let newStatus = null;
  let orcamentoDetectado = null;
  let notificarTecnicoMsg = null;
  let extraData = {};

  // CUIDADO COM O HISTÓRICO: o email pode ter várias respostas antigas "escondidas". 
  // O ideal é olhar apenas as primeiras linhas (o topo da resposta atual).
  // Vamos pegar apenas os primeiros 500 caracteres ou antes da tag de reply original.
  const splitText = textBody.split(/On\s.+?wrote:|Em\s.+?escreveu:/i);
  const currentReplyText = splitText[0].slice(0, 1000); 
  const textToAnalyze = `${subject}\n${currentReplyText}`;

  // 3. Regras de Transição (Status Guards)

  // A. Está em Análise
  if (currentStatus === 'EM_ANALISE') {
    const isCIF = pedido.modelo && pedido.modelo.toUpperCase().includes('CIF');
    
    if (isCIF) {
      // Para CIF, não tem orçamento. Pula direto para Em Processamento se detectar o PV.
      const pvDetectado = extractPedidoVenda(textToAnalyze);
      if (pvDetectado) {
        newStatus = 'EM_PROCESSAMENTO';
        extraData.numero_pedido_protheus = pvDetectado;
        console.log(`[E-MAIL PARSER] Cliente CIF. Pedido de Venda (PV ${pvDetectado}) detectado para o PD-${pedidoId}. Pulando para EM_PROCESSAMENTO.`);
      }
    } else {
      // Fluxo normal (venda de peças): procura Orçamento
      orcamentoDetectado = extractOrcamento(textToAnalyze);
      if (orcamentoDetectado) {
        newStatus = 'ORCAMENTO_ENVIADO';
        notificarTecnicoMsg = `⚠️ *Atualização no seu pedido #PD-${String(pedidoId).padStart(4, '0')}*\nO orçamento do cliente *${pedido.cliente}* (Modelo: ${pedido.modelo}) acaba de ser enviado.`;
        console.log(`[E-MAIL PARSER] Orçamento detectado (${orcamentoDetectado}) para o PD-${pedidoId}. Movendo para ORCAMENTO_ENVIADO.`);
      }
    }
  }
  
  // B. Está com Orçamento Enviado -> Pode ir para Aprovado
  else if (currentStatus === 'ORCAMENTO_ENVIADO') {
    if (hasApprovalKeyword(currentReplyText)) { // Checamos a aprovação só no corpo
      newStatus = 'APROVADO';
      // notificarTecnicoMsg = `✅ *Atualização no seu pedido #PD-${String(pedidoId).padStart(4, '0')}*\nO cliente *${pedido.cliente}* aprovou o orçamento.`;
      console.log(`[E-MAIL PARSER] Palavra de aprovação detectada para o PD-${pedidoId}. Movendo para APROVADO.`);
    }
  }

  // C. Está Aprovado -> Vai para faturamento/separação (Em Processamento)
  else if (currentStatus === 'APROVADO') {
    const pvDetectado = extractPedidoVenda(textToAnalyze);
    if (pvDetectado && hasApprovalKeyword(currentReplyText)) {
      newStatus = 'EM_PROCESSAMENTO';
      extraData.numero_pedido_protheus = pvDetectado;
      console.log(`[E-MAIL PARSER] Pedido de Venda (PV ${pvDetectado}) e liberação detectados para o PD-${pedidoId}. Movendo para EM_PROCESSAMENTO.`);
    }
  }

  // 4. Executa a Ação, se houver
  if (newStatus) {
    if (orcamentoDetectado) {
      extraData.numero_orcamento = orcamentoDetectado;
    }

    // ==========================================
    // FASE 3 ATIVA: MOTOR DE EXECUÇÃO
    // ==========================================
    
    console.log(`[E-MAIL PARSER] Executando movimento de PD-${pedidoId} para o status: ${newStatus}`);

    // Atualiza no banco
    queries.atualizarStatusPedido(pedidoId, newStatus, extraData);

    // Exporta Excel para manter sincronizado
    try {
      const { exportToExcel } = require('../database/exportToExcel');
      exportToExcel();
    } catch (e) {
      console.error('[E-MAIL PARSER] Erro ao exportar Excel:', e);
    }

    // Atualiza front-end
    if (ioInstance) {
      ioInstance.emit('kanban_update');
    }

    // Dispara bot no WhatsApp
    if (notificarTecnicoMsg && pedido.telefone_tecnico) {
      const client = getClient();
      if (client) {
        const chatId = `${pedido.telefone_tecnico}@c.us`;
        await client.sendMessage(chatId, notificarTecnicoMsg).catch(err => {
          console.error('[E-MAIL PARSER] Erro ao notificar técnico:', err.message);
        });
      }
    }
  } else {
    console.log(`[E-MAIL PARSER] PD-${pedidoId} analisado, mas não houve gatilhos para o status atual (${currentStatus}).`);
  }
}

module.exports = {
  extractPedidoId,
  extractOrcamento,
  hasApprovalKeyword,
  processEmailContent
};
