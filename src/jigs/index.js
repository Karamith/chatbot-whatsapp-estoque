const { getDb, saveDb } = require('../database/connection');

function runAndSave(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.run(params);
    saveDb();
  } finally {
    stmt.free();
  }
}

function queryAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  const results = [];
  try {
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
  } finally {
    stmt.free();
  }
  return results;
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

function registrarHistorico(jigId, tecnicoNome, cliente, acao) {
  runAndSave(`
    INSERT INTO historico_jigs (jig_id, tecnico_nome, cliente, acao, data_hora)
    VALUES (?, ?, ?, ?, ?)
  `, [
    jigId,
    tecnicoNome,
    cliente || null,
    acao,
    new Date().toISOString()
  ]);
}

/**
 * Retorna todas as JIGs disponíveis
 */
function buscarJigsDisponiveis() {
  return queryAll(`
    SELECT * FROM jigs 
    WHERE status = 'disponivel'
    ORDER BY codigo_hp ASC
  `);
}

/**
 * Busca todas as JIGs independentemente do status
 */
function buscarTodasJigs() {
  return queryAll(`
    SELECT * FROM jigs 
    ORDER BY codigo_hp ASC
  `);
}

/**
 * Busca todas as JIGs que estão em posse de um determinado técnico
 */
function buscarJigsDoTecnico(tecnico) {
  return queryAll(`
    SELECT * FROM jigs 
    WHERE status = 'em_uso' AND tecnico_posse = ?
  `, [tecnico]);
}

/**
 * Busca uma JIG pelo código HP
 */
function buscarJigPorCodigo(codigo) {
  return queryOne(`
    SELECT * FROM jigs 
    WHERE codigo_hp = ?
  `, [codigo.trim().toUpperCase()]);
}

/**
 * Requista uma JIG
 */
function requisitarJig(codigo, tecnicoNome, cliente) {
  const jig = buscarJigPorCodigo(codigo);
  
  if (!jig) {
    throw new Error('JIG não encontrada.');
  }
  
  if (jig.status !== 'disponivel') {
    throw new Error(`Esta JIG já está em uso por: ${jig.tecnico_posse}`);
  }

  runAndSave(`
    UPDATE jigs
    SET status = 'em_uso',
        tecnico_posse = ?,
        cliente = ?,
        data_retirada = ?
    WHERE id = ?
  `, [
    tecnicoNome,
    cliente,
    new Date().toISOString(),
    jig.id
  ]);

  registrarHistorico(jig.id, tecnicoNome, cliente, 'REQUISITAR');
  
  return true;
}

/**
 * Devolve uma JIG
 */
function devolverJig(codigo, tecnicoNome) {
  const jig = buscarJigPorCodigo(codigo);
  
  if (!jig) {
    throw new Error('JIG não encontrada.');
  }
  
  if (jig.status === 'disponivel') {
    throw new Error('Esta JIG já consta como disponível.');
  }

  // Verifica se o técnico logado é o mesmo que retirou, mas permite a devolução de qualquer forma?
  // O ideal é registrar quem está devolvendo.

  runAndSave(`
    UPDATE jigs
    SET status = 'disponivel',
        tecnico_posse = NULL,
        cliente = NULL,
        data_retirada = NULL
    WHERE id = ?
  `, [jig.id]);

  registrarHistorico(jig.id, tecnicoNome, null, 'DEVOLVER');
  
  return true;
}

/**
 * Busca as JIGs atualmente em posse de um técnico
 */
function buscarJigsEmPosse(tecnicoNome) {
  return queryAll(`
    SELECT * FROM jigs 
    WHERE status = 'em_uso' AND tecnico_posse = ?
  `, [tecnicoNome]);
}

/**
 * Busca um técnico pelo número de telefone
 */
function buscarTecnicoPorTelefone(telefone) {
  const row = queryOne(`
    SELECT * FROM tecnicos 
    WHERE telefone = ?
  `, [telefone.replace(/[^0-9]/g, '')]); // limpa formatação
  return row;
}

/**
 * Busca um membro do backoffice pelo número de telefone
 */
function buscarBackofficePorTelefone(telefone) {
  const row = queryOne(`
    SELECT * FROM backoffice 
    WHERE telefone = ?
  `, [telefone.replace(/[^0-9]/g, '')]);
  return row;
}

/**
 * Retorna todos os telefones do backoffice
 */
function buscarTodosBackoffice() {
  return queryAll(`SELECT * FROM backoffice`);
}

module.exports = {
  buscarTecnicoPorTelefone,
  buscarBackofficePorTelefone,
  buscarTodosBackoffice,
  buscarTodasJigs,
  buscarJigsDisponiveis,
  buscarJigPorCodigo,
  buscarJigsDoTecnico,
  requisitarJig,
  devolverJig,
  buscarJigsEmPosse
};
