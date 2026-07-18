const session = require('./session');
const states = require('./states');
const MSG = require('../whatsapp/messages');
const jigs = require('../jigs/index');

/**
 * FunÃ§Ã£o principal que processa qualquer mensagem recebida
 */
async function handleIncomingMessage(message, client) {
  // O WhatsApp Web agora manda algumas mensagens com @lid (Internal ID).
  // Descobrimos nos logs que o número real sempre fica escondido em contact.id.user
  let contact = {};
  try {
    contact = await message.getContact();
  } catch (err) {
    console.warn('[AVISO] Não foi possível obter o contato via Puppeteer, usando fallback.');
  }
  let telefone = contact.id && contact.id.user ? contact.id.user : contact.number;
  
  // Fallback caso venha vazio por algum motivo
  if (!telefone || telefone.length > 15) {
    if (message.author) {
      telefone = message.author.replace(/@(c\.us|lid)$/, '');
    } else {
      telefone = message.from.replace(/@(c\.us|lid)$/, '');
    }
  }
  
  const texto = message.body.trim();
  
  console.log(`[PROCESSANDO] Mensagem de ${telefone}: "${texto}"`);

  const textoLower = texto.toLowerCase();

  // Intercepta comandos globais de backoffice antes de qualquer validacao
  if (textoLower.startsWith('/analisar ')) {
    const args = textoLower.split(' ');
    const id = parseInt(args[1], 10);
    
    if (isNaN(id)) {
      message.reply("Formato inválido. Use: /analisar NUMERO").catch(e => console.error(e));
      return;
    }
    
    const queries = require('../database/queries');
    const pedido = queries.buscarPedidoPorId(id);
    
    if (!pedido) {
      message.reply(MSG.BO_BAIXA_NOT_FOUND(id)).catch(e => console.error(e));
      return;
    }
    
    if (pedido.status_pedido === 'EM_ANALISE' && pedido.responsavel_baixa) {
      const responsavel = pedido.responsavel_baixa || 'outra pessoa';
      message.reply(MSG.BO_BAIXA_ALREADY_DONE(responsavel)).catch(e => console.error(e));
      return;
    }
    
    // Autentica o usuário do backoffice
    const boUser = jigs.buscarBackofficePorTelefone(telefone);
    if (!boUser) {
      message.reply("Acesso negado. Comando restrito ao Backoffice.").catch(e => console.error(e));
      return;
    }
    
    queries.baixarPedido(id, boUser.nome);
    const { exportToExcel } = require('../database/exportToExcel');
    exportToExcel();
    const { io } = require('../server/app');
    if (io) {
      io.emit('kanban_update');
    }
    
    message.reply(MSG.BO_BAIXA_SUCCESS(id, boUser.nome)).catch(e => console.error(e));
    return;
  }

  // Validar se o telefone pertence a um tÃ©cnico cadastrado
  const tecnico = jigs.buscarTecnicoPorTelefone(telefone);
  if (!tecnico) {
    console.log(`[BLOQUEADO] Mensagem de ${telefone} ignorada (não consta na lista de técnicos).`);
    message.reply("⛔ Acesso negado: seu número não está cadastrado no sistema. Entre em contato com o administrador.").catch(err => console.error('Erro ao enviar bloqueio:', err));
    return;
  }

  // Buscar sessÃ£o ativa no banco
  let sessaoAtiva = session.getSessaoAtiva(telefone);

  const { MessageMedia } = require('whatsapp-web.js');

  const enviarMenuComMascote = (telefoneMenu, nomeMenu) => {
    try {
      const media = MessageMedia.fromFilePath('./ASSETS/mascote.png');
      const chatId = telefoneMenu.includes('@') ? telefoneMenu : `${telefoneMenu}@c.us`;
      client.sendMessage(chatId, media, { caption: MSG.MAIN_MENU(nomeMenu) })
        .catch(err => console.error('Erro ao enviar mascote:', err));
    } catch (err) {
      console.error('Erro ao carregar imagem mascote.png:', err);
      // Fallback pra texto caso o arquivo não exista
      states.enviarMensagem(client, telefoneMenu, MSG.MAIN_MENU(nomeMenu));
    }
  };

  // 1. NÃ£o tem sessÃ£o ativa -> Criar nova e usar o nome do tecnico
  if (!sessaoAtiva) {
    const novaSessao = session.novaSessao(telefone, tecnico.nome);
    session.setEstado(novaSessao.id, 'menu');
    enviarMenuComMascote(telefone, tecnico.nome);
    return;
  }

  // 2. Tem sessÃ£o ativa -> Resetar para o menu se digitar menu, ola, oi, etc
  const resetCommands = ['menu', 'ola', 'olá', 'oi', 'iniciar', 'inicio', 'início'];
  if (resetCommands.includes(textoLower)) {
    // Limpa todos os dados da sessão anterior para não puxar peças/dados antigos
    session.limparDadosSessao(sessaoAtiva.id);
    sessaoAtiva.itens_consultados = [];
    sessaoAtiva.cliente = null;
    sessaoAtiva.modelo = null;
    sessaoAtiva.modelos_cliente = [];
    sessaoAtiva.tentativas_busca = 0;
    sessaoAtiva.motivo = null;
    sessaoAtiva.md = null;
    sessaoAtiva.urgencia = null;

    session.setEstado(sessaoAtiva.id, 'menu');
    if (textoLower === 'ola' || textoLower === 'olá' || textoLower === 'oi') {
      enviarMenuComMascote(telefone, sessaoAtiva.tecnico_nome);
    } else {
      states.enviarMensagem(client, telefone, MSG.MAIN_MENU(sessaoAtiva.tecnico_nome));
    }
    return;
  }
  
  const closeCommands = ['cancelar', 'sair', 'encerrar', '0'];
  if (closeCommands.includes(textoLower)) {
    if (textoLower === '0' && sessaoAtiva.estado === 'coletando_quantidades') {
      // Se for 0 durante a coleta de quantidades, o usuário quer cancelar apenas aquele item.
      // Deixa seguir para o state handler.
    } else {
      states.encerrarAtendimento(sessaoAtiva, client, telefone);
      return;
    }
  }

  // 3. Roteamento baseado no estado atual
  try {
    switch (sessaoAtiva.estado) {
      
      case 'aguardando_nome':
        // A mensagem que ele mandou Ã‰ o nome dele
        const nome = texto;
        
        // Atualiza o nome e vai pro menu
        sessaoAtiva.tecnico_nome = nome;
        // Pelo mÃ³dulo, atualizar o estado e tambÃ©m seria bom ter uma forma de atualizar o nome.
        // Como o BD agora Ã© JSON local, podemos acessar as queries. Mas como nÃ£o tem uma query 
        // especÃ­fica para atualizar tÃ©cnico, o melhor Ã© criar uma ou atualizar direto pelo getDb.
        const db = require('../database/connection').getDb();
        const index = db.sessoes.findIndex(s => s.id === sessaoAtiva.id);
        if(index !== -1) {
            db.sessoes[index].tecnico_nome = nome;
            require('../database/connection').saveDb();
        }
        
        // AvanÃ§a pro Menu
        states.voltarParaMenu(sessaoAtiva, client, telefone);
        break;

      case 'menu':
        await states.handleMenu(sessaoAtiva, texto, client, telefone);
        break;

      case 'menu_estoque':
        await states.handleMenuEstoque(sessaoAtiva, texto, client, telefone);
        break;

      case 'aguardando_codigo':
        await states.handleAguardandoCodigo(sessaoAtiva, texto, client, telefone);
        break;

      case 'aguardando_descricao':
        await states.handleAguardandoDescricao(sessaoAtiva, texto, client, telefone);
        break;

      case 'pergunta_mais':
        await states.handlePerguntaMais(sessaoAtiva, texto, client, telefone);
        break;

      case 'pergunta_solicitacao':
        await states.handlePerguntaSolicitacao(sessaoAtiva, texto, client, telefone);
        break;
        
      case 'aguardando_cliente':
        await states.handleAguardandoCliente(sessaoAtiva, texto, client, telefone);
        break;

      case 'aguardando_modelo':
        await states.handleAguardandoModelo(sessaoAtiva, texto, client, telefone);
        break;

      case 'coletando_quantidades':
        await states.handleColetandoQuantidades(sessaoAtiva, texto, client, telefone);
        break;

      case 'alerta_redundancia':
        await states.handleAlertaRedundancia(sessaoAtiva, texto, client, telefone);
        break;

      case 'pergunta_motivo':
        await states.handlePerguntaMotivo(sessaoAtiva, texto, client, telefone);
        break;

      case 'pergunta_md':
        await states.handlePerguntaMD(sessaoAtiva, texto, client, telefone);
        break;

      case 'pergunta_urgencia':
        await states.handlePerguntaUrgencia(sessaoAtiva, texto, client, telefone);
        break;

      case 'confirmacao':
        await states.handleConfirmacao(sessaoAtiva, texto, client, telefone);
        break;

      case 'jigs_req_codigo':
        await states.handleJigsReqCodigo(sessaoAtiva, texto, client, telefone);
        break;

      case 'jigs_req_cliente':
        await states.handleJigsReqCliente(sessaoAtiva, texto, client, telefone);
        break;

      case 'jigs_dev_escolha':
        await states.handleJigsDevEscolha(sessaoAtiva, texto, client, telefone);
        break;

      case 'reposicoes_baixa':
        await states.handleReposicoesBaixa(sessaoAtiva, texto, client, telefone);
        break;

      default:
        console.warn(`Estado desconhecido: ${sessaoAtiva.estado}`);
        states.voltarParaMenu(sessaoAtiva, client, telefone);
    }
  } catch (error) {
    console.error(`Erro ao processar mensagem no estado ${sessaoAtiva.estado}:`, error);
    states.enviarMensagem(client, telefone, MSG.ERROR_GENERIC);
  }
}

// Re-exporta states.enviarMensagem para usar localmente (hacky, mas resolve)
states.enviarMensagem = function(client, telefone, texto) {
  const chatId = telefone.includes('@') ? telefone : `${telefone}@c.us`;
  client.sendMessage(chatId, texto).catch(err => console.error('Erro ao enviar MSG:', err));
}

module.exports = {
  handleIncomingMessage
};

