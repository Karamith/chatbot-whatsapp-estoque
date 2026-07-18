const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const dirPath = path.resolve('./data');
const estoquePath = path.join(dirPath, 'estoque.xlsx');
const clientesPath = path.join(dirPath, 'clientes_equipamentos.xlsx');

if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const dadosEstoque = [
  { codigo: 'ABC123', descricao: 'Fonte de Alimentacao 24V', quantidade: 12 },
  { codigo: 'ABC456', descricao: 'Fonte de Alimentacao 48V', quantidade: 5 },
  { codigo: 'DEF789', descricao: 'Modulo Principal de Alimentacao', quantidade: 0 },
  { codigo: 'GHI012', descricao: 'Controlador da Placa Principal', quantidade: 8 },
  { codigo: 'JKL345', descricao: 'Display LCD 7 polegadas', quantidade: 3 },
  { codigo: '12345', descricao: 'Correia de Transmissao', quantidade: 15 },
  { codigo: '7A2B', descricao: 'Sensor de Temperatura', quantidade: 4 }
];

const estoqueWorksheet = xlsx.utils.json_to_sheet(dadosEstoque);
const estoqueWorkbook = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(estoqueWorkbook, estoqueWorksheet, 'Estoque');
xlsx.writeFile(estoqueWorkbook, estoquePath);

const dadosClientes = [
  { cliente: 'Empresa XYZ', modelo_1: 'Ricoh Pro C5200', modelo_2: 'Ricoh Pro C7200', modelo_3: 'Polar 92' },
  { cliente: 'Grafica Exemplo', modelo_1: 'Heidelberg XL75', modelo_2: 'Stahlfolder TH82', modelo_3: '' },
  { cliente: 'Cliente Teste', modelo_1: 'Komori Lithrone G40', modelo_2: '', modelo_3: '' }
];

const clientesWorksheet = xlsx.utils.json_to_sheet(dadosClientes);
const clientesWorkbook = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(clientesWorkbook, clientesWorksheet, 'Clientes');
xlsx.writeFile(clientesWorkbook, clientesPath);

console.log(`\nArquivo de estoque criado com sucesso em: ${estoquePath}`);
console.log(`Ele contem ${dadosEstoque.length} pecas cadastradas para teste.`);
console.log(`\nArquivo de clientes/equipamentos criado com sucesso em: ${clientesPath}`);
console.log(`Ele contem ${dadosClientes.length} clientes cadastrados para teste.`);
