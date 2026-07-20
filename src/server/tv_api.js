const { getDb } = require('../database/connection');
const jwt = require('jsonwebtoken');
const config = require('../config');

function setupApi(app) {
  const tvAuth = (req, res, next) => {
    const key = req.query.key || req.headers['x-api-key'];
    const expectedKey = config.TV_API_KEY;
    if (process.env.NODE_ENV === 'production' && key !== expectedKey) {
      return res.status(401).json({ error: 'Acesso negado. Chave de API invalida.' });
    }
    next();
  };

  app.get('/api/kpis', tvAuth, (req, res) => {
    try {
      const db = getDb();

      function getScalar(sql, params = []) {
        const stmt = db.prepare(sql);
        try {
          stmt.bind(params);
          if (stmt.step()) return Object.values(stmt.getAsObject())[0] || 0;
          return 0;
        } finally {
          stmt.free();
        }
      }

      // 1. Total Solicitacoes Realizadas (Historico)
      const totalPedidos = getScalar("SELECT COUNT(*) as total FROM solicitacoes");
      
      // 2. Total de Pedidos Baixados
      const totalBaixados = getScalar("SELECT COUNT(*) as total FROM solicitacoes WHERE status_pedido = 'FINALIZADO'");

      // 3. Pedidos Hoje
      const totalHoje = getScalar("SELECT COUNT(*) as total FROM solicitacoes WHERE date(criada_em) = date('now', 'localtime')");

      // 4. Pedidos na Fila (Pendentes)
      const totalFila = getScalar("SELECT COUNT(*) as total FROM solicitacoes WHERE status_pedido != 'FINALIZADO'");

      // 4.1. Pedidos em MD na Fila
      const totalMD = getScalar("SELECT COUNT(*) as total FROM solicitacoes WHERE status_pedido != 'FINALIZADO' AND (md = 'Sim' OR md = '1' OR em_md = 'sim')");

      // 5. Volume de Pecas Solicitadas (Ultimos 30 dias)
      const totalPecas = getScalar(`
        SELECT SUM(si.quantidade_solicitada) as total 
        FROM solicitacao_itens si 
        JOIN solicitacoes s ON si.solicitacao_id = s.id 
        WHERE s.criada_em >= date('now', '-30 days')
      `);

      // 4. Ranking Top Peças
      const stmtPecas = db.prepare(`
        SELECT codigo_peca, descricao_peca, SUM(quantidade_solicitada) as total 
        FROM solicitacao_itens 
        GROUP BY codigo_peca, descricao_peca 
        ORDER BY total DESC 
        LIMIT 5
      `);
      const topPecas = [];
      while(stmtPecas.step()) topPecas.push(stmtPecas.getAsObject());
      stmtPecas.free();

      // 5. Ranking Top Equipamentos
      const stmtEquipamentos = db.prepare(`
        SELECT s.modelo, SUM(si.quantidade_solicitada) as total_pecas
        FROM solicitacoes s
        JOIN solicitacao_itens si ON s.id = si.solicitacao_id
        WHERE s.modelo IS NOT NULL AND s.modelo != ''
        GROUP BY s.modelo
        ORDER BY total_pecas DESC 
        LIMIT 5
      `);
      const topEquipamentos = [];
      while(stmtEquipamentos.step()) topEquipamentos.push(stmtEquipamentos.getAsObject());
      stmtEquipamentos.free();

      // 6. Ranking Top Clientes (Baseado no volume de pecas)
      const stmtClientes = db.prepare(`
        SELECT s.cliente, SUM(si.quantidade_solicitada) as total_pecas 
        FROM solicitacoes s
        JOIN solicitacao_itens si ON s.id = si.solicitacao_id
        GROUP BY s.cliente 
        ORDER BY total_pecas DESC 
        LIMIT 5
      `);
      const topClientes = [];
      while(stmtClientes.step()) topClientes.push(stmtClientes.getAsObject());
      stmtClientes.free();

      // 7. Pedidos Baixados Hoje (Usando criada_em ou atualizada_em como placeholder se não houver data_baixa)
      const totalBaixadosHoje = getScalar("SELECT COUNT(*) as total FROM solicitacoes WHERE status_pedido = 'FINALIZADO'");

      // 7.1. JIGs Atuais Emprestados (Mocado por enquanto)
      const jigsEmprestados = 0;

      // 8. Lista Completa de JIGs para a Tabela
      const listaJigs = [];

      // 9. Pedidos pendentes em Máquina Parada (MD) para o Ticker
      const stmtMd = db.prepare(`
        SELECT cliente, modelo
        FROM solicitacoes
        WHERE (md = 'Sim' OR md = '1' OR em_md = 'sim') 
          AND (
            ( (UPPER(IFNULL(modelo, '')) LIKE '%VENDA%' OR UPPER(IFNULL(modelo, '')) LIKE '%CAREPACK%') AND status_pedido IN ('PENDENTE', 'EM_ANALISE', 'ORCAMENTO_ENVIADO') )
            OR ( UPPER(IFNULL(modelo, '')) LIKE '%CIF%' AND status_pedido IN ('PENDENTE', 'EM_ANALISE', 'ORCAMENTO_ENVIADO', 'APROVADO') )
            OR ( UPPER(IFNULL(modelo, '')) NOT LIKE '%VENDA%' AND UPPER(IFNULL(modelo, '')) NOT LIKE '%CAREPACK%' AND UPPER(IFNULL(modelo, '')) NOT LIKE '%CIF%' AND status_pedido = 'PENDENTE' )
          )
      `);
      const mdTickerData = [];
      while(stmtMd.step()) mdTickerData.push(stmtMd.getAsObject());
      stmtMd.free();

      // 10. Lista de Pedidos Pendentes para a Nova Tabela (Visão Geral)
      const stmtPendentes = db.prepare(`
        SELECT id, cliente, tecnico_nome 
        FROM solicitacoes 
        WHERE status_pedido != 'FINALIZADO'
        ORDER BY id ASC
      `);
      const pedidosPendentesList = [];
      while(stmtPendentes.step()) pedidosPendentesList.push(stmtPendentes.getAsObject());
      stmtPendentes.free();

      // 11. Peças em Diagnóstico (Mocado por enquanto)
      const pecasDiagnosticoList = [];

      // 12. Listas de pedidos por status (Kanban)
      const stmtPecasPendentes = db.prepare(`
        SELECT solicitacao_id, codigo_peca, descricao_peca, quantidade_solicitada 
        FROM solicitacao_itens 
        WHERE solicitacao_id IN (SELECT id FROM solicitacoes WHERE status_pedido != 'FINALIZADO')
      `);
      const pecasPorPedido = {};
      while(stmtPecasPendentes.step()) {
        const item = stmtPecasPendentes.getAsObject();
        if(!pecasPorPedido[item.solicitacao_id]) pecasPorPedido[item.solicitacao_id] = [];
        pecasPorPedido[item.solicitacao_id].push({
          codigo_peca: item.codigo_peca,
          descricao_peca: item.descricao_peca,
          quantidade_solicitada: item.quantidade_solicitada
        });
      }
      stmtPecasPendentes.free();

      const stmtTodos = db.prepare(`SELECT id, cliente, tecnico_nome, modelo AS equipamento, status_pedido, numero_orcamento, numero_pedido_protheus, nota_fiscal FROM solicitacoes ORDER BY id DESC`);
      const pedidosPorStatus = {
        'PENDENTE': [],
        'EM_ANALISE': [],
        'ORCAMENTO_ENVIADO': [],
        'APROVADO': [],
        'EM_PROCESSAMENTO': [],
        'FINALIZADO': []
      };
      
      while(stmtTodos.step()) {
        const p = stmtTodos.getAsObject();
        p.pecas_solicitadas = pecasPorPedido[p.id] || [];
        if(pedidosPorStatus[p.status_pedido] !== undefined) {
          pedidosPorStatus[p.status_pedido].push(p);
        }
      }
      stmtTodos.free();

      const statusCounts = {
        'PENDENTE': pedidosPorStatus['PENDENTE'].length,
        'EM_ANALISE': pedidosPorStatus['EM_ANALISE'].length,
        'ORCAMENTO_ENVIADO': pedidosPorStatus['ORCAMENTO_ENVIADO'].length,
        'APROVADO': pedidosPorStatus['APROVADO'].length,
        'EM_PROCESSAMENTO': pedidosPorStatus['EM_PROCESSAMENTO'].length,
        'FINALIZADO': pedidosPorStatus['FINALIZADO'].length
      };

      const agora = new Date();
      const pecasDiagnosticoFormatado = pecasDiagnosticoList.map(p => {
        const msDiff = agora - new Date(p.criada_em);
        const dias = Math.floor(msDiff / (1000 * 60 * 60 * 24));
        return {
          ...p,
          dias_diagnostico: dias
        };
      });

      res.json({
        success: true,
        data: {
          totalPedidos,
          totalBaixados,
          totalHoje,
          totalFila,
          totalMD,
          totalPecas,
          totalBaixadosHoje,
          topPecas,
          topEquipamentos,
          topClientes,
          jigsEmprestados,
          listaJigs,
          mdTickerData,
          pedidosPendentesList,
          pecasDiagnostico: pecasDiagnosticoFormatado,
          statusCounts,
          pedidosPorStatus
        }
      });
    } catch (err) {
      console.error("Erro na API de KPIs:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/instalacoes', tvAuth, (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const xlsx = require('xlsx');

      const excelPath = path.join(__dirname, '..', '..', 'Cronograma_instalacoes.xlsx');
      
      if (!fs.existsSync(excelPath)) {
        return res.json([]); 
      }

      const workbook = xlsx.readFile(excelPath, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      const agora = new Date();
      agora.setHours(0, 0, 0, 0);

      const instalacoes = data.map(row => {
        let status = 'programada';
        let progresso = 0;
        let diasRestantes = null;

        const getVal = (possibleKeys) => {
          const foundKey = Object.keys(row).find(k => possibleKeys.includes(k.trim().toLowerCase()));
          return foundKey ? row[foundKey] : null;
        };

        const cliente = getVal(['cliente', 'clientes', 'nome do cliente']);
        const equipamento = getVal(['equipamento', 'modelo', 'maquina', 'máquina']);
        const tecnicos = getVal(['tecnicos', 'técnicos', 'tecnico', 'técnico', 'responsável']);
        const statusExcel = getVal(['status', 'situação', 'situacao']);
        let dataPausa = getVal(['data pausa', 'data de pausa', 'pausado em']);

        const parseDate = (d) => {
          if (!d) return null;
          if (d instanceof Date) return d;
          // Tratamento para número serial do Excel (ex: 46174)
          if (!isNaN(d) && typeof d === 'number') {
            return new Date(Math.round((d - 25569) * 86400 * 1000));
          }
          const strD = d.toString();
          // Tratamento para número como string (ex: "46174")
          if (/^\d+$/.test(strD)) {
            return new Date(Math.round((parseInt(strD, 10) - 25569) * 86400 * 1000));
          }
          const partes = strD.split('/');
          if (partes.length === 3) return new Date(partes[2], partes[1] - 1, partes[0]);
          return new Date(d);
        };

        dataPausa = parseDate(dataPausa);

        const fasesDef = [
          { id: 'presite', label: 'Pre-site', chavesIni: ['inicio pre-site', 'início pre-site', 'pre-site inicio'], chavesFim: ['fim pre-site', 'pre-site fim'] },
          { id: 'instalacao', label: 'Instalação', chavesIni: ['inicio instalacao', 'início instalação', 'instalacao inicio'], chavesFim: ['fim instalacao', 'fim instalação', 'instalacao fim'] },
          { id: 'treinamento', label: 'Treinamento', chavesIni: ['inicio treinamento', 'início treinamento', 'treinamento inicio'], chavesFim: ['fim treinamento', 'treinamento fim'] },
          { id: 'rampup', label: 'Ramp up', chavesIni: ['inicio ramp up', 'início ramp up', 'ramp up inicio', 'inicio ramp-up'], chavesFim: ['fim ramp up', 'ramp up fim', 'fim ramp-up'] }
        ];

        let fases = [];
        let minDate = null;
        let maxDate = null;

        fasesDef.forEach(f => {
          let ini = parseDate(getVal(f.chavesIni));
          let fim = parseDate(getVal(f.chavesFim));
          
          if (ini && fim) {
            ini.setHours(0, 0, 0, 0);
            fim.setHours(23, 59, 59, 999);
            
            if (!minDate || ini < minDate) minDate = ini;
            if (!maxDate || fim > maxDate) maxDate = fim;

            fases.push({
              id: f.id,
              nome: f.label,
              inicio: ini,
              fim: fim,
              duracao: fim.getTime() - ini.getTime()
            });
          }
        });

        let dataInicio = minDate;
        let dataFim = maxDate;

        let statusNormalized = 'nao_iniciado';
        if (statusExcel) {
          const s = String(statusExcel).trim().toLowerCase();
          if (s.includes('concluíd') || s.includes('concluid') || s.includes('finaliz')) statusNormalized = 'finalizado';
          else if (s.includes('pausad')) statusNormalized = 'pausada';
          else if (s.includes('andamento') || s.includes('iniciad')) statusNormalized = 'andamento';
        }

        let faseAtivaNome = null;
        let progressoTotal = 0;

        if (statusNormalized === 'finalizado') {
           status = 'finalizado';
           progressoTotal = 100;
           faseAtivaNome = 'Concluído';
           fases.forEach(f => { f.progresso = 100; });
        } else if (statusNormalized === 'nao_iniciado' || fases.length === 0) {
           status = 'nao_iniciado';
           progressoTotal = 0;
           fases.forEach(f => { f.progresso = 0; });
           if (dataInicio && dataFim) {
              const diffTime = Math.abs(dataInicio - agora);
              diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
           }
        } else {
           let dataCalculo = agora;
           if (statusNormalized === 'pausada' && dataPausa) {
             dataPausa.setHours(0, 0, 0, 0);
             dataCalculo = dataPausa;
           }

           if (dataCalculo < dataInicio) {
              status = statusNormalized === 'pausada' ? 'pausada' : 'programada';
              progressoTotal = 0;
              fases.forEach(f => { f.progresso = 0; });
              const diffTime = Math.abs(dataInicio - dataCalculo);
              diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
           } else if (dataCalculo > dataFim) {
              status = statusNormalized === 'pausada' ? 'pausada' : 'atrasada';
              progressoTotal = 100;
              faseAtivaNome = 'Ramp up'; // Se passou de tudo, ficou preso no último
              fases.forEach(f => { f.progresso = 100; });
           } else {
              status = statusNormalized;
              const totalDuracao = dataFim.getTime() - dataInicio.getTime();
              const tempoDecorrido = dataCalculo.getTime() - dataInicio.getTime();
              progressoTotal = (tempoDecorrido / totalDuracao) * 100;
              
              const diffTime = Math.abs(dataFim - dataCalculo);
              diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              // Calcula o progresso de cada fase e encontra a fase ativa
              fases.forEach(f => {
                if (dataCalculo < f.inicio) {
                  f.progresso = 0;
                } else if (dataCalculo > f.fim) {
                  f.progresso = 100;
                } else {
                  // Dentro desta fase
                  faseAtivaNome = f.nome;
                  const fTotal = f.fim.getTime() - f.inicio.getTime();
                  const fDecor = dataCalculo.getTime() - f.inicio.getTime();
                  f.progresso = (fDecor / fTotal) * 100;
                }
              });
           }
        }

        // Calcula os pesos relativos de cada fase para a barra empilhada
        const duracaoTotalReal = fases.reduce((acc, f) => acc + f.duracao, 0);
        fases.forEach(f => {
          f.peso = duracaoTotalReal > 0 ? (f.duracao / duracaoTotalReal) * 100 : 0;
        });

        return {
          cliente: cliente || 'Não informado',
          equipamento: equipamento || 'Não informado',
          tecnicos: tecnicos || 'Não informado',
          dataInicio,
          dataFim,
          status,
          faseAtivaNome,
          fases,
          progresso: Math.max(0, Math.min(100, progressoTotal)),
          diasRestantes
        };
      });

      res.json(instalacoes);
    } catch (err) {
      console.error('Erro ao ler planilha de instalações:', err);
      res.status(500).json({ error: 'Erro ao ler planilha de instalações' });
    }
  });

  app.get('/api/pendencias', tvAuth, (req, res) => {
    try {
      const { obterTodasReposicoesPendentes } = require('../database/queries');
      const pendencias = obterTodasReposicoesPendentes();
      
      const agora = new Date();
      const formatado = pendencias.map(p => {
        const msDiff = agora - new Date(p.criada_em);
        const dias = Math.floor(msDiff / (1000 * 60 * 60 * 24));
        return {
          ...p,
          dias_atraso: dias
        };
      });

      res.json(formatado);
    } catch (err) {
      console.error('Erro na API de Pendencias:', err);
      res.status(500).json({ error: 'Erro interno ao buscar pendencias' });
    }
  });

  app.get('/api/baixar-email', (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token) {
        return res.status(400).send('<h1>Erro</h1><p>Token de seguranca nao informado.</p>');
      }
      
      let id, user;
      try {
        const payload = jwt.verify(token, config.JWT_SECRET);
        id = payload.id;
        user = payload.user;
      } catch (err) {
        return res.status(403).send('<h1>Erro</h1><p>Token invalido ou expirado.</p>');
      }

      const { getDb } = require('../database/connection');
      const db = getDb();

      // Verifica se o pedido existe e qual o status atual
      const stmt = db.prepare("SELECT status_pedido, tecnico_nome, cliente, responsavel_baixa FROM solicitacoes WHERE id = ?");
      stmt.bind([id]);
      let pedido = null;
      if (stmt.step()) {
        pedido = stmt.getAsObject();
      }
      stmt.free();

      if (!pedido) {
        return res.status(404).send('<h1>Erro</h1><p>Pedido não encontrado.</p>');
      }

      if (pedido.status_pedido === 'EM_ANALISE' && pedido.responsavel_baixa) {
        const responsavel = pedido.responsavel_baixa || 'outra pessoa da equipe';
        return res.send(`
          <div style="font-family: Arial; padding: 40px; text-align: center; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #f57c00;">Aviso</h1>
            <p style="font-size: 18px;">Este pedido (#PD-${id}) já foi baixado anteriormente por <strong>${responsavel}</strong>.</p>
          </div>
        `);
      }

      // Mostra página de confirmação com botão (anti-prefetch do Outlook)
      res.send(`
        <html><body>
        <div style="font-family: Arial; padding: 40px; text-align: center; max-width: 600px; margin: 0 auto; background-color: #fff3e0; border: 2px solid #ff9800; border-radius: 10px;">
          <h1 style="color: #e65100;">📋 Pedido #PD-${id}</h1>
          <p style="font-size: 18px;">Técnico: <strong>${pedido.tecnico_nome}</strong></p>
          <p style="font-size: 18px;">Cliente: <strong>${pedido.cliente}</strong></p>
          <p style="font-size: 16px; color: #555; margin-top: 20px;">Clique no botão abaixo para assumir este pedido:</p>
          <form method="POST" action="/api/baixar-email-confirmar">
            <input type="hidden" name="token" value="${token}" />
            <button type="submit" style="margin-top: 15px; padding: 15px 40px; font-size: 18px; background-color: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
              ✅ Assumir Pedido
            </button>
          </form>
        </div>
        </body></html>
      `);

    } catch (err) {
      console.error('Erro ao baixar via email:', err);
      res.status(500).send('<h1>Erro</h1><p>Erro interno.</p>');
    }
  });

  // POST: Executa a baixa de fato (protegido contra prefetch)
  app.post('/api/baixar-email-confirmar', (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).send('<h1>Erro</h1><p>Token não informado.</p>');
      }

      let id, user;
      try {
        const payload = jwt.verify(token, config.JWT_SECRET);
        id = payload.id;
        user = payload.user;
      } catch (err) {
        return res.status(403).send('<h1>Erro</h1><p>Token invalido ou expirado.</p>');
      }

      const { baixarPedido } = require('../database/queries');
      const { getDb } = require('../database/connection');
      const db = getDb();

      const stmt = db.prepare("SELECT status_pedido, tecnico_nome, cliente, responsavel_baixa FROM solicitacoes WHERE id = ?");
      stmt.bind([id]);
      let pedido = null;
      if (stmt.step()) {
        pedido = stmt.getAsObject();
      }
      stmt.free();

      if (!pedido) {
        return res.status(404).send('<h1>Erro</h1><p>Pedido não encontrado.</p>');
      }

      if (pedido.status_pedido === 'EM_ANALISE' && pedido.responsavel_baixa) {
        const responsavel = pedido.responsavel_baixa || 'outra pessoa da equipe';
        return res.send(`
          <div style="font-family: Arial; padding: 40px; text-align: center; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #f57c00;">Aviso</h1>
            <p style="font-size: 18px;">Este pedido (#PD-${id}) já foi baixado anteriormente por <strong>${responsavel}</strong>.</p>
          </div>
        `);
      }

      // Baixar o pedido
      baixarPedido(id, user || 'Baixa via E-mail');
      const { exportToExcel } = require('../database/exportToExcel');
      exportToExcel();
      
      if (req.app.get('io')) {
        req.app.get('io').emit('kanban_update');
      }

      res.send(`
        <div style="font-family: Arial; padding: 40px; text-align: center; max-width: 600px; margin: 0 auto; background-color: #e8f5e9; border: 2px solid #4caf50; border-radius: 10px;">
          <h1 style="color: #2e7d32;">✅ Sucesso!</h1>
          <p style="font-size: 18px;">O pedido <strong>#PD-${id}</strong> (Técnico: ${pedido.tecnico_nome} | Cliente: ${pedido.cliente}) foi baixado com sucesso por <strong>${user}</strong>!</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">Você já pode fechar esta janela.</p>
        </div>
      `);

    } catch (err) {
      console.error('Erro ao confirmar baixa via email:', err);
      res.status(500).send('<h1>Erro</h1><p>Erro interno.</p>');
    }
  });

  // Rota para buscar todas as solicitacoes com seus itens para a Base de Dados
  app.get('/api/solicitacoes-todas', tvAuth, (req, res) => {
    try {
      const db = require('../database/connection').getDb();
      
      const query = `
        SELECT 
          s.id as pedido_id,
          s.criada_em as data,
          s.tecnico_nome as tecnico,
          s.cliente,
          s.modelo as equipamento,
          s.motivo,
          s.md,
          s.status_pedido as status,
          s.numero_orcamento,
          s.numero_pedido_protheus,
          s.nota_fiscal,
          si.codigo_peca,
          si.descricao_peca,
          si.quantidade_solicitada as qtd
        FROM solicitacoes s
        JOIN solicitacao_itens si ON s.id = si.solicitacao_id
        ORDER BY s.id DESC
      `;
      
      const stmt = db.prepare(query);
      const lista = [];
      while(stmt.step()) {
        lista.push(stmt.getAsObject());
      }
      stmt.free();
      
      res.json({ success: true, data: lista });
    } catch (err) {
      console.error('Erro na API de todas solicitacoes:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = { setupApi };
