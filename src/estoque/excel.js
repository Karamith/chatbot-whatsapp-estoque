const xlsx = require('xlsx');
const config = require('../config');
const fs = require('fs');
const path = require('path');

let dadosEstoque = [];
let dadosEdicula = [];

/**
 * Carrega a planilha Excel e converte para JSON
 */
function loadExcel() {
  try {
    const filePath = path.resolve(config.EXCEL_FILE_PATH);
    console.log(`Carregando planilha de: ${filePath}`);
    
    // Verifica se o arquivo existe
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Arquivo Excel não encontrado em: ${filePath}`);
      return false;
    }
    
    const workbook = xlsx.readFile(filePath);
    
    // Validar se a aba 'Estoque' existe, ou pegar a primeira
    let sheetName = 'Estoque';
    if (!workbook.SheetNames.includes(sheetName)) {
      sheetName = workbook.SheetNames[0]; // fallback to the first sheet
      if (!sheetName) {
        throw new Error("A planilha esta vazia (nenhuma aba encontrada).");
      }
    }
    
    // Converter aba para matriz
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    // Encontrar a linha de cabeçalho
    let headerRowIndex = -1;
    let colIndexCodigo = -1;
    let colIndexDescricao = -1;
    let colIndexSaldo = -1;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      
      const rowStrings = row.map(cell => String(cell || '').trim().toLowerCase());
      const idxCodigo = rowStrings.indexOf('código');
      const idxDescricao = rowStrings.indexOf('descrição');
      const idxSaldo = rowStrings.indexOf('sld. disponível');

      if (idxCodigo !== -1 && idxDescricao !== -1 && idxSaldo !== -1) {
        headerRowIndex = i;
        colIndexCodigo = idxCodigo;
        colIndexDescricao = idxDescricao;
        colIndexSaldo = idxSaldo;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error("Não foi possível encontrar as colunas 'Código', 'Descrição' e 'Sld. Disponível' na planilha.");
    }

    dadosEstoque = [];
    
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const codigo = String(row[colIndexCodigo] || '').trim().toUpperCase();
      const descricao = String(row[colIndexDescricao] || '').trim();
      const saldoStr = String(row[colIndexSaldo] || '0').replace(',', '.');
      const quantidade = parseFloat(saldoStr) || 0;

      if (codigo) {
        // Se houver múltiplas filiais para o mesmo item, podemos somar.
        const existing = dadosEstoque.find(item => item.codigo === codigo);
        if (existing) {
          existing.quantidade += quantidade;
        } else {
          dadosEstoque.push({
            codigo,
            descricao,
            quantidade
          });
        }
      }
    }
    
    console.log(`✅ Planilha carregada com sucesso. ${dadosEstoque.length} itens encontrados.`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao ler a planilha Excel:', error);
    return false;
  }
}

/**
 * Carrega a planilha da Edícula e converte para JSON
 */
function loadEdicula() {
  try {
    const filePath = path.resolve('./data/edicula.xlsx');
    console.log(`Carregando planilha da Edícula de: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Planilha da Edícula não encontrada em: ${filePath}. (Opcional)`);
      return false;
    }
    
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("A planilha da Edícula está vazia.");
    
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    let headerRowIndex = -1;
    let colIndexCodigo = -1;
    let colIndexDescricao = -1;
    let colIndexSaldo = -1;
    let colIndexLocal = -1;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      
      const rowStrings = row.map(cell => String(cell || '').trim().toLowerCase());
      const idxCodigo = rowStrings.indexOf('código');
      const idxDescricao = rowStrings.indexOf('descrição');
      const idxSaldo = rowStrings.findIndex(str => str.includes('quant'));
      const idxLocal = rowStrings.findIndex(str => str.includes('local'));

      if (idxCodigo !== -1 && idxSaldo !== -1) {
        headerRowIndex = i;
        colIndexCodigo = idxCodigo;
        colIndexDescricao = idxDescricao;
        colIndexSaldo = idxSaldo;
        colIndexLocal = idxLocal;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error("Não foi possível encontrar as colunas na planilha da Edícula.");
    }

    dadosEdicula = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const codigo = String(row[colIndexCodigo] || '').trim().toUpperCase();
      const descricao = colIndexDescricao !== -1 ? String(row[colIndexDescricao] || '').trim() : '';
      const saldoStr = String(row[colIndexSaldo] || '0').replace(',', '.');
      const quantidade = parseFloat(saldoStr) || 0;
      const localizacao = colIndexLocal !== -1 ? String(row[colIndexLocal] || '').trim() : '';

      if (codigo) {
        dadosEdicula.push({
          codigo,
          descricao,
          quantidade,
          localizacao,
          isEdicula: true
        });
      }
    }
    
    console.log(`✅ Edícula carregada com sucesso. ${dadosEdicula.length} itens encontrados.`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao ler a planilha da Edícula:', error);
    return false;
  }
}

/**
 * Retorna os dados atuais da memória
 */
function getDadosEstoque() {
  return dadosEstoque;
}

function getDadosEdicula() {
  return dadosEdicula;
}

/**
 * Busca um item pelo código exato
 */
function buscarPorCodigo(codigo) {
  const codigoNormalizado = codigo.trim().toUpperCase();
  
  const itemEstoque = dadosEstoque.find(item => item.codigo === codigoNormalizado);
  const itemEdicula = dadosEdicula.find(item => item.codigo === codigoNormalizado);

  // 1. Se tem no estoque oficial e o saldo é > 0, prioriza o estoque oficial
  if (itemEstoque && itemEstoque.quantidade > 0) {
    return itemEstoque;
  }

  // 2. Se não tem no estoque oficial (ou o saldo é 0) mas tem na Edícula com saldo > 0, usa a Edícula
  if (itemEdicula && itemEdicula.quantidade > 0) {
    return itemEdicula;
  }

  // 3. Se nenhum dos dois tem saldo, mas o item existe em alguma base, retorna ele (Estoque primeiro, depois Edícula)
  if (itemEstoque) {
    return itemEstoque;
  }
  
  if (itemEdicula) {
    return itemEdicula;
  }

  return null;
}

module.exports = {
  loadExcel,
  loadEdicula,
  getDadosEstoque,
  getDadosEdicula,
  buscarPorCodigo
};

