const Fuse = require('fuse.js');
const config = require('../config');
const { getDadosEstoque } = require('./excel');

/**
 * Realiza uma busca aproximada (fuzzy search) na descriÃ§Ã£o das peÃ§as
 * Busca somente na descricao em portugues\r
 */
function buscarPorDescricao(termo) {
  const { getDadosEstoque, getDadosEdicula } = require('./excel');
  const dados = [...(getDadosEstoque() || []), ...(getDadosEdicula() || [])];
  
  if (!dados || dados.length === 0) {
    console.warn('Busca realizada com estoque vazio ou não carregado.');
    return [];
  }
  
  // Configurar o Fuse.js
  const fuse = new Fuse(dados, {
    keys: ['descricao'],
    threshold: config.FUZZY_THRESHOLD,    // 0.4 = tolerÃ¢ncia moderada
    distance: 100,
    includeScore: true,
    minMatchCharLength: 3
  });
  
  // Realizar a busca
  const resultados = fuse.search(termo);
  
  // Limitar e formatar os resultados
  return resultados
    .slice(0, config.FUZZY_MAX_RESULTS)
    .map(resultado => ({
      ...resultado.item,
      score: resultado.score  // Quanto menor o score, mais prÃ³ximo de 0, mais relevante
    }));
}

module.exports = { 
  buscarPorDescricao 
};

