const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const dbPath = path.resolve(__dirname, '../data/database.sqlite');
const initSqlJs = require('sql.js');

const filepath = 'C:\\Users\\ricardo.almeida\\OneDrive - Comprint Maquinas e Materiais Graficos Ltda\\PROJETOS\\AGENDA\\Agenda Time técnico - Copiar.xlsx';

const STATUS_INDISPONIVEL_WORDS = ["folga", "indisponível", "indisponivel", "ausente", "médico", "medico", "atestado", "consulta", "férias", "ferias"];
const STATUS_DESLOC_WORDS = ["desloc", "deslocamento"];

function excelDateToJSDate(serial) {
  // Excel base date is Dec 30, 1899
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400; 
  const date_info = new Date(utc_value * 1000);
  
  // Create Date using UTC values to avoid timezone shifts
  return new Date(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate());
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseCell(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  
  let status = "atendimento";
  let isIndisponivel = STATUS_INDISPONIVEL_WORDS.some(w => lower.includes(w));
  let isDesloc = STATUS_DESLOC_WORDS.some(w => lower.includes(w));

  if (isIndisponivel) status = "indisponivel";
  else if (isDesloc) status = "deslocamento";
  else if (lower.includes('pausa')) status = "pausa";
  else if (lower.includes('reunião') || lower.includes('reuniao')) status = "reuniao";

  let startTime = "08:30";
  let endTime = "17:00";

  if (lower.includes("manhã") || lower.includes("manha")) {
    endTime = "11:59";
  } else if (lower.includes("tarde")) {
    startTime = "13:01";
  }

  return { status, startTime, endTime, text: String(text).trim() };
}

async function run() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(dbPath));

  console.log("Lendo arquivo Excel...");
  const wb = xlsx.readFile(filepath);
  
  let totalImportados = 0;

  for (const sheetName of wb.SheetNames) {
    if (sheetName.startsWith('Planilha')) continue; // Skip default empty sheets

    console.log(`Processando aba: ${sheetName}`);
    const sheet = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length < 3) continue;

    // Row 1 contains Excel dates
    const dateRow = data[1]; 
    if (!dateRow || dateRow[0] !== 'DATA') continue;

    // Parse each technician (Row 2 and beyond)
    for (let r = 2; r < data.length; r++) {
      const row = data[r];
      const tecnicoNome = row[0];
      
      if (!tecnicoNome) continue;

      // Loop through columns starting from index 1
      for (let c = 1; c < dateRow.length; c++) {
        const serialDate = dateRow[c];
        const cellValue = row[c];

        if (typeof serialDate === 'number' && cellValue) {
          const jsDate = excelDateToJSDate(serialDate);
          const dataAgendamento = formatDate(jsDate);
          
          const parsed = parseCell(cellValue);
          if (parsed) {
            // Save to DB
            const stmt = db.prepare('INSERT INTO agendamentos (tecnico_nome, cliente, start_time, end_time, data_agendamento, status, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)');
            stmt.run([
              tecnicoNome,
              parsed.text,
              parsed.startTime,
              parsed.endTime,
              dataAgendamento,
              parsed.status,
              new Date().toISOString()
            ]);
            stmt.free();
            totalImportados++;
          }
        }
      }
    }
  }

  // Save the database
  const exportData = db.export();
  fs.writeFileSync(dbPath, Buffer.from(exportData));
  
  console.log(`Importação concluída! ${totalImportados} agendamentos salvos no banco SQLite.`);
}

run().catch(console.error);
