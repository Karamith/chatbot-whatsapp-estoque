const queries = require('../database/queries');

/**
 * Retorna a sessao ativa de um usuario, verificando se nao expirou
 */
function getSessaoAtiva(telefone) {
  const sessao = queries.obterSessaoAtiva(telefone);

  if (!sessao) return null;

  const agora = new Date();
  const atualizadaEm = new Date(sessao.atualizada_em);
  const diffMinutes = (agora - atualizadaEm) / 1000 / 60;

  if (diffMinutes > 30) {
    queries.encerrarSessao(sessao.id);
    return null;
  }

  return sessao;
}

/**
 * Cria uma nova sessao para o usuario
 */
function novaSessao(telefone, tecnicoNome) {
  // Encerra qualquer sessão ativa anterior (proteção contra sessões órfãs)
  queries.encerrarTodasSessoesAtivas(telefone);

  const id = queries.criarSessao(telefone, tecnicoNome);
  return {
    id,
    telefone,
    tecnico_nome: tecnicoNome,
    cliente: null,
    modelo: null,
    modelos_cliente: [],
    estado: 'menu',
    itens_consultados: [],
    tentativas_busca: 0,
    motivo: null,
    md: null,
    urgencia: null
  };
}

/**
 * Atualiza o estado da conversa e dados opcionais da solicitacao
 */
function setEstado(sessaoId, novoEstado, cliente = null, modelo = null, modelosCliente = null) {
  queries.atualizarEstadoSessao(sessaoId, novoEstado, cliente, modelo, modelosCliente);
}

function setClienteModelos(sessaoId, cliente, modelosCliente) {
  queries.atualizarDadosCliente(sessaoId, cliente, modelosCliente);
}

function setModelo(sessaoId, modelo) {
  queries.atualizarModeloSessao(sessaoId, modelo);
}

/**
 * Adiciona um item na lista de consultados da sessao
 */
function adicionarItemConsultado(sessao, item) {
  const index = sessao.itens_consultados.findIndex(i => i.codigo === item.codigo);

  if (index >= 0) {
    sessao.itens_consultados[index] = { ...sessao.itens_consultados[index], ...item };
  } else {
    sessao.itens_consultados.push({
      codigo: item.codigo,
      descricao: item.descricao,
      quantidadeEstoque: item.quantidade,
      quantidadeDesejada: null,
      importacao: item.importacao || false,
      isEdicula: item.isEdicula || false,
      localizacao: item.localizacao || null
    });
  }

  queries.atualizarItensSessao(sessao.id, sessao.itens_consultados);
}

/**
 * Atualiza a quantidade desejada de um item especifico na lista
 */
function setQuantidadeDesejada(sessao, indexItem, quantidade) {
  if (sessao.itens_consultados[indexItem]) {
    sessao.itens_consultados[indexItem].quantidadeDesejada = quantidade;
    queries.atualizarItensSessao(sessao.id, sessao.itens_consultados);
    return true;
  }
  return false;
}

function setRespostasCheckout(sessaoId, motivo, md, urgencia) {
  queries.atualizarDadosCheckout(sessaoId, motivo, md, urgencia);
}

function resetTentativasBusca(sessaoId) {
  queries.atualizarTentativasBusca(sessaoId, 0);
}

function incrementarTentativasBusca(sessaoId, atual) {
  const novasTentativas = (atual || 0) + 1;
  queries.atualizarTentativasBusca(sessaoId, novasTentativas);
  return novasTentativas;
}

/**
 * Encerra a sessao
 */
function fecharSessao(sessaoId) {
  queries.encerrarSessao(sessaoId);
}

/**
 * Limpa itens consultados e dados da solicitação da sessao (reset para nova consulta)
 */
function limparDadosSessao(sessaoId) {
  queries.atualizarItensSessao(sessaoId, []);
  queries.atualizarDadosCheckout(sessaoId, null, null, null);
  queries.atualizarDadosCliente(sessaoId, null, []);
  queries.atualizarTentativasBusca(sessaoId, 0);
}

/**
 * Registra consulta para historico
 */
function historicoConsulta(sessaoId, tipo, termo, resultado, pecaEncontrada = null) {
  queries.registrarConsulta({
    sessao_id: sessaoId,
    tipo_consulta: tipo,
    termo_buscado: termo,
    resultado: resultado,
    codigo_peca: pecaEncontrada ? pecaEncontrada.codigo : null,
    descricao_peca: pecaEncontrada ? pecaEncontrada.descricao : null,
    quantidade_estoque: pecaEncontrada ? pecaEncontrada.quantidade : 0
  });
}

/**
 * Salva a solicitacao consolidada no banco
 */
function salvarSolicitacao(sessao) {
  const itensValidos = sessao.itens_consultados.filter(i => i.quantidadeDesejada && i.quantidadeDesejada > 0);

  if (itensValidos.length === 0) return false;

  const solicitacaoId = queries.registrarSolicitacao({
    sessao_id: sessao.id,
    tecnico_nome: sessao.tecnico_nome,
    cliente: sessao.cliente,
    modelo: sessao.modelo,
    telefone: sessao.telefone,
    motivo: sessao.motivo,
    md: sessao.md,
    urgencia: sessao.urgencia,
    itens: itensValidos
  });
  
  // Atualiza o arquivo do banco de dados em Excel
  try {
    const { exportToExcel } = require('../database/exportToExcel');
    exportToExcel();
    
    const { io } = require('../server/app');
    if (io) {
      io.emit('kanban_update');
    }
  } catch (err) {
    console.error('Erro ao exportar solicitações para Excel ou emitir evento socket:', err);
  }

  return solicitacaoId;
}

module.exports = {
  getSessaoAtiva,
  novaSessao,
  setEstado,
  setClienteModelos,
  setModelo,
  adicionarItemConsultado,
  setQuantidadeDesejada,
  setRespostasCheckout,
  resetTentativasBusca,
  incrementarTentativasBusca,
  fecharSessao,
  limparDadosSessao,
  historicoConsulta,
  salvarSolicitacao
};
