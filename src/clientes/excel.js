const xlsx = require('xlsx');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

let dadosClientes = [];

function normalizarCliente(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function extrairModelos(row) {
  return Object.keys(row)
    .filter(coluna => normalizarCliente(coluna) !== 'CLIENTE')
    .map(coluna => String(row[coluna] || '').trim())
    .filter(Boolean);
}

function loadClientesEquipamentos() {
  try {
    const filePath = path.resolve(config.CLIENTES_FILE_PATH);
    console.log(`Carregando planilha de clientes/equipamentos de: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.warn(`Aviso: Arquivo de clientes/equipamentos nao encontrado em: ${filePath}`);
      dadosClientes = [];
      return false;
    }

    const workbook = xlsx.readFile(filePath);
    let sheetName = 'Clientes';

    if (!workbook.SheetNames.includes(sheetName)) {
      sheetName = workbook.SheetNames[0]; // fallback
      if (!sheetName) {
        throw new Error("A planilha de clientes/equipamentos está vazia.");
      }
    }

    const sheet = workbook.Sheets[sheetName];
    const dados = xlsx.utils.sheet_to_json(sheet);

    dadosClientes = dados
      .map(row => {
        const cliente = String(row.cliente || row.Cliente || row.CLIENTE || '').trim();
        return {
          cliente,
          cliente_normalizado: normalizarCliente(cliente),
          modelos: extrairModelos(row)
        };
      })
      .filter(item => item.cliente && item.modelos.length > 0);

    console.log(`Planilha de clientes/equipamentos carregada com sucesso. ${dadosClientes.length} clientes encontrados.`);
    return true;
  } catch (error) {
    console.error('Erro ao ler a planilha de clientes/equipamentos:', error.message);
    dadosClientes = [];
    return false;
  }
}

function buscarCliente(nomeCliente) {
  if (!dadosClientes || dadosClientes.length === 0) return null;

  const fuse = new Fuse(dadosClientes, {
    keys: ['cliente', 'cliente_normalizado'],
    threshold: config.FUZZY_THRESHOLD,
    distance: 100,
    includeScore: true,
    minMatchCharLength: 2
  });
  
  const resultados = fuse.search(nomeCliente);
  if (resultados.length > 0) {
    return resultados[0].item;
  }
  return null;
}

function getDadosClientes() {
  return dadosClientes;
}

module.exports = {
  loadClientesEquipamentos,
  buscarCliente,
  getDadosClientes,
  normalizarCliente
};
