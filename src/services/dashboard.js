const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function excelDateToJSDate(excelDate) {
  if (!excelDate || isNaN(excelDate)) return null;
  const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
  jsDate.setMinutes(jsDate.getMinutes() + jsDate.getTimezoneOffset());
  return jsDate;
}

function formatDateToBR(jsDate) {
  if (!jsDate) return 'N/A';
  const dia = String(jsDate.getDate()).padStart(2, '0');
  const mes = String(jsDate.getMonth() + 1).padStart(2, '0');
  const ano = jsDate.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function normalizarNome(nome) {
  return String(nome || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function getDashboardData() {
  const baseFilePath = path.join(__dirname, '../../data/Base Instalada.xlsx');

  let baseRows = [];

  if (fs.existsSync(baseFilePath)) {
    try {
      const wbBase = xlsx.readFile(baseFilePath);
      const sheetBase = wbBase.Sheets['BASE'];
      if (sheetBase) {
        baseRows = xlsx.utils.sheet_to_json(sheetBase, { defval: '' });
      }
    } catch (err) {
      console.error('Erro ao ler Base Instalada.xlsx:', err);
    }
  } else {
    console.warn('Aviso: Base Instalada.xlsx não encontrado.');
  }

  const clientesMap = {};

  baseRows.forEach(row => {
    const nomeOriginal = String(row.CLIENTE || '').trim();
    if (!nomeOriginal) return;
    
    const nomeNormalizado = normalizarNome(nomeOriginal);
    
    if (!clientesMap[nomeNormalizado]) {
      clientesMap[nomeNormalizado] = {
        cliente: nomeOriginal,
        cliente_normalizado: nomeNormalizado,
        equipamentos: []
      };
    }
    
    const equipamento = String(row.EPTO || '').trim();
    const contrato = String(row.TIPO_1 || '').trim();

    const inicio = Number(row['INÍCIO']);
    const final = Number(row.FINAL);
    const hoje = Number(row['Hoje']); 

    const timestampHoje = Date.now() / (86400 * 1000) + 25569; 
    const valorHoje = isNaN(hoje) || hoje === 0 ? timestampHoje : hoje;

    let porcentagem = 0;
    
    if (!isNaN(inicio) && !isNaN(final) && final > inicio) {
      const diffTotal = final - inicio;
      const diffAtual = valorHoje - inicio;
      porcentagem = (diffAtual / diffTotal) * 100;
      
      if (porcentagem > 100) porcentagem = 100;
      if (porcentagem < 0) porcentagem = 0;
    } else if (row.META !== undefined && row.META !== '') {
      porcentagem = Number(row.META);
    }

    const dataEncerramento = formatDateToBR(excelDateToJSDate(final));
    const diasRestantes = row.DIAS !== undefined ? row.DIAS : 'N/A';
    const servicos = String(row['Serviços'] || row['SERVIÇOS'] || row['SERVICOS'] || row['SERVIÇO'] || '').trim();

    let contratoFinal = contrato;
    let porcentagemFinal = porcentagem;

    const numDias = Number(diasRestantes);
    if (!isNaN(numDias) && numDias <= 0) {
      contratoFinal = 'VENDA';
      porcentagemFinal = 100;
    }

    clientesMap[nomeNormalizado].equipamentos.push({
      equipamento: equipamento || 'N/A',
      contrato: contratoFinal || '-',
      servicos: servicos || '-',
      data_encerramento: dataEncerramento,
      dias_restantes: diasRestantes,
      progresso_porcentagem: parseFloat(porcentagemFinal.toFixed(1))
    });
  });

  const dashboardData = Object.values(clientesMap);
  dashboardData.sort((a, b) => a.cliente.localeCompare(b.cliente));

  return dashboardData;
}

module.exports = {
  getDashboardData
};
