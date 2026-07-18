const bcrypt = require('bcryptjs');
const { getDb, saveDb, initDatabase } = require('../src/database/connection');
const queries = require('../src/database/queries');

async function run() {
  await initDatabase(); // Isso vai garantir que a tabela usuarios_bo seja criada via migrarSchemaCondado e criarTabelas
  
  const usuario = 'admin';
  const senha = '123';
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(senha, salt);

  try {
    queries.criarUsuarioBO(usuario, hash);
    saveDb();
    console.log('Usuário admin criado com sucesso (senha: 123)');
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      console.log('Usuário admin já existe.');
    } else {
      console.error(e);
    }
  }
}

run();
