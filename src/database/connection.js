const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const xlsx = require('xlsx');

const dbPath = path.resolve('./data/database.sqlite');
const jsonBackupPath = path.resolve('./data/database.json');
let db = null;

async function initDatabase() {
  console.log('Inicializando banco de dados SQLite...');

  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');
  criarTabelas();
  migrarSchemaDescricao();
  migrarSchemaCondado();
  migrarSchemaCheckout();
  migrarSchemaBackoffice();
  migrarSchemaNotaFiscal();
  migrarSchemaImportacao();
  migrarSchemaImportacaoSplit();
  migrarSchemaParcial();
  migrarSchemaAgenda();
  migrarSchemaRequisicoes();
  migrarJsonSeNecessario();
  inicializarJigsETecnicos();
  saveDb();

  console.log(`Banco de dados SQLite conectado em: ${dbPath}`);
}

function criarTabelas() {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefone TEXT NOT NULL,
      tecnico_nome TEXT NOT NULL,
      cliente TEXT,
      modelo TEXT,
      modelos_cliente TEXT NOT NULL DEFAULT '[]',
      estado TEXT NOT NULL,
      itens_consultados TEXT NOT NULL DEFAULT '[]',
      ativa INTEGER NOT NULL DEFAULT 1,
      criada_em TEXT NOT NULL,
      atualizada_em TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessoes_telefone_ativa
      ON sessoes (telefone, ativa, atualizada_em);

    CREATE TABLE IF NOT EXISTS consultas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessao_id INTEGER,
      tipo_consulta TEXT NOT NULL,
      termo_buscado TEXT NOT NULL,
      resultado TEXT NOT NULL,
      codigo_peca TEXT,
      descricao_peca TEXT,
      quantidade_estoque INTEGER NOT NULL DEFAULT 0,
      criada_em TEXT NOT NULL,
      FOREIGN KEY (sessao_id) REFERENCES sessoes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_consultas_criada_em
      ON consultas (criada_em);

    CREATE TABLE IF NOT EXISTS solicitacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessao_id INTEGER,
      tecnico_nome TEXT NOT NULL,
      cliente TEXT NOT NULL,
      modelo TEXT,
      status_envio TEXT NOT NULL,
      criada_em TEXT NOT NULL,
      FOREIGN KEY (sessao_id) REFERENCES sessoes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_solicitacoes_criada_em
      ON solicitacoes (criada_em);
    CREATE INDEX IF NOT EXISTS idx_solicitacoes_cliente
      ON solicitacoes (cliente);
    CREATE INDEX IF NOT EXISTS idx_solicitacoes_modelo
      ON solicitacoes (modelo);

    CREATE TABLE IF NOT EXISTS solicitacao_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitacao_id INTEGER NOT NULL,
      codigo_peca TEXT NOT NULL,
      descricao_peca TEXT,
      quantidade_solicitada INTEGER NOT NULL,
      quantidade_estoque_no_momento INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_solicitacao_itens_codigo
      ON solicitacao_itens (codigo_peca);

    CREATE TABLE IF NOT EXISTS usuarios_bo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jigs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_hp TEXT NOT NULL UNIQUE,
      descricao TEXT,
      cod_cp TEXT,
      status TEXT NOT NULL DEFAULT 'disponivel',
      tecnico_posse TEXT,
      cliente TEXT,
      data_retirada TEXT
    );

    CREATE TABLE IF NOT EXISTS tecnicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT,
      mala TEXT
    );

    CREATE TABLE IF NOT EXISTS backoffice (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      email TEXT,
      acesso TEXT
    );

    CREATE TABLE IF NOT EXISTS historico_jigs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jig_id INTEGER NOT NULL,
      tecnico_nome TEXT NOT NULL,
      cliente TEXT,
      acao TEXT NOT NULL,
      data_hora TEXT NOT NULL,
      FOREIGN KEY (jig_id) REFERENCES jigs(id)
    );

    CREATE TABLE IF NOT EXISTS requisicoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitacao_id INTEGER,
      numero_requisicao TEXT NOT NULL,
      codigo_peca TEXT,
      descricao_peca TEXT,
      quantidade INTEGER NOT NULL DEFAULT 1,
      mala TEXT,
      tecnico_nome TEXT,
      cliente TEXT,
      maquina TEXT,
      valor_peca REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      criada_em TEXT NOT NULL,
      nota_fiscal TEXT,
      numero_retorno TEXT,
      FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes(id)
    );
  `);
}

function listarColunas(tabela) {
  const result = db.exec(`PRAGMA table_info(${tabela})`);
  if (!result.length) return [];
  return result[0].values.map(row => row[1]);
}

function migrarSchemaDescricao() {
  const colunasConsultas = listarColunas('consultas');
  if (colunasConsultas.length && !colunasConsultas.includes('descricao_peca')) {
    db.run('ALTER TABLE consultas ADD COLUMN descricao_peca TEXT');
    if (colunasConsultas.includes('descricao_peca_pt')) {
      db.run('UPDATE consultas SET descricao_peca = descricao_peca_pt WHERE descricao_peca IS NULL');
    }
  }

  const colunasItens = listarColunas('solicitacao_itens');
  if (colunasItens.length && !colunasItens.includes('descricao_peca')) {
    db.run('ALTER TABLE solicitacao_itens ADD COLUMN descricao_peca TEXT');
    if (colunasItens.includes('descricao_peca_pt')) {
      db.run('UPDATE solicitacao_itens SET descricao_peca = descricao_peca_pt WHERE descricao_peca IS NULL');
    }
  }
}

function migrarSchemaCondado() {
  const colunasSolicitacoes = listarColunas('solicitacoes');
  if (colunasSolicitacoes.length) {
    if (!colunasSolicitacoes.includes('telefone_tecnico')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN telefone_tecnico TEXT');
    }
    if (!colunasSolicitacoes.includes('status_pedido')) {
      db.run("ALTER TABLE solicitacoes ADD COLUMN status_pedido TEXT DEFAULT 'EM_ANALISE'");
    }
    if (!colunasSolicitacoes.includes('numero_orcamento')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN numero_orcamento TEXT');
    }
    if (!colunasSolicitacoes.includes('numero_pedido_protheus')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN numero_pedido_protheus TEXT');
    }
  }
}

function migrarSchemaCheckout() {
  const colunasSessoes = listarColunas('sessoes');
  if (colunasSessoes.length) {
    if (!colunasSessoes.includes('tentativas_busca')) {
      db.run('ALTER TABLE sessoes ADD COLUMN tentativas_busca INTEGER DEFAULT 0');
    }
    if (!colunasSessoes.includes('motivo')) {
      db.run('ALTER TABLE sessoes ADD COLUMN motivo TEXT');
    }
    if (!colunasSessoes.includes('md')) {
      db.run('ALTER TABLE sessoes ADD COLUMN md TEXT');
    }
    if (!colunasSessoes.includes('urgencia')) {
      db.run('ALTER TABLE sessoes ADD COLUMN urgencia TEXT');
    }
  }

  const colunasSolicitacoes = listarColunas('solicitacoes');
  if (colunasSolicitacoes.length) {
    if (!colunasSolicitacoes.includes('motivo')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN motivo TEXT');
    }
    if (!colunasSolicitacoes.includes('md')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN md TEXT');
    }
    if (!colunasSolicitacoes.includes('urgencia')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN urgencia TEXT');
    }
    if (!colunasSolicitacoes.includes('responsavel_baixa')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN responsavel_baixa TEXT');
    }
    if (!colunasSolicitacoes.includes('finalizado_em')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN finalizado_em TEXT');
    }
  }
  
  const colunasItens = listarColunas('solicitacao_itens');
  if (colunasItens.length && !colunasItens.includes('status_reposicao')) {
    db.run("ALTER TABLE solicitacao_itens ADD COLUMN status_reposicao TEXT DEFAULT 'PENDENTE'");
  }
}

function migrarSchemaBackoffice() {
  const colunas = listarColunas('backoffice');
  if (colunas.length > 0 && !colunas.includes('acesso')) {
    db.run('ALTER TABLE backoffice ADD COLUMN acesso TEXT');
  }
}

function migrarSchemaNotaFiscal() {
  const colunas = listarColunas('solicitacoes');
  if (colunas.length > 0 && !colunas.includes('nota_fiscal')) {
    db.run('ALTER TABLE solicitacoes ADD COLUMN nota_fiscal TEXT');
  }
}

function migrarSchemaImportacao() {
  const colunasItens = listarColunas('solicitacao_itens');
  if (colunasItens.length > 0 && !colunasItens.includes('importacao')) {
    db.run('ALTER TABLE solicitacao_itens ADD COLUMN importacao INTEGER DEFAULT 0');
  }
}

function migrarSchemaImportacaoSplit() {
  const colunas = listarColunas('solicitacoes');
  if (colunas.length > 0) {
    if (!colunas.includes('parent_id')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN parent_id INTEGER');
    }
    if (!colunas.includes('is_importacao')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN is_importacao INTEGER DEFAULT 0');
    }
    if (!colunas.includes('po')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN po TEXT');
    }
    if (!colunas.includes('eta')) {
      db.run('ALTER TABLE solicitacoes ADD COLUMN eta TEXT');
    }
  }
}

function migrarSchemaParcial() {
  const colunas = listarColunas('solicitacoes');
  if (colunas.length > 0 && !colunas.includes('is_parcial')) {
    db.run('ALTER TABLE solicitacoes ADD COLUMN is_parcial INTEGER DEFAULT 0');
  }
}

function migrarSchemaAgenda() {
  db.run(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tecnico_nome TEXT NOT NULL,
      cliente TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      data_agendamento TEXT NOT NULL,
      status TEXT NOT NULL,
      criado_em TEXT NOT NULL
    );
  `);
}

function migrarSchemaRequisicoes() {
  const colunasTecnicos = listarColunas('tecnicos');
  if (colunasTecnicos.length > 0 && !colunasTecnicos.includes('mala')) {
    db.run('ALTER TABLE tecnicos ADD COLUMN mala TEXT');
  }

  const colunasSolicitacoes = listarColunas('solicitacoes');
  if (colunasSolicitacoes.length > 0 && !colunasSolicitacoes.includes('tag_requisicao')) {
    db.run('ALTER TABLE solicitacoes ADD COLUMN tag_requisicao TEXT');
  }
}

function getScalar(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (!stmt.step()) return null;
    const row = stmt.getAsObject();
    return Object.values(row)[0];
  } finally {
    stmt.free();
  }
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.run(params);
  } finally {
    stmt.free();
  }
}

function migrarJsonSeNecessario() {
  if (!fs.existsSync(jsonBackupPath)) return;

  const totalSessoes = getScalar('SELECT COUNT(*) AS total FROM sessoes') || 0;
  const totalConsultas = getScalar('SELECT COUNT(*) AS total FROM consultas') || 0;
  const totalSolicitacoes = getScalar('SELECT COUNT(*) AS total FROM solicitacoes') || 0;

  if (totalSessoes > 0 || totalConsultas > 0 || totalSolicitacoes > 0) return;

  try {
    const legado = JSON.parse(fs.readFileSync(jsonBackupPath, 'utf-8'));
    db.run('BEGIN TRANSACTION');

    (legado.sessoes || []).forEach(s => {
      run(`
        INSERT INTO sessoes (
          id, telefone, tecnico_nome, cliente, modelo, modelos_cliente, estado,
          itens_consultados, ativa, criada_em, atualizada_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        s.id,
        s.telefone,
        s.tecnico_nome || 'Desconhecido',
        s.cliente || null,
        s.modelo || null,
        JSON.stringify(s.modelos_cliente || []),
        s.estado || 'menu',
        JSON.stringify(s.itens_consultados || []),
        s.ativa === false ? 0 : 1,
        s.criada_em || new Date().toISOString(),
        s.atualizada_em || new Date().toISOString()
      ]);
    });

    (legado.consultas || []).forEach(c => {
      run(`
        INSERT INTO consultas (
          id, sessao_id, tipo_consulta, termo_buscado, resultado, codigo_peca,
          descricao_peca, quantidade_estoque, criada_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        c.id,
        c.sessao_id || null,
        c.tipo_consulta || 'indefinido',
        c.termo_buscado || '',
        c.resultado || 'indefinido',
        c.codigo_peca || null,
        c.descricao_peca || c.descricao_peca_pt || null,
        c.quantidade_estoque || 0,
        c.criada_em || new Date().toISOString()
      ]);
    });

    (legado.solicitacoes || []).forEach(s => {
      run(`
        INSERT INTO solicitacoes (
          id, sessao_id, tecnico_nome, cliente, modelo, status_envio, criada_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        s.id,
        s.sessao_id || null,
        s.tecnico_nome || 'Desconhecido',
        s.cliente || 'Nao informado',
        s.modelo || null,
        s.status_envio || 'enviado',
        s.criada_em || new Date().toISOString()
      ]);

      (s.itens || []).forEach(item => {
        run(`
          INSERT INTO solicitacao_itens (
            solicitacao_id, codigo_peca, descricao_peca,
            quantidade_solicitada, quantidade_estoque_no_momento
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          s.id,
          item.codigo,
          item.descricao || item.descricao_pt || null,
          item.quantidadeDesejada || 0,
          item.quantidadeEstoque || 0
        ]);
      });
    });

    db.run('COMMIT');
    console.log('Dados antigos de database.json migrados para SQLite.');
  } catch (error) {
    try { db.run('ROLLBACK'); } catch (_) {}
    console.warn(`Nao foi possivel migrar database.json automaticamente: ${error.message}`);
  }
}

function inicializarJigsETecnicos() {
  const totalJigs = getScalar('SELECT COUNT(*) AS total FROM jigs') || 0;
  if (totalJigs === 0) {
    const jigsPath = path.resolve('./data/jigs.xlsx');
    if (fs.existsSync(jigsPath)) {
      console.log('Inicializando tabela jigs a partir do Excel...');
      try {
        const wb = xlsx.readFile(jigsPath);
        const sheetName = wb.SheetNames[0]; // Assume first sheet is LISTA JIGS
        const dados = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
        
        db.run('BEGIN TRANSACTION');
        dados.forEach(row => {
          if (row['CÓDIGO HP']) {
            run(`
              INSERT INTO jigs (codigo_hp, descricao, cod_cp)
              VALUES (?, ?, ?)
            `, [
              String(row['CÓDIGO HP']).trim(),
              row['DESCRIÇÃO'] ? String(row['DESCRIÇÃO']).trim() : null,
              row['CÓD. CP'] ? String(row['CÓD. CP']).trim() : null
            ]);
          }
        });
        db.run('COMMIT');
        console.log('Tabela jigs inicializada com sucesso.');
      } catch (e) {
        try { db.run('ROLLBACK'); } catch (_) {}
        console.error('Erro ao inicializar jigs:', e.message);
      }
    }
  }

  const tecnicosPath = path.resolve('./data/tecnicos.xlsx');
  if (fs.existsSync(tecnicosPath)) {
    console.log('Inicializando/Atualizando tabela tecnicos a partir do Excel...');
    try {
      const wb = xlsx.readFile(tecnicosPath);
      const sheetName = wb.SheetNames[0];
      const dados = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
      
      db.run('BEGIN TRANSACTION');
      db.run('DELETE FROM tecnicos');

        dados.forEach(row => {
          if (row['NOME']) {
            run(`
              INSERT INTO tecnicos (nome, telefone, email, mala)
              VALUES (?, ?, ?, ?)
            `, [
              String(row['NOME']).trim(),
              row['TELEFONE'] ? String(row['TELEFONE']).trim() : null,
              row['EMAIL'] ? String(row['EMAIL']).trim() : null,
              row['MALA'] ? String(row['MALA']).trim() : null
            ]);
          }
        });
        db.run('COMMIT');
        console.log('Tabela tecnicos inicializada com sucesso.');
      } catch (e) {
        try { db.run('ROLLBACK'); } catch (_) {}
        console.error('Erro ao inicializar tecnicos:', e.message);
      }
    }

  const totalBackoffice = getScalar('SELECT COUNT(*) AS total FROM backoffice') || 0;
  if (totalBackoffice === 0) {
    const backofficePath = path.join(__dirname, '../../data/backoffice/backoffice.xlsx');
    if (fs.existsSync(backofficePath)) {
      console.log('Inicializando tabela backoffice a partir do Excel...');
      try {
        const wb = xlsx.readFile(backofficePath);
        const sheetName = wb.SheetNames[0];
        const dados = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
        
        db.run('BEGIN TRANSACTION');
        dados.forEach(row => {
          if (row['NOME']) {
            run(`
              INSERT INTO backoffice (nome, telefone, email, acesso)
              VALUES (?, ?, ?, ?)
            `, [
              String(row['NOME']).trim(),
              row['TELEFONE'] ? String(row['TELEFONE']).trim() : null,
              row['EMAIL'] ? String(row['EMAIL']).trim() : null,
              row['ACESSO'] ? String(row['ACESSO']).trim() : null
            ]);
          }
        });
        db.run('COMMIT');
        console.log('Tabela backoffice inicializada com sucesso.');
      } catch (e) {
        try { db.run('ROLLBACK'); } catch (_) {}
        console.error('Erro ao inicializar backoffice:', e.message);
      }
    }
  }
}

function getDb() {
  if (!db) {
    throw new Error('Banco de dados nao foi inicializado. Chame initDatabase() primeiro.');
  }
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

module.exports = {
  initDatabase,
  getDb,
  saveDb
};


