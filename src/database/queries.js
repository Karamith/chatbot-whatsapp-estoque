const { getDb, saveDb } = require('./connection');

function parseJsonArray(valor) {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor;
  try {
    const parsed = JSON.parse(valor);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function queryOne(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (!stmt.step()) return null;
    return stmt.getAsObject();
  } finally {
    stmt.free();
  }
}

function run(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.run(params);
    saveDb();
  } finally {
    stmt.free();
  }
}

function runNoSave(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.run(params);
  } finally {
    stmt.free();
  }
}

function getLastInsertId() {
  const row = queryOne('SELECT last_insert_rowid() AS id');
  return row ? Number(row.id) : null;
}

function mapSessao(row) {
  if (!row) return null;

  return {
    ...row,
    ativa: row.ativa === 1,
    modelos_cliente: parseJsonArray(row.modelos_cliente),
    itens_consultados: parseJsonArray(row.itens_consultados)
  };
}

// ==========================================
// FUNCOES DE SESSAO
// ==========================================

function criarSessao(telefone, tecnicoNome) {
  const agora = new Date().toISOString();

  run(`
    INSERT INTO sessoes (
      telefone, tecnico_nome, cliente, modelo, modelos_cliente, estado,
      itens_consultados, ativa, criada_em, atualizada_em
    ) VALUES (?, ?, NULL, NULL, ?, ?, ?, 1, ?, ?)
  `, [
    telefone,
    tecnicoNome,
    JSON.stringify([]),
    'menu',
    JSON.stringify([]),
    agora,
    agora
  ]);

  return getLastInsertId();
}

function obterSessaoAtiva(telefone) {
  const row = queryOne(`
    SELECT *
    FROM sessoes
    WHERE telefone = ? AND ativa = 1
    ORDER BY atualizada_em DESC
    LIMIT 1
  `, [telefone]);

  return mapSessao(row);
}

function atualizarEstadoSessao(sessaoId, novoEstado, cliente = null, modelo = null, modelosCliente = null) {
  const atual = queryOne('SELECT modelos_cliente FROM sessoes WHERE id = ?', [sessaoId]);
  if (!atual) return;

  run(`
    UPDATE sessoes
    SET estado = ?,
        cliente = COALESCE(?, cliente),
        modelo = COALESCE(?, modelo),
        modelos_cliente = ?,
        atualizada_em = ?
    WHERE id = ?
  `, [
    novoEstado,
    cliente,
    modelo,
    Array.isArray(modelosCliente) ? JSON.stringify(modelosCliente) : atual.modelos_cliente,
    new Date().toISOString(),
    sessaoId
  ]);
}

function atualizarDadosCliente(sessaoId, cliente, modelosCliente) {
  run(`
    UPDATE sessoes
    SET cliente = ?,
        modelo = NULL,
        modelos_cliente = ?,
        atualizada_em = ?
    WHERE id = ?
  `, [cliente, JSON.stringify(modelosCliente || []), new Date().toISOString(), sessaoId]);
}

function atualizarModeloSessao(sessaoId, modelo) {
  run(`
    UPDATE sessoes
    SET modelo = ?, atualizada_em = ?
    WHERE id = ?
  `, [modelo, new Date().toISOString(), sessaoId]);
}

function atualizarItensSessao(sessaoId, itensConsultados) {
  run(`
    UPDATE sessoes
    SET itens_consultados = ?, atualizada_em = ?
    WHERE id = ?
  `, [JSON.stringify(itensConsultados || []), new Date().toISOString(), sessaoId]);
}

function encerrarSessao(sessaoId) {
  run(`
    UPDATE sessoes
    SET ativa = 0, itens_consultados = '[]', atualizada_em = ?
    WHERE id = ?
  `, [new Date().toISOString(), sessaoId]);
}

function encerrarTodasSessoesAtivas(telefone) {
  run(`
    UPDATE sessoes
    SET ativa = 0, itens_consultados = '[]', atualizada_em = ?
    WHERE telefone = ? AND ativa = 1
  `, [new Date().toISOString(), telefone]);
}

function atualizarTentativasBusca(sessaoId, tentativas) {
  run(`
    UPDATE sessoes
    SET tentativas_busca = ?, atualizada_em = ?
    WHERE id = ?
  `, [tentativas, new Date().toISOString(), sessaoId]);
}

function atualizarDadosCheckout(sessaoId, motivo, md, urgencia) {
  run(`
    UPDATE sessoes
    SET motivo = ?, md = ?, urgencia = ?, atualizada_em = ?
    WHERE id = ?
  `, [motivo, md, urgencia, new Date().toISOString(), sessaoId]);
}

// ==========================================
// FUNCOES DE AUDITORIA E SOLICITACOES
// ==========================================

function registrarConsulta(dados) {
  run(`
    INSERT INTO consultas (
      sessao_id, tipo_consulta, termo_buscado, resultado, codigo_peca,
      descricao_peca, quantidade_estoque, criada_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    dados.sessao_id,
    dados.tipo_consulta,
    dados.termo_buscado,
    dados.resultado,
    dados.codigo_peca || null,
    dados.descricao_peca || null,
    dados.quantidade_estoque || 0,
    new Date().toISOString()
  ]);
}

function registrarSolicitacao(dados) {
  const db = getDb();
  let solicitacaoId = null;

  try {
    db.run('BEGIN TRANSACTION');

    runNoSave(`
      INSERT INTO solicitacoes (
        sessao_id, tecnico_nome, cliente, modelo, status_envio, criada_em,
        telefone_tecnico, status_pedido, motivo, md, urgencia
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dados.sessao_id,
      dados.tecnico_nome,
      dados.cliente,
      dados.modelo || null,
      'enviado',
      new Date().toISOString(),
      dados.telefone || '',
      'PENDENTE',
      dados.motivo || null,
      dados.md || null,
      dados.urgencia || null
    ]);

    solicitacaoId = getLastInsertId();

    (dados.itens || []).forEach(item => {
      runNoSave(`
        INSERT INTO solicitacao_itens (
          solicitacao_id, codigo_peca, descricao_peca,
          quantidade_solicitada, quantidade_estoque_no_momento, importacao
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        solicitacaoId,
        item.codigo,
        item.descricao || null,
        item.quantidadeDesejada || 0,
        item.quantidadeEstoque || 0,
        item.importacao ? 1 : 0
      ]);
    });

    db.run('COMMIT');
    saveDb();
    return solicitacaoId;
  } catch (error) {
    try { db.run('ROLLBACK'); } catch (_) {}
    throw error;
  }
}

function verificarRedundancia(cliente, modelo, codigoPeca) {
  const row = queryOne(`
    SELECT s.tecnico_nome, s.criada_em
    FROM solicitacoes s
    JOIN solicitacao_itens si ON s.id = si.solicitacao_id
    WHERE s.cliente = ?
      AND s.modelo = ?
      AND si.codigo_peca = ?
      AND s.criada_em >= date('now', '-15 days')
      AND s.status_envio != 'cancelado'
    ORDER BY s.criada_em DESC
    LIMIT 1
  `, [cliente, modelo, codigoPeca]);
  return row;
}

function buscarPedidoPorId(id) {
  return queryOne(`
    SELECT * FROM solicitacoes
    WHERE id = ?
  `, [id]);
}

// ==========================================
// FUNCOES DE BACKOFFICE (CONDADO)
// ==========================================

function criarUsuarioBO(usuario, senhaHash) {
  run(`
    INSERT INTO usuarios_bo (usuario, senha_hash, criado_em)
    VALUES (?, ?, ?)
  `, [usuario, senhaHash, new Date().toISOString()]);
}

function buscarUsuarioBO(usuario) {
  return queryOne('SELECT * FROM usuarios_bo WHERE usuario = ?', [usuario]);
}

function buscarPedidos() {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT s.*, 
           json_group_array(json_object(
             'codigo_peca', i.codigo_peca,
             'descricao_peca', i.descricao_peca,
             'quantidade', i.quantidade_solicitada
           )) as itens
    FROM solicitacoes s
    LEFT JOIN solicitacao_itens i ON s.id = i.solicitacao_id
    GROUP BY s.id
    ORDER BY s.criada_em DESC
  `);
  
  const pedidos = [];
  while(stmt.step()) {
    const row = stmt.getAsObject();
    row.itens = parseJsonArray(row.itens);
    pedidos.push(row);
  }
  stmt.free();
  return pedidos;
}

function atualizarStatusPedido(id, status, extra = {}) {
  const { numero_orcamento, numero_pedido_protheus, nota_fiscal } = extra;
  
  let query = 'UPDATE solicitacoes SET status_pedido = ?';
  const params = [status];
  
  if (numero_orcamento !== undefined && numero_orcamento !== null) {
    query += ', numero_orcamento = ?';
    params.push(numero_orcamento);
  }
  
  if (status === 'FINALIZADO') {
    query += ', finalizado_em = ?';
    params.push(new Date().toISOString());
  }
  
  if (numero_pedido_protheus !== undefined && numero_pedido_protheus !== null) {
    query += ', numero_pedido_protheus = ?';
    params.push(numero_pedido_protheus);
  }
  
  if (nota_fiscal !== undefined && nota_fiscal !== null) {
    query += ', nota_fiscal = ?';
    params.push(nota_fiscal);
  }
  
  query += ' WHERE id = ?';
  params.push(id);
  
  run(query, params);
}

function atualizarOrcamentoPedido(id, orcamento) {
  run('UPDATE solicitacoes SET numero_orcamento = ? WHERE id = ?', [orcamento, id]);
}

function atualizarPedidoProtheus(id, pedidoProtheus) {
  run('UPDATE solicitacoes SET numero_pedido_protheus = ? WHERE id = ?', [pedidoProtheus, id]);
}

function baixarPedido(id, responsavel) {
  run(`
    UPDATE solicitacoes 
    SET status_pedido = 'EM_ANALISE', 
        responsavel_baixa = ? 
    WHERE id = ?
  `, [responsavel, id]);
}

function obterTodasReposicoesPendentes() {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT 
      s.id,
      s.tecnico_nome,
      s.telefone_tecnico AS tecnico_telefone,
      s.cliente,
      s.criada_em,
      s.status_pedido,
      s.modelo AS contrato_tipo,
      i.codigo_peca,
      i.descricao_peca,
      i.quantidade_solicitada AS quantidade
    FROM solicitacoes s
    JOIN solicitacao_itens i ON s.id = i.solicitacao_id
    WHERE (s.modelo LIKE '%CIF%' OR s.modelo LIKE '%CAREPACK%')
      AND s.status_pedido NOT IN ('FINALIZADOS', 'FINALIZADO', 'CANCELADO')
      AND (i.importacao = 0 OR i.importacao IS NULL)
    ORDER BY s.criada_em ASC
  `);
  
  const pendencias = [];
  while(stmt.step()) {
    pendencias.push(stmt.getAsObject());
  }
  stmt.free();
  return pendencias;
}

function buscarReposicoesPendentesTecnico(tecnico_nome) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT i.id, i.codigo_peca, i.descricao_peca, s.cliente, s.modelo, s.finalizado_em
    FROM solicitacao_itens i
    JOIN solicitacoes s ON i.solicitacao_id = s.id
    WHERE s.status_pedido = 'FINALIZADO'
      AND i.status_reposicao = 'PENDENTE'
      AND s.tecnico_nome = ?
      AND (s.modelo LIKE '%CIF%' OR s.modelo LIKE '%CAREPACK%')
      AND (i.importacao = 0 OR i.importacao IS NULL)
    ORDER BY s.finalizado_em ASC
  `);
  stmt.bind([tecnico_nome]);
  const pendencias = [];
  while(stmt.step()) pendencias.push(stmt.getAsObject());
  stmt.free();
  return pendencias;
}

function buscarTodasReposicoesPendentesCron() {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT i.id, i.codigo_peca, i.descricao_peca, s.cliente, s.modelo, s.finalizado_em, s.tecnico_nome, s.telefone_tecnico
    FROM solicitacao_itens i
    JOIN solicitacoes s ON i.solicitacao_id = s.id
    WHERE s.status_pedido = 'FINALIZADO'
      AND i.status_reposicao = 'PENDENTE'
      AND (s.modelo LIKE '%CIF%' OR s.modelo LIKE '%CAREPACK%')
      AND s.finalizado_em IS NOT NULL
      AND (i.importacao = 0 OR i.importacao IS NULL)
  `);
  const pendencias = [];
  while(stmt.step()) pendencias.push(stmt.getAsObject());
  stmt.free();
  return pendencias;
}

function baixarReposicao(item_id) {
  run('UPDATE solicitacao_itens SET status_reposicao = ? WHERE id = ?', ['SOLICITADA_FABRICANTE', item_id]);
}

// --- Funções da Agenda ---

function obterAgendamentos(dataInicio, dataFim) {
  const db = getDb();
  let sql = 'SELECT * FROM agendamentos';
  const params = [];
  
  if (dataInicio && dataFim) {
    sql += ' WHERE data_agendamento >= ? AND data_agendamento <= ?';
    params.push(dataInicio, dataFim);
  }
  sql += ' ORDER BY data_agendamento ASC, start_time ASC';
  
  const stmt = db.prepare(sql);
  const agendamentos = [];
  try {
    stmt.bind(params);
    while(stmt.step()) agendamentos.push(stmt.getAsObject());
  } finally {
    stmt.free();
  }
  return agendamentos;
}

function validarConflitoAgendamento(tecnico_nome, data_agendamento, start_time, end_time, ignore_id = null) {
  const agendamentosDia = obterAgendamentos(data_agendamento, data_agendamento)
    .filter(a => a.tecnico_nome === tecnico_nome && a.id !== ignore_id);
    
  for (const a of agendamentosDia) {
    if (start_time < a.end_time && a.start_time < end_time) {
      throw new Error(`O técnico já possui um agendamento conflitante neste dia (${a.start_time.substring(0,5)} às ${a.end_time.substring(0,5)}).`);
    }
  }
}

function adicionarAgendamento(dados) {
  validarConflitoAgendamento(dados.tecnico_nome, dados.data_agendamento, dados.start_time, dados.end_time);

  run(
    'INSERT INTO agendamentos (tecnico_nome, cliente, start_time, end_time, data_agendamento, status, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      dados.tecnico_nome,
      dados.cliente,
      dados.start_time,
      dados.end_time,
      dados.data_agendamento,
      dados.status,
      new Date().toISOString()
    ]
  );
  return getLastInsertId();
}

function atualizarDiaAgendamento(id, nova_data) {
  const row = queryOne('SELECT * FROM agendamentos WHERE id = ?', [id]);
  if (row) {
    validarConflitoAgendamento(row.tecnico_nome, nova_data, row.start_time, row.end_time, id);
  }
  run('UPDATE agendamentos SET data_agendamento = ? WHERE id = ?', [nova_data, id]);
}

function removerAgendamento(id) {
  run('DELETE FROM agendamentos WHERE id = ?', [id]);
}


module.exports = {
  criarSessao,
  obterSessaoAtiva,
  atualizarEstadoSessao,
  atualizarDadosCliente,
  atualizarModeloSessao,
  atualizarItensSessao,
  encerrarSessao,
  encerrarTodasSessoesAtivas,
  registrarConsulta,
  registrarSolicitacao,
  criarUsuarioBO,
  buscarUsuarioBO,
  buscarPedidos,
  atualizarStatusPedido,
  atualizarOrcamentoPedido,
  atualizarPedidoProtheus,
  atualizarTentativasBusca,
  atualizarDadosCheckout,
  verificarRedundancia,
  buscarPedidoPorId,
  baixarPedido,
  obterTodasReposicoesPendentes,
  buscarReposicoesPendentesTecnico,
  buscarTodasReposicoesPendentesCron,
  baixarReposicao,
  obterAgendamentos,
  adicionarAgendamento,
  atualizarDiaAgendamento,
  removerAgendamento
};
