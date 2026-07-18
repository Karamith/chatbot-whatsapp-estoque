const MESSAGES = {
  WELCOME: `Ola! Bem-vindo ao sistema de consulta de estoque.\nPor favor, informe seu nome:`,

  MAIN_MENU: (nome) => {
    const hora = new Date().getHours();
    let saudacao = 'Boa noite';
    if (hora >= 5 && hora < 12) {
      saudacao = 'Bom dia';
    } else if (hora >= 12 && hora < 18) {
      saudacao = 'Boa tarde';
    }
    return `${saudacao}, ${nome}!\n\n1 - ESTOQUE\n2 - REQUISITAR JIGS\n3 - DEVOLVER JIGS\n4 - REPOSIÇÕES\n\nResponda com o número desejado.`;
  },

  MENU_ESTOQUE_PROMPT: "Por favor, insira o código ou descrição da peça que deseja pesquisar.",

  JIGS_REQ_LIST: (lista) => `Estas são as JIGs cadastradas:\n\n${lista}\nQual JIG você deseja requisitar? Digite o CÓD. CP correspondente.`,
  
  JIGS_DEV_LIST: (lista) => `Você está com as seguintes JIGs:\n\n${lista}\nQual JIG você deseja devolver? Digite o número correspondente da lista acima.`,
  
  JIGS_DEV_EMPTY: "Você não possui nenhuma JIG pendente de devolução no momento.",

  NOT_IMPLEMENTED: "Em desenvolvimento! Esta opção estará disponível em breve.",
  
  REPOSICOES_EMPTY: "Você não possui nenhuma peça finalizada pendente de reposição para clientes CIF/Carepack.",
  
  REPOSICOES_LIST: (lista) => `Você tem as seguintes peças aguardando pedido de reposição:\n\n${lista}\nPara dar baixa, digite o número da peça cuja reposição foi solicitada ao fabricante! (ou "menu" para voltar)`,

  ASK_CODE: `Digite o codigo da peca (numerico ou alfanumerico):`,

  ITEM_FOUND_WITH_STOCK: (codigo, descricao, qtd) => `Item encontrado.\n\nCodigo: ${codigo}\nDescricao: ${descricao}\nQuantidade disponivel: ${qtd} unidades`,

  ITEM_FOUND_EDICULA: (codigo, descricao, qtd) => `PEÇA ENCONTRADA NA EDÍCULA\n\nCodigo: ${codigo}\nDescricao: ${descricao}\nQuantidade disponivel: ${qtd} unidades\n\nInformarei ao backoffice sobre a localização.`,

  ITEM_FOUND_NO_STOCK: (codigo, descricao) => `Item encontrado, porem sem saldo disponivel em estoque.\n\nCodigo: ${codigo}\nDescricao: ${descricao}`,

  ITEM_NOT_FOUND: `Codigo nao encontrado na base de dados.`,

  ASK_DESC: `Digite a descricao da peca:`,

  SEARCH_RESULTS: (lista) => `Foram encontrados os seguintes itens semelhantes:\n\n${lista}\n\nDigite o codigo da peca escolhida ou 0 para cancelar.`,

  SEARCH_NO_RESULTS: `Nenhuma peca encontrada com essa descricao.`,

  ITEM_NOT_FOUND_RETRY: "Código não encontrado. Pode ter sido um erro de digitação. Por favor, insira o código ou descrição novamente:",
  
  ITEM_NOT_FOUND_IMPORT: "A peça solicitada não foi localizada no estoque. Ela será adicionada ao carrinho para importação.",

  ASK_MORE: `Deseja consultar mais alguma peca?\n1 - Sim\n2 - Nao`,

  ASK_REQUEST: `Deseja enviar esta solicitação ao Backoffice?\n1 - Sim\n2 - Nao`,

  ASK_CLIENT: `Qual o nome do cliente?`,

  CLIENT_NOT_FOUND: `Cliente nao encontrado na base de dados.\nPor favor, digite novamente o nome do cliente:`,

  ASK_MODEL: (cliente, lista) => `Cliente encontrado: ${cliente}\n\nEscolha o modelo do equipamento:\n${lista}`,

  ERROR_INVALID_MODEL: `Opcao invalida. Por favor, digite apenas os numeros das opcoes listadas.`,

  ASK_QUANTITY: (codigo, descricao) => `Quantas unidades de ${codigo} - ${descricao} deseja solicitar? (Digite apenas o numero)`,

  ASK_MOTIVO: "A peça é para atender ou Diagnóstico?\n1 - Atender\n2 - Diagnóstico",
  
  ASK_MD: "O equipamento está em MD?\n1 - Sim\n2 - Não",
  
  ASK_URGENCIA: "A peça é para atendimento imediato ou UTK?\n1 - Atendimento Imediato\n2 - UTK",

  REDUNDANCY_ALERT: (lista) => `Atenção: A(s) seguinte(s) peça(s) foi/foram solicitada(s) a menos de 15 dias para este mesmo equipamento:\n\n${lista}\nDeseja prosseguir mesmo assim?\n1 - Sim\n2 - Não`,

  REQUEST_SUMMARY: (tecnico, cliente, modelo, lista, motivo, md, urgencia) => `Resumo da Solicitacao:\n\nTecnico: ${tecnico}\nCliente: ${cliente}\nEquipamento: ${modelo}\n\nMotivo: ${motivo}\nEquipamento em MD: ${md}\nUrgência: ${urgencia}\n\nItens:\n${lista}\nConfirma a solicitacao?\nSim ou Nao`,

  REQUEST_SENT_TECH: `Sua solicitacao foi enviada para o Backoffice.`,

  REQUEST_RECEIVED_BO: (tecnico, cliente, modelo, dataHora, lista, motivo, md, urgencia, id, itensConsultados) => {
    let mdAlert = md === 'Sim' || md === '1' ? '🚨 EQUIPAMENTO EM MD (MÁQUINA PARADA) 🚨\n\n' : '';
    let finalidade = motivo === 'Diagnóstico' || motivo === '2' ? 'Para Diagnóstico' : 'Para Atendimento';
    
    let diretriz = '';
    const modeloUpper = modelo.toUpperCase();
    if (modeloUpper.includes('CIF')) {
      diretriz = '🛑 DIRETRIZ:\n👉 Fature a peça (Contrato CIF)\n\n';
    } else if (modeloUpper.includes('CAREPACK')) {
      diretriz = '🛑 DIRETRIZ:\n👉 Enviar orçamento de Nacionalização\n\n';
    } else if (modeloUpper.includes('VENDA')) {
      diretriz = '🛑 DIRETRIZ:\n👉 Enviar orçamento de venda\n\n';
    }

    let diretrizEdicula = '';
    if (itensConsultados) {
      const itensNaEdicula = itensConsultados.filter(i => i.isEdicula && i.quantidadeDesejada > 0);
      if (itensNaEdicula.length > 0) {
        diretrizEdicula = '🛑 DIRETRIZ:\n👉 PEÇA ENCONTRADA NA EDÍCULA\n';
        itensNaEdicula.forEach(i => {
          diretrizEdicula += `   - ${i.codigo}: Localização -> ${i.localizacao || 'N/A'}\n`;
        });
        diretrizEdicula += '\n';
      }
    }

    return `${mdAlert}Solicitacao de Pecas\n\nTecnico: ${tecnico}\nCliente: ${cliente}\nEquipamento: ${modelo}\nFinalidade: ${finalidade}\nData/Hora: ${dataHora}\n\nItens solicitados:\n${diretriz}${diretrizEdicula}${lista}\nFavor providenciar atendimento.\n\n📌 Protocolo #PD-${id}\nPara assumir e tratar este pedido, responda com:\n/analisar ${id}`;
  },

  BO_BAIXA_SUCCESS: (id, responsavel) => `✅ Sucesso! O pedido #PD-${id} foi assumido por ${responsavel} e está em análise.`,
  BO_BAIXA_ALREADY_DONE: (responsavel) => `O pedido está sendo analisado por ${responsavel}.`,
  BO_BAIXA_NOT_FOUND: (id) => `Erro: Pedido #PD-${id} não encontrado.`,

  ERROR_INVALID_OPTION: `Opcao invalida. Por favor, tente novamente.`,
  ERROR_GENERIC: `Desculpe, ocorreu um erro no sistema. Digite "menu" para reiniciar.`,
  SESSION_TIMEOUT: `Sua sessao expirou por inatividade. Envie um "Ola" para comecar novamente.`,
  TYPE_MENU_TO_RESET: `(Digite "menu" para voltar ao menu principal)`,

  JIGS_MENU: `*Controle de JIGs*\n1 - Consultar JIGs Disponiveis\n2 - Requisitar JIG\n3 - Devolver JIG\n4 - Voltar`,
  
  JIGS_AVAILABLE: (lista) => `JIGs disponiveis no momento:\n\n${lista}\n\nDigite "menu" para voltar.`,

  JIGS_ASK_CODE_REQ: `Digite o codigo HP da JIG que deseja REQUISITAR:`,
  JIGS_ASK_CLIENT: `Qual o cliente em que a JIG sera utilizada?`,
  JIGS_REQ_SUCCESS: (codigo) => `JIG ${codigo} requisitada com sucesso!`,
  
  JIGS_ASK_CODE_DEV: `Digite o codigo HP da JIG que deseja DEVOLVER:`,
  JIGS_DEV_SUCCESS: (codigo) => `JIG ${codigo} devolvida com sucesso!`,

  JIGS_ERROR_NOT_FOUND: `JIG nao encontrada. Verifique o codigo e tente novamente.`,
  JIGS_ERROR_UNAVAILABLE: `Esta JIG nao esta disponivel para requisicao no momento.`,
  JIGS_ERROR_AVAILABLE: `Esta JIG ja consta como disponivel e nao pode ser devolvida.`
};

module.exports = MESSAGES;
