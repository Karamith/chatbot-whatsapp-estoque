const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

function exportToExcel() {
  const { getDb } = require('./connection');
  const db = getDb();
  
  const query = `
    SELECT 
      s.id as "ID Pedido",
      s.status_pedido as "Status",
      s.criada_em as "Data/Hora",
      s.tecnico_nome as "Técnico",
      s.cliente as "Cliente",
      s.modelo as "Equipamento",
      s.md as "MD?",
      s.motivo as "Motivo",
      s.urgencia as "Urgência",
      i.codigo_peca as "Código da Peça",
      i.descricao_peca as "Descrição",
      i.quantidade_solicitada as "Qtd Solicitada"
    FROM solicitacoes s
    JOIN solicitacao_itens i ON s.id = i.solicitacao_id
    ORDER BY s.tecnico_nome, s.id DESC
  `;
  
  const result = db.exec(query);
  if (!result || result.length === 0) return;
  
  const columns = result[0].columns;
  const values = result[0].values;
  
  const rows = values.map(valArray => {
    let rowObj = {};
    columns.forEach((col, idx) => {
      // Formata a data se for a coluna "Data/Hora"
      if (col === 'Data/Hora' && valArray[idx]) {
        try {
          rowObj[col] = new Date(valArray[idx]).toLocaleString('pt-BR');
        } catch(e) {
          rowObj[col] = valArray[idx];
        }
      } else {
        rowObj[col] = valArray[idx];
      }
    });
    return rowObj;
  });
  
  // Agrupar por técnico
  const agrupadoPorTecnico = {};
  rows.forEach(row => {
    let tecnico = row['Técnico'] || 'Sem_Nome';
    // Remove invalid characters for excel sheet name
    tecnico = tecnico.replace(/[\\/?*[\]]/g, '').trim().substring(0, 31);
    
    if (!agrupadoPorTecnico[tecnico]) {
      agrupadoPorTecnico[tecnico] = [];
    }
    agrupadoPorTecnico[tecnico].push(row);
  });
  
  // Cria o Workbook e adiciona as abas
  const wb = xlsx.utils.book_new();
  
  // Cria também uma aba Geral com todas as solicitações (útil para dashboard consolidado)
  const wsGeral = xlsx.utils.json_to_sheet(rows);
  xlsx.utils.book_append_sheet(wb, wsGeral, 'TODAS_SOLICITACOES');
  
  // Adiciona uma aba para cada técnico
  Object.keys(agrupadoPorTecnico).forEach(tecnico => {
    const ws = xlsx.utils.json_to_sheet(agrupadoPorTecnico[tecnico]);
    xlsx.utils.book_append_sheet(wb, ws, tecnico);
  });
  
  // Salva o arquivo
  const outPath = path.resolve('./data/banco_solicitacoes.xlsx');
  xlsx.writeFile(wb, outPath);
  console.log(`[Export] Banco de dados Excel atualizado com sucesso em: ${outPath}`);
}

module.exports = {
  exportToExcel
};
