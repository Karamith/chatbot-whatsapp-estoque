const config = require('../config');
const MSG = require('../whatsapp/messages');
const excel = require('../estoque/excel');
const search = require('../estoque/search');
const clientes = require('../clientes/excel');
const session = require('./session');
const jigs = require('../jigs/index');
const queries = require('../database/queries');
const mailer = require('../utils/mailer');

function enviarMensagem(client, telefone, texto) {
  const chatId = telefone.includes('@') ? telefone : `${telefone}@c.us`;
  client.sendMessage(chatId, texto).catch(err => console.error('Erro ao enviar MSG:', err));
}

function voltarParaMenu(sessao, client, telefone) {
  session.setEstado(sessao.id, 'menu');
  enviarMensagem(client, telefone, MSG.MAIN_MENU(sessao.tecnico_nome));
}

function encerrarAtendimento(sessao, client, telefone) {
  session.fecharSessao(sessao.id);
  enviarMensagem(client, telefone, "Atendimento encerrado. Caso precise, envie um 'Ola' para comecar novamente.");
}

function formatarListaModelos(modelos) {
  return modelos.map((modelo, index) => `${index + 1} - ${modelo}`).join('\n');
}

async function handleMenu(sessao, texto, client, telefone) {
  if (texto === '1') {
    session.setEstado(sessao.id, 'menu_estoque');
    enviarMensagem(client, telefone, MSG.MENU_ESTOQUE_PROMPT);
  } else if (texto === '2') {
    const todasJigs = jigs.buscarTodasJigs();
    let lista = '';
    todasJigs.forEach(j => {
      const bola = j.status === 'disponivel' ? '🟢' : '🔴';
      lista += `${j.codigo_hp} - ${j.descricao} ${bola}\n`;
    });
    session.setEstado(sessao.id, 'jigs_req_codigo');
    enviarMensagem(client, telefone, MSG.JIGS_REQ_LIST(lista));
  } else if (texto === '3') {
    const jigsEmPosse = jigs.buscarJigsEmPosse(sessao.tecnico_nome);
    if (jigsEmPosse.length === 0) {
      enviarMensagem(client, telefone, MSG.JIGS_DEV_EMPTY);
      voltarParaMenu(sessao, client, telefone);
    } else {
      let lista = '';
      jigsEmPosse.forEach((j, index) => {
        lista += `${index + 1} - ${j.codigo_hp} - ${j.descricao}\n`;
      });
      session.setEstado(sessao.id, 'jigs_dev_escolha');
      session.adicionarItemConsultado(sessao, jigsEmPosse); // Save array for later
      enviarMensagem(client, telefone, MSG.JIGS_DEV_LIST(lista));
    }
  } else if (texto === '4') {
    const pendencias = queries.buscarReposicoesPendentesTecnico(sessao.tecnico_nome);
    if (pendencias.length === 0) {
      enviarMensagem(client, telefone, MSG.REPOSICOES_EMPTY);
      voltarParaMenu(sessao, client, telefone);
    } else {
      let lista = '';
      pendencias.forEach((p, index) => {
        lista += `${index + 1} - ${p.descricao_peca || p.codigo_peca} (Cliente: ${p.cliente})\n`;
      });
      session.setEstado(sessao.id, 'reposicoes_baixa');
      session.adicionarItemConsultado(sessao, pendencias); // Save array for later
      enviarMensagem(client, telefone, MSG.REPOSICOES_LIST(lista));
    }
  } else {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
  }
}

async function handleMenuEstoque(sessao, texto, client, telefone) {
  // Tenta buscar por código primeiro
  const itemPorCodigo = excel.buscarPorCodigo(texto);
  
  if (itemPorCodigo) {
    if (itemPorCodigo.quantidade === 0) {
      itemPorCodigo.importacao = true;
    }
    
    session.historicoConsulta(sessao.id, 'codigo', texto, itemPorCodigo.quantidade > 0 ? 'encontrado' : 'sem_estoque', itemPorCodigo);
    session.adicionarItemConsultado(sessao, itemPorCodigo);

    if (itemPorCodigo.isEdicula) {
      enviarMensagem(client, telefone, MSG.ITEM_FOUND_EDICULA(itemPorCodigo.codigo, itemPorCodigo.descricao, itemPorCodigo.quantidade));
    } else if (itemPorCodigo.quantidade > 0) {
      enviarMensagem(client, telefone, MSG.ITEM_FOUND_WITH_STOCK(itemPorCodigo.codigo, itemPorCodigo.descricao, itemPorCodigo.quantidade));
    } else {
      enviarMensagem(client, telefone, MSG.ITEM_FOUND_NO_STOCK(itemPorCodigo.codigo, itemPorCodigo.descricao));
    }

    session.setEstado(sessao.id, 'pergunta_mais');
    setTimeout(() => enviarMensagem(client, telefone, MSG.ASK_MORE), 1000);
    return;
  }

  // Se não achou por código, tenta por descrição
  const resultadosDescricao = search.buscarPorDescricao(texto);

  if (resultadosDescricao.length > 0) {
    let listaTexto = '';
    resultadosDescricao.forEach((res, index) => {
      listaTexto += `${index + 1} - ${res.codigo} - ${res.descricao} (${res.quantidade} un.)\n`;
    });

    enviarMensagem(client, telefone, MSG.SEARCH_RESULTS(listaTexto));
    session.setEstado(sessao.id, 'aguardando_codigo'); // aguarda ele digitar o codigo exato ou 0
    return;
  }

  // Não achou nem por código nem por descrição
  session.historicoConsulta(sessao.id, 'busca_unificada', texto, 'nao_encontrado');
  
  const tentativas = session.incrementarTentativasBusca(sessao.id, sessao.tentativas_busca);
  
  if (tentativas === 1) {
    enviarMensagem(client, telefone, MSG.ITEM_NOT_FOUND_RETRY);
  } else {
    enviarMensagem(client, telefone, MSG.ITEM_NOT_FOUND_IMPORT);
    
    // Mock item
    const mockItem = {
      codigo: texto.toUpperCase(),
      descricao: 'Importar',
      quantidade: 0,
      importacao: true
    };
    
    session.adicionarItemConsultado(sessao, mockItem);
    session.resetTentativasBusca(sessao.id);

    session.setEstado(sessao.id, 'pergunta_mais');
    setTimeout(() => enviarMensagem(client, telefone, MSG.ASK_MORE), 1000);
  }
}

async function handleAguardandoCodigo(sessao, texto, client, telefone) {
  const item = excel.buscarPorCodigo(texto);

  if (item) {
    if (item.quantidade === 0) {
      item.importacao = true;
    }
    session.historicoConsulta(sessao.id, 'codigo', texto, item.quantidade > 0 ? 'encontrado' : 'sem_estoque', item);
    session.adicionarItemConsultado(sessao, item);

    if (item.isEdicula) {
      enviarMensagem(client, telefone, MSG.ITEM_FOUND_EDICULA(item.codigo, item.descricao, item.quantidade));
    } else if (item.quantidade > 0) {
      enviarMensagem(client, telefone, MSG.ITEM_FOUND_WITH_STOCK(item.codigo, item.descricao, item.quantidade));
    } else {
      enviarMensagem(client, telefone, MSG.ITEM_FOUND_NO_STOCK(item.codigo, item.descricao));
    }

    session.setEstado(sessao.id, 'pergunta_mais');
    setTimeout(() => enviarMensagem(client, telefone, MSG.ASK_MORE), 1000);
  } else {
    session.historicoConsulta(sessao.id, 'codigo', texto, 'nao_encontrado');
    const tentativas = session.incrementarTentativasBusca(sessao.id, sessao.tentativas_busca);

    if (tentativas === 1) {
      enviarMensagem(client, telefone, MSG.ITEM_NOT_FOUND_RETRY);
    } else {
      enviarMensagem(client, telefone, MSG.ITEM_NOT_FOUND_IMPORT);
      
      const mockItem = {
        codigo: texto.toUpperCase(),
        descricao: 'Importar',
        quantidade: 0,
        importacao: true
      };
      
      session.adicionarItemConsultado(sessao, mockItem);
      session.resetTentativasBusca(sessao.id);

      session.setEstado(sessao.id, 'pergunta_mais');
      setTimeout(() => enviarMensagem(client, telefone, MSG.ASK_MORE), 1000);
    }
  }
}

async function handleAguardandoDescricao(sessao, texto, client, telefone) {
  const resultados = search.buscarPorDescricao(texto);

  if (resultados.length === 0) {
    session.historicoConsulta(sessao.id, 'descricao', texto, 'nao_encontrado');
    enviarMensagem(client, telefone, MSG.SEARCH_NO_RESULTS);
    session.setEstado(sessao.id, 'pergunta_mais');
    setTimeout(() => enviarMensagem(client, telefone, MSG.ASK_MORE), 1000);
    return;
  }

  let listaTexto = '';
  resultados.forEach((res, index) => {
    listaTexto += `${index + 1} - ${res.codigo} - ${res.descricao} (${res.quantidade} un.)\n`;
  });

  enviarMensagem(client, telefone, MSG.SEARCH_RESULTS(listaTexto));
  session.setEstado(sessao.id, 'aguardando_codigo');
}

async function handlePerguntaMais(sessao, texto, client, telefone) {
  if (texto === '1') {
    session.setEstado(sessao.id, 'menu_estoque');
    enviarMensagem(client, telefone, MSG.MENU_ESTOQUE_PROMPT);
  } else if (texto === '2') {
    if (sessao.itens_consultados && sessao.itens_consultados.length > 0) {
      session.setEstado(sessao.id, 'pergunta_solicitacao');
      enviarMensagem(client, telefone, MSG.ASK_REQUEST);
    } else {
      encerrarAtendimento(sessao, client, telefone);
    }
  } else {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
  }
}

async function handlePerguntaSolicitacao(sessao, texto, client, telefone) {
  if (texto === '1') {
    session.setEstado(sessao.id, 'aguardando_cliente');
    enviarMensagem(client, telefone, MSG.ASK_CLIENT);
  } else if (texto === '2') {
    encerrarAtendimento(sessao, client, telefone);
  } else {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
  }
}

async function handleAguardandoCliente(sessao, texto, client, telefone) {
  const clienteEncontrado = clientes.buscarCliente(texto);

  if (!clienteEncontrado) {
    enviarMensagem(client, telefone, MSG.CLIENT_NOT_FOUND);
    return;
  }

  session.setClienteModelos(sessao.id, clienteEncontrado.cliente, clienteEncontrado.modelos);
  session.setEstado(sessao.id, 'aguardando_modelo');
  enviarMensagem(client, telefone, MSG.ASK_MODEL(clienteEncontrado.cliente, formatarListaModelos(clienteEncontrado.modelos)));
}

async function handleAguardandoModelo(sessao, texto, client, telefone) {
  const modelos = Array.isArray(sessao.modelos_cliente) ? sessao.modelos_cliente : [];
  const opcao = parseInt(texto, 10);

  if (isNaN(opcao) || opcao < 1 || opcao > modelos.length) {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_MODEL);
    return;
  }

  const modeloEscolhido = modelos[opcao - 1];
  session.setModelo(sessao.id, modeloEscolhido);
  sessao.modelo = modeloEscolhido;

  session.setEstado(sessao.id, 'coletando_quantidades');
  const item = sessao.itens_consultados[0];
  enviarMensagem(client, telefone, MSG.ASK_QUANTITY(item.codigo, item.descricao));
}

async function handleColetandoQuantidades(sessao, texto, client, telefone) {
  const qtd = parseInt(texto, 10);

  if (isNaN(qtd) || qtd < 0) {
    enviarMensagem(client, telefone, "Digite um numero valido (0 ou maior).");
    return;
  }

  const index = sessao.itens_consultados.findIndex(i => i.quantidadeDesejada === null);

  if (index >= 0) {
    const item = sessao.itens_consultados[index];
    
    // Validação de limite para a Edícula
    if (item.isEdicula && qtd > item.quantidade) {
      enviarMensagem(client, telefone, `Quantidade indisponível na Edícula. O saldo máximo é de ${item.quantidade} unidades.\nPor favor, digite uma quantidade válida (ou 0 para cancelar este item):`);
      return;
    }

    session.setQuantidadeDesejada(sessao, index, qtd);

    const nextIndex = sessao.itens_consultados.findIndex(i => i.quantidadeDesejada === null);

    if (nextIndex >= 0) {
      const nextItem = sessao.itens_consultados[nextIndex];
      enviarMensagem(client, telefone, MSG.ASK_QUANTITY(nextItem.codigo, nextItem.descricao));
    } else {
      let resumoTexto = '';
      let temItensPositivos = false;

      sessao.itens_consultados.forEach(i => {
        if (i.quantidadeDesejada > 0) {
          resumoTexto += `- ${i.codigo} | ${i.descricao} | Quantidade: ${i.quantidadeDesejada}\n`;
          temItensPositivos = true;
        }
      });

      if (!temItensPositivos) {
        enviarMensagem(client, telefone, "Nenhum item com quantidade selecionada.");
        encerrarAtendimento(sessao, client, telefone);
        return;
      }

      // Check redundancy
      let itensRedundantes = [];
      sessao.itens_consultados.forEach(i => {
        if (i.quantidadeDesejada > 0) {
          const check = queries.verificarRedundancia(sessao.cliente, sessao.modelo, i.codigo);
          if (check) {
            i.alerta_redundancia = check.tecnico_nome;
            itensRedundantes.push(`- ${i.codigo} (por ${check.tecnico_nome})`);
          }
        }
      });

      if (itensRedundantes.length > 0) {
        // Save items again with the alert
        queries.atualizarItensSessao(sessao.id, sessao.itens_consultados);
        session.setEstado(sessao.id, 'alerta_redundancia');
        enviarMensagem(client, telefone, MSG.REDUNDANCY_ALERT(itensRedundantes.join('\n')));
      } else {
        session.setEstado(sessao.id, 'pergunta_md');
        enviarMensagem(client, telefone, MSG.ASK_MD);
      }
    }
  }
}

async function handleAlertaRedundancia(sessao, texto, client, telefone) {
  if (texto === '1') {
    session.setEstado(sessao.id, 'pergunta_md');
    enviarMensagem(client, telefone, MSG.ASK_MD);
  } else if (texto === '2') {
    enviarMensagem(client, telefone, "Solicitação cancelada.");
    voltarParaMenu(sessao, client, telefone);
  } else {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
  }
}

async function handlePerguntaMD(sessao, texto, client, telefone) {
  if (texto === '1') {
    sessao.md = 'Sim';
    sessao.urgencia = 'Prioridade MD'; // Quando é MD não pergunta urgência
    session.setRespostasCheckout(sessao.id, sessao.motivo, sessao.md, sessao.urgencia);
    session.setEstado(sessao.id, 'pergunta_motivo');
    enviarMensagem(client, telefone, MSG.ASK_MOTIVO);
  } else if (texto === '2') {
    sessao.md = 'Não';
    session.setRespostasCheckout(sessao.id, sessao.motivo, sessao.md, sessao.urgencia);
    session.setEstado(sessao.id, 'pergunta_urgencia');
    enviarMensagem(client, telefone, MSG.ASK_URGENCIA);
  } else {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
    return;
  }
}

async function handlePerguntaUrgencia(sessao, texto, client, telefone) {
  if (texto === '1') {
    sessao.urgencia = 'Atendimento Imediato';
  } else if (texto === '2') {
    sessao.urgencia = 'UTK';
  } else {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
    return;
  }
  
  session.setRespostasCheckout(sessao.id, sessao.motivo, sessao.md, sessao.urgencia);
  session.setEstado(sessao.id, 'pergunta_motivo');
  enviarMensagem(client, telefone, MSG.ASK_MOTIVO);
}

async function handlePerguntaMotivo(sessao, texto, client, telefone) {
  if (texto === '1') {
    sessao.motivo = 'Atender';
  } else if (texto === '2') {
    sessao.motivo = 'Diagnóstico';
  } else {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
    return;
  }
  
  session.setRespostasCheckout(sessao.id, sessao.motivo, sessao.md, sessao.urgencia);

  let resumoTexto = '';
  sessao.itens_consultados.forEach(i => {
    if (i.quantidadeDesejada > 0) {
      const isImport = i.importacao ? '[! Importar] ' : '';
      const isRedundante = i.alerta_redundancia ? `[ALERTA: Solicitada há menos de 15 dias por ${i.alerta_redundancia}] ` : '';
      resumoTexto += `- ${isImport}${isRedundante}${i.codigo} | ${i.descricao} | Quantidade: ${i.quantidadeDesejada}\n`;
    }
  });

  const preview = MSG.REQUEST_SUMMARY(sessao.tecnico_nome, sessao.cliente, sessao.modelo, resumoTexto, sessao.motivo, sessao.md, sessao.urgencia);
  
  session.setEstado(sessao.id, 'confirmacao');
  enviarMensagem(client, telefone, preview);
}

async function handleConfirmacao(sessao, texto, client, telefone) {
  const resp = texto.trim().toLowerCase();

  if (resp === 'sim' || resp === 's') {
    const solicitacaoId = session.salvarSolicitacao(sessao);

    // Enviar para toda a lista de Backoffice
    const backofficeUsers = jigs.buscarTodosBackoffice();
    if (backofficeUsers.length > 0 && solicitacaoId) {
      let resumoTexto = '';
      sessao.itens_consultados.forEach(i => {
        if (i.quantidadeDesejada > 0) {
          const isImport = i.importacao ? '[! Importar] ' : '';
          const isRedundante = i.alerta_redundancia ? `[ALERTA: Solicitada há menos de 15 dias por ${i.alerta_redundancia}] ` : '';
          const isEdicula = i.isEdicula ? `[EDÍCULA - Loc: ${i.localizacao || 'N/A'}] ` : '';
          resumoTexto += `• ${isImport}${isRedundante}${isEdicula}${i.codigo} | ${i.descricao} | Qtd solicitada: ${i.quantidadeDesejada} | ${sessao.urgencia}\n`;
        }
      });

      const dataHora = new Date().toLocaleString('pt-BR');
      const msgBackoffice = MSG.REQUEST_RECEIVED_BO(
        sessao.tecnico_nome, 
        sessao.cliente, 
        sessao.modelo, 
        dataHora, 
        resumoTexto,
        sessao.motivo,
        sessao.md,
        sessao.urgencia,
        solicitacaoId,
        sessao.itens_consultados
      );

      backofficeUsers.forEach(boUser => {
        if (boUser.telefone) {
          enviarMensagem(client, boUser.telefone, msgBackoffice);
        }
        if (boUser.email) {
          mailer.enviarEmailPedido(boUser.email, sessao, solicitacaoId, resumoTexto, boUser.nome);
        }
      });
    }

    enviarMensagem(client, telefone, MSG.REQUEST_SENT_TECH);
    session.fecharSessao(sessao.id);
  } else if (resp === 'nao' || resp === 'n' || resp === 'não') {
    enviarMensagem(client, telefone, "Solicitacao cancelada.");
    voltarParaMenu(sessao, client, telefone);
  } else {
    enviarMensagem(client, telefone, "Por favor, responda 'Sim' ou 'Nao'.");
  }
}

async function handleJigsReqCodigo(sessao, texto, client, telefone) {
  const jig = jigs.buscarJigPorCodigo(texto);
  if (!jig) {
    enviarMensagem(client, telefone, MSG.JIGS_ERROR_NOT_FOUND);
    voltarParaMenu(sessao, client, telefone);
    return;
  }
  if (jig.status !== 'disponivel') {
    enviarMensagem(client, telefone, MSG.JIGS_ERROR_UNAVAILABLE);
    voltarParaMenu(sessao, client, telefone);
    return;
  }
  
  session.setModelo(sessao.id, jig.codigo_hp); // using 'modelo' field temporarily for jig code
  session.setEstado(sessao.id, 'jigs_req_cliente');
  enviarMensagem(client, telefone, MSG.JIGS_ASK_CLIENT);
}

async function handleJigsReqCliente(sessao, texto, client, telefone) {
  const clienteStr = texto;
  const codigoJig = sessao.modelo;
  
  try {
    jigs.requisitarJig(codigoJig, sessao.tecnico_nome, clienteStr);
    enviarMensagem(client, telefone, MSG.JIGS_REQ_SUCCESS(codigoJig));
  } catch(e) {
    enviarMensagem(client, telefone, e.message);
  }
  
  voltarParaMenu(sessao, client, telefone);
}

async function handleJigsDevEscolha(sessao, texto, client, telefone) {
  const index = parseInt(texto, 10) - 1;
  const jigsEmPosse = sessao.itens_consultados; // Como passamos um array direto, o session stringify cuidou disso

  if (isNaN(index) || index < 0 || !Array.isArray(jigsEmPosse) || index >= jigsEmPosse[0].length) {
    // Wait, adicionarItemConsultado pushes to the array. 
    // Since we called `adicionarItemConsultado(sessao, jigsEmPosse)`, the list of jigs is inside `sessao.itens_consultados[sessao.itens_consultados.length - 1]`.
    // Let's handle this properly. 
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
    return;
  }

  // A lista de jigs guardada no último push
  const listaJigs = jigsEmPosse[jigsEmPosse.length - 1];
  const jigEscolhida = listaJigs[index];

  if (!jigEscolhida) {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
    return;
  }

  try {
    jigs.devolverJig(jigEscolhida.codigo_hp, sessao.tecnico_nome);
    enviarMensagem(client, telefone, MSG.JIGS_DEV_SUCCESS(jigEscolhida.codigo_hp));
  } catch(e) {
    enviarMensagem(client, telefone, e.message);
  }
  voltarParaMenu(sessao, client, telefone);
}

async function handleReposicoesBaixa(sessao, texto, client, telefone) {
  if (texto.toLowerCase() === 'menu') {
    voltarParaMenu(sessao, client, telefone);
    return;
  }

  const index = parseInt(texto, 10) - 1;
  const itensConsultados = sessao.itens_consultados;
  
  if (isNaN(index) || index < 0 || !Array.isArray(itensConsultados) || itensConsultados.length === 0) {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
    return;
  }
  
  const pendenciasAnteriores = itensConsultados[itensConsultados.length - 1];
  const itemEscolhido = pendenciasAnteriores[index];
  
  if (!itemEscolhido) {
    enviarMensagem(client, telefone, MSG.ERROR_INVALID_OPTION);
    return;
  }
  
  try {
    queries.baixarReposicao(itemEscolhido.id);
    enviarMensagem(client, telefone, `✅ Reposição da peça "${itemEscolhido.descricao_peca || itemEscolhido.codigo_peca}" atualizada para SOLICITADA.`);
    
    // Atualizar lista local removendo o baixado
    const novasPendencias = pendenciasAnteriores.filter((p, i) => i !== index);
    
    if (novasPendencias.length === 0) {
      enviarMensagem(client, telefone, "Você não tem mais peças pendentes de reposição no momento.");
      voltarParaMenu(sessao, client, telefone);
    } else {
      let lista = '';
      novasPendencias.forEach((p, i) => {
        lista += `${i + 1} - ${p.descricao_peca || p.codigo_peca} (Cliente: ${p.cliente})\n`;
      });
      session.adicionarItemConsultado(sessao, novasPendencias);
      enviarMensagem(client, telefone, MSG.REPOSICOES_LIST(lista));
    }
  } catch (err) {
    console.error('Erro na baixa de reposição:', err);
    enviarMensagem(client, telefone, MSG.ERROR_GENERIC);
  }
}

module.exports = {
  handleMenu,
  handleMenuEstoque,
  handleAguardandoCodigo,
  handleAguardandoDescricao,
  handlePerguntaMais,
  handlePerguntaSolicitacao,
  handleAguardandoCliente,
  handleAguardandoModelo,
  handleColetandoQuantidades,
  handleAlertaRedundancia,
  handleReposicoesBaixa,
  handlePerguntaMotivo,
  handlePerguntaMD,
  handlePerguntaUrgencia,
  handleConfirmacao,
  handleJigsReqCodigo,
  handleJigsReqCliente,
  handleJigsDevEscolha,
  voltarParaMenu,
  encerrarAtendimento
};


