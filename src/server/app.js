const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const queries = require('../database/queries');
const config = require('../config');
const { setupApi } = require('./tv_api');
const dashboardService = require('../services/dashboard');
const xlsx = require('xlsx');
const { getClient } = require('../whatsapp/client');
const { exportToExcel } = require('../database/exportToExcel');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
const io = new Server(server, { cors: { origin: allowedOrigins } });
app.set('io', io); // Deixa o io disponível nas rotas se precisar

const JWT_SECRET = config.JWT_SECRET;
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('ERRO FATAL: JWT_SECRET não definido no .env em produção!');
  process.exit(1);
}

// Middlewares
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));
// Rota estática para servir avatares e logo do Backoffice
app.use('/bo-assets', express.static(path.join(__dirname, '../../data/backoffice'))); // Servir arquivos estáticos do Dashboard
app.use('/avatares', express.static(path.join(__dirname, '../../data/avatares'))); // Servir fotos dos técnicos

// Inicializa as rotas da TV (Dashboard Legado)
setupApi(app);

// Middleware de autenticação
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function getCargosTecnicos() {
  const cargos = {};
  try {
    const wb = xlsx.readFile(path.join(__dirname, '../../data/tecnicos.xlsx'));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    data.forEach(row => {
      if (row.NOME && row.CARGO) {
        cargos[row.NOME] = row.CARGO;
      }
    });
  } catch (err) {
    console.error('Erro ao ler tecnicos.xlsx:', err.message);
  }
  return cargos;
}

// Rotas da API

// POST /api/login
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  
  if (!usuario || !senha) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const userRecord = queries.buscarUsuarioBO(usuario);
  if (userRecord) {
    const senhaCorreta = bcrypt.compareSync(senha, userRecord.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const token = jwt.sign({ id: userRecord.id, usuario: userRecord.usuario }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, usuario: userRecord.usuario });
  }

  // Se não tem no banco, tenta na planilha
  try {
    const wb = xlsx.readFile(path.join(__dirname, '../../data/backoffice/backoffice.xlsx'));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    const userExcel = data.find(r => r.EMAIL && r.EMAIL.toLowerCase() === usuario.toLowerCase());

    if (userExcel && String(userExcel.SENHA) === String(senha)) {
      if (String(senha) === '1234') {
        return res.json({ firstAccess: true });
      }
    }
  } catch (err) {
    console.error('Erro ao ler backoffice.xlsx', err);
  }

  return res.status(401).json({ error: 'Credenciais inválidas.' });
});

// POST /api/change-password
app.post('/api/change-password', (req, res) => {
  const { usuario, novaSenha } = req.body;
  if (!usuario || !novaSenha || novaSenha.length !== 8) {
    return res.status(400).json({ error: 'Dados inválidos para alterar senha.' });
  }
  
  const hash = bcrypt.hashSync(novaSenha, 10);
  queries.criarUsuarioBO(usuario, hash);
  const userRecord = queries.buscarUsuarioBO(usuario);
  
  const token = jwt.sign({ id: userRecord.id, usuario: userRecord.usuario }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, usuario: userRecord.usuario });
});

// GET /api/clientes-dashboard
app.get('/api/clientes-dashboard', (req, res) => {
  try {
    const data = dashboardService.getDashboardData();
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// POST /api/clientes-reload
app.post('/api/clientes-reload', (req, res) => {
  try {
    const { loadClientesEquipamentos } = require('../clientes/excel');
    loadClientesEquipamentos();
    const data = dashboardService.getDashboardData();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao atualizar dados do dashboard:', error);
    res.status(500).json({ error: 'Erro ao recarregar a planilha.' });
  }
});

// GET /api/pedidos
app.get('/api/pedidos', authenticateToken, (req, res) => {
  try {
    const pedidos = queries.buscarPedidos();
    const cargos = getCargosTecnicos();
    pedidos.forEach(p => {
      p.cargo_tecnico = cargos[p.tecnico_nome] || 'TÉCNICO';
    });
    res.json(pedidos);
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// GET /api/avatar/:nome
app.get('/api/avatar/:nome', (req, res) => {
  const nomeProcurado = req.params.nome.toLowerCase().trim();
  const dirsToSearch = [
    path.join(__dirname, '../../data/avatares'),
    path.join(__dirname, '../../data/backoffice')
  ];
  
  const normalize = str => str.replace(/[^a-z0-9]/gi, '');
  const procNormal = normalize(nomeProcurado);

  for (const dir of dirsToSearch) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const file = files.find(f => {
          const baseNormal = normalize(path.basename(f, path.extname(f)).toLowerCase());
          if (!baseNormal) return false;
          return procNormal.includes(baseNormal) || baseNormal.includes(procNormal);
        });

        if (file) {
          return res.sendFile(path.join(dir, file));
        }
      }
    } catch (err) {
      console.error(`Erro ao ler pasta ${dir}:`, err.message);
    }
  }
  
  // Retorna avatar com as iniciais gerado automaticamente se não achar
  res.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(nomeProcurado)}&background=333&color=fff&size=128`);
});

// PUT /api/pedidos/:id/status
app.put('/api/pedidos/:id/status', authenticateToken, async (req, res) => {
  const id = req.params.id;
  const { status, numero_orcamento, numero_pedido_protheus, nota_fiscal } = req.body;
  
  const validStatus = ['PENDENTE', 'EM_ANALISE', 'ORCAMENTO_ENVIADO', 'APROVADO', 'EM_PROCESSAMENTO', 'FINALIZADO', 'REPROVADO', 'IMPORTACAO'];
  if (!status || !validStatus.includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    const pedidoAntigo = queries.buscarPedidoPorId(id);
    queries.atualizarStatusPedido(id, status, { numero_orcamento, numero_pedido_protheus, nota_fiscal });

    if (pedidoAntigo && pedidoAntigo.status_pedido !== status) {
      const client = getClient();
      if (client && pedidoAntigo.telefone_tecnico) {
        let mensagem = '';
        if (status === 'ORCAMENTO_ENVIADO') {
          mensagem = `⚠️ *Atualização no seu pedido #PD-${String(id).padStart(4, '0')}*\nO orçamento do cliente *${pedidoAntigo.cliente}* (Modelo: ${pedidoAntigo.modelo}) acaba de ser enviado.`;
        } else if (status === 'FINALIZADO') {
          mensagem = `✅ *Pedido #PD-${String(id).padStart(4, '0')} Finalizado!*\nO pedido para o cliente *${pedidoAntigo.cliente}* foi faturado/liberado. Aguarde a chegada da peça.`;
        }
        
        if (mensagem) {
          const chatId = `${pedidoAntigo.telefone_tecnico}@c.us`;
          await client.sendMessage(chatId, mensagem).catch(err => console.error('Erro ao enviar whatsapp:', err.message));
        }
      }
    }

    exportToExcel(); // Atualiza a planilha sempre que o status mudar (Etapa 2)
    req.app.get('io').emit('kanban_update');

    res.json({ success: true, message: 'Status atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: 'Erro ao atualizar o status.' });
  }
});

// PUT /api/pedidos/:id/orcamento
app.put('/api/pedidos/:id/orcamento', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { orcamento } = req.body;
  
  if (!orcamento) return res.status(400).json({ error: 'Número do orçamento é obrigatório.' });

  try {
    queries.atualizarOrcamentoPedido(id, orcamento);
    exportToExcel(); // Sincroniza Excel (Etapa 2)
    req.app.get('io').emit('kanban_update');
    res.json({ success: true, message: 'Orçamento atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar orçamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar o orçamento.' });
  }
});

// PUT /api/pedidos/:id/protheus
app.put('/api/pedidos/:id/protheus', authenticateToken, (req, res) => {
  const id = req.params.id;
  const { pedidoProtheus } = req.body;
  
  if (!pedidoProtheus) return res.status(400).json({ error: 'Número do pedido Protheus é obrigatório.' });

  try {
    queries.atualizarPedidoProtheus(id, pedidoProtheus);
    exportToExcel(); // Sincroniza Excel (Etapa 2)
    req.app.get('io').emit('kanban_update');
    res.json({ success: true, message: 'Pedido Protheus atualizado com sucesso.' });
  } catch (error) {
    console.error('Erro ao atualizar pedido protheus:', error);
    res.status(500).json({ error: 'Erro ao atualizar o pedido protheus.' });
  }
});

function startServer(port = 3500) {
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      console.log(`Servidor Web / Dashboard rodando na porta ${port}`);
      resolve(server);
    }).on('error', (err) => {
      console.error('Erro ao iniciar o servidor web:', err);
      reject(err);
    });
  });
}

module.exports = { startServer, app, io, server };
