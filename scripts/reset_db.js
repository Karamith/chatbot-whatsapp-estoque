const fs = require('fs');
const path = require('path');
const { initDatabase, getDb, saveDb } = require('../src/database/connection');

async function resetDatabase() {
  console.log('Iniciando o reset do banco de dados...');
  
  try {
    // Inicializa o banco de dados carregando o SQLite em memória
    await initDatabase();
    const db = getDb();

    console.log('Apagando os dados do bot (sessoes, consultas, solicitacoes)...');

    // Executa as limpezas
    db.run('BEGIN TRANSACTION');
    
    // Tabela solicitacao_itens (filhos das solicitacoes)
    db.run('DELETE FROM solicitacao_itens');
    
    // Tabela solicitacoes
    db.run('DELETE FROM solicitacoes');
    
    // Tabela consultas
    db.run('DELETE FROM consultas');
    
    // Tabela sessoes
    db.run('DELETE FROM sessoes');
    
    db.run('COMMIT');

    // Salva as alterações de volta no arquivo SQLite
    saveDb();

    console.log('==================================================');
    console.log('SUCESSO! O banco de dados do bot foi zerado.');
    console.log('As tabelas mestre (JIGs, Técnicos, Backoffice, Usuários) foram mantidas.');
    console.log('O sistema está pronto para o Go Live.');
    console.log('==================================================');

  } catch (error) {
    console.error('Erro ao tentar resetar o banco de dados:', error);
  }
}

resetDatabase();
