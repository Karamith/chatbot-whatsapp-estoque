const xlsx = require('xlsx');

const filepath = 'C:\\Users\\ricardo.almeida\\OneDrive - Comprint Maquinas e Materiais Graficos Ltda\\PROJETOS\\AGENDA\\Agenda Time técnico - Copiar.xlsx';
const wb = xlsx.readFile(filepath);

console.log("Planilhas encontradas:");
console.log(wb.SheetNames);

const primeiraAba = wb.Sheets['JUL-26'];
const dados = xlsx.utils.sheet_to_json(primeiraAba, { header: 1 });

console.log("\nPrimeiras 10 linhas da aba JUL-26:");
console.log(JSON.stringify(dados.slice(0, 10), null, 2));
