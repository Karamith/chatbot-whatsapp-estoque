const fs = require('fs');
const initSqlJs = require('sql.js');
const path = require('path');

const dbPath = path.resolve('./data/database.sqlite');

async function limparBanco() {
  try {
    console.log("Carregando o banco de dados...");
    const SQL = await initSqlJs();
    const dbBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(dbBuffer);
    
    // Deletar os itens das solicitações < 60
    db.run("DELETE FROM solicitacao_itens WHERE solicitacao_id < 60");
    console.log("Itens de pedidos antigos apagados.");

    // Deletar as solicitações < 60
    db.run("DELETE FROM solicitacoes WHERE id < 60");
    console.log("Pedidos antigos apagados.");

    // Salvar o arquivo
    const exportedData = db.export();
    fs.writeFileSync(dbPath, Buffer.from(exportedData));
    
    console.log("Banco de dados atualizado com sucesso!");
  } catch (err) {
    console.error("Erro:", err);
  }
}

limparBanco();
