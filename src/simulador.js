const readline = require('readline');
const { initDatabase } = require('./database/connection');
const { loadExcel, loadEdicula } = require('./estoque/excel');
const { loadClientesEquipamentos } = require('./clientes/excel');
const { handleIncomingMessage } = require('./chatbot/handler');
const webServer = require('./server/app');

async function startSimulador() {
  // Inicialização do Banco, Excel e Servidor
  await initDatabase();
  const carregouExcel = loadExcel();
  loadEdicula();
  if (!carregouExcel) {
    console.log("\n⚠️ AVISO: A planilha 'estoque.xlsx' não foi encontrada na pasta 'data/'.");
  }
  loadClientesEquipamentos();
  
  // Iniciar também o Dashboard Web no modo simulador
  await webServer.startServer(3500);

  console.log("\n===========================================");
  console.log("🤖 SIMULADOR DO CHATBOT DE ESTOQUE");
  console.log("===========================================\n");
  console.log("Você está conversando com o Bot direto do terminal, sem usar o WhatsApp.");
  console.log("Digite 'sair' a qualquer momento para encerrar.\n");

  // Simulador (Fake Client) que imita as funções do whatsapp-web.js
  const mockClient = {
    sendMessage: async (telefone, texto) => {
      console.log(`\n🤖 [BOT diz]:\x1b[36m\n${texto}\x1b[0m\n`); // Cor azul clara
      return true;
    }
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Usando um número válido de um técnico da planilha para não ser bloqueado (Ex: MESTRE)
  const TELEFONE_TESTE = "5511942274226@c.us";

  function perguntar() {
    rl.question('👤 [VOCÊ]: ', async (texto) => {
      if (texto.toLowerCase() === 'sair') {
        console.log("Encerrando simulador...");
        rl.close();
        process.exit(0);
      }
      
      // Objeto de mensagem simulado
      const mockMessage = {
        from: TELEFONE_TESTE,
        body: texto,
        isStatus: false,
        fromMe: false,
        getChat: async () => ({ isGroup: false })
      };
      
      try {
        await handleIncomingMessage(mockMessage, mockClient);
      } catch (e) {
        console.error("Erro processando mensagem:", e);
      }
      
      // Pequeno delay para a resposta não embolar com a próxima pergunta
      setTimeout(perguntar, 500);
    });
  }

  perguntar();
}

startSimulador().catch(err => {
  console.error("Erro ao inicializar:", err);
  process.exit(1);
});
