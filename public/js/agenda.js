const STATUS_COLORS = {
  "atendimento": "bg-green",
  "deslocamento": "bg-yellow",
  "pausa": "bg-blue",
  "reuniao": "bg-purple",
  "indisponivel": "bg-red",
  "disponivel": "bg-gray"
};

const STATUS_LABELS = {
  "atendimento": "Em atendimento",
  "deslocamento": "Em deslocamento",
  "pausa": "Pausa / Intervalo",
  "reuniao": "Reunião",
  "indisponivel": "Indisponível",
  "disponivel": "disponível"
};

let currentMonday = new Date();
let allTecnicos = [];
let allEvents = [];
let selectedDate = getStrDate(new Date());
// Ajustar para segunda-feira
const day = currentMonday.getDay();
const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1); // ajusta se for domingo
currentMonday = new Date(currentMonday.setDate(diff));
currentMonday.setHours(0,0,0,0);

function getStrDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function updateColumnHeaders() {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + i);
    dates.push(d);
  }

  const columns = document.querySelectorAll('.day-column');
  const todayStr = getStrDate(new Date());

  columns.forEach((col, idx) => {
    if (idx < 7) {
      const d = dates[idx];
      const strDate = getStrDate(d);
      col.setAttribute('data-full-date', strDate);
      
      const dayHeader = col.querySelector('.day-header');
      const h3 = dayHeader.querySelector('h3');
      const dayDateSpan = col.querySelector('.day-date');
      
      if (dayDateSpan) {
        dayDateSpan.innerText = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      }

      // Limpar estilos inline antigos (agora usamos a classe column-today)
      col.style.border = '';
      col.style.background = '';
      h3.style.color = '';
      dayHeader.style.position = '';
      const oldBadge = dayHeader.querySelector('.badge-hoje');
      if (oldBadge) oldBadge.remove();

      if (strDate === selectedDate) {
        col.classList.add('column-today');
      } else {
        col.classList.remove('column-today');
      }

      // Badge HOJE
      if (strDate === todayStr) {
        dayHeader.style.position = 'relative';
        h3.style.color = 'var(--color-green)';
        
        const badge = document.createElement('span');
        badge.className = 'badge-hoje';
        badge.innerText = 'HOJE';
        badge.style.position = 'absolute';
        badge.style.right = '10px';
        badge.style.top = '16px';
        badge.style.background = 'var(--color-green)';
        badge.style.color = 'var(--bg-dark)';
        badge.style.fontSize = '0.65rem';
        badge.style.fontWeight = '700';
        badge.style.padding = '2px 6px';
        badge.style.borderRadius = '12px';
        
        dayHeader.appendChild(badge);
      }

      // Adicionar evento de clique na coluna
      col.onclick = () => {
        selectedDate = strDate;
        updateColumnHeaders(); // Atualiza as bordas
        renderSidebar(); // Atualiza a barra lateral
      };
    }
  });

  const sunday = dates[6];
  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  document.getElementById('week-dates-label').innerText = `${currentMonday.getDate()} a ${sunday.getDate()} de ${monthNames[sunday.getMonth()]}`;
}

async function fetchTecnicos() {
  try {
    const res = await fetch('/api/tecnicos');
    if (!res.ok) throw new Error("Erro ao buscar tÃ©cnicos");
    allTecnicos = await res.json(); // Array de { nome, cargo }
  } catch (err) {
    console.error(err);
  }
}

async function fetchAgenda() {
  const startStr = getStrDate(currentMonday);
  const sunday = new Date(currentMonday);
  sunday.setDate(currentMonday.getDate() + 6);
  const endStr = getStrDate(sunday);

  document.getElementById('sync-time').innerText = new Date().toLocaleString('pt-BR');

  try {
    const token = localStorage.getItem('bo_token');
    const res = await fetch(`/api/agenda?start=${startStr}&end=${endStr}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Erro ao buscar agenda");
    const data = await res.json();
    allEvents = data; // Armazena globalmente
    renderEvents(data);
    renderSidebar(); // Atualiza barra lateral com base na selectedDate
  } catch (err) {
    console.error(err);
  }
}

function renderEvents(events) {
  // Limpar colunas
  document.querySelectorAll('.day-body').forEach(el => el.innerHTML = '');

  events.forEach(ev => {
    // Pula agendamentos que vieram vazios/fantasmas da planilha
    if (!ev.tecnico_nome || ev.tecnico_nome.trim() === '') return;

    // Regra: Filtrar férias/folgas aos sÃ¡bados e domingos
    const dateObj = new Date(ev.data_agendamento + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const statusLower = String(ev.status).toLowerCase();
      const clienteLower = String(ev.cliente).toLowerCase();
      if (statusLower.includes('férias') || statusLower.includes('ferias') || 
          clienteLower.includes('férias') || clienteLower.includes('ferias') ||
          statusLower.includes('folga') || clienteLower.includes('folga')) {
        return; // Pula este evento no fds
      }
    }

    const col = document.querySelector(`.day-column[data-full-date="${ev.data_agendamento}"] .day-body`);
    if (!col) return;

    const card = document.createElement('div');
    
    // Determinar a cor do Neon baseado no status ou cliente
    let neonClass = 'neon-green';
    const statL = String(ev.status).toLowerCase();
    const cliL = String(ev.cliente).toLowerCase();
    
    if (cliL.includes('carecenter') || cliL.includes('care center')) {
      neonClass = 'card-carecenter';
    } else if (statL.includes('férias') || statL.includes('ferias') || cliL.includes('férias') || cliL.includes('ferias')) {
      neonClass = 'neon-gray';
    } else if (statL.includes('deslocamento')) {
      neonClass = 'neon-yellow';
    } else if (statL.includes('indispon') || statL.includes('ausente') || statL.includes('médico') || statL.includes('atestado') || statL.includes('consulta') || statL.includes('folga') || cliL.includes('folga')) {
      neonClass = 'neon-red';
    } else if (statL.includes('atendimento')) {
      neonClass = 'neon-blue';
    } else {
      neonClass = 'neon-green'; // Default para disponível, plantÃ£o, etc
    }

    card.className = `event-card ${neonClass}`;
    card.setAttribute('data-id', ev.id);
    card.innerHTML = `
      <div class="event-header">
        <div class="event-tecnico">
          <img src="/api/avatar/${encodeURIComponent(ev.tecnico_nome)}" onerror="this.src='/bo-assets/imgs/user-default.png'" alt="${ev.tecnico_nome}">
          <div>
            <div class="event-tecnico-nome">${ev.tecnico_nome}</div>
            <div class="event-cliente">${ev.cliente}</div>
          </div>
        </div>
      </div>
      <div class="event-status">
        <span class="status-dot ${STATUS_COLORS[ev.status] || 'bg-gray'}"></span>
        <span>${STATUS_LABELS[ev.status] || ev.status}</span>
      </div>
    `;
    col.appendChild(card);
  });
}

function initSortable() {
  const columns = document.querySelectorAll('.day-body');
  columns.forEach(col => {
    new Sortable(col, {
      group: 'shared',
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: async function (evt) {
        const item = evt.item;
        const evId = item.getAttribute('data-id');
        const newCol = evt.to.closest('.day-column');
        
        // Se soltou fora de uma coluna de dia (ex: lista de disponíveis, não tratamos aqui)
        if (!newCol) return;

        const newDate = newCol.getAttribute('data-full-date');

        try {
          const token = localStorage.getItem('bo_token');
          const res = await fetch(`/api/agenda/${evId}/dia`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data_agendamento: newDate })
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Erro ao mover agendamento');
          }
          // Update visual sync time
          document.getElementById('sync-time').innerText = new Date().toLocaleString('pt-BR');
        } catch (e) {
          console.error("Erro ao atualizar data:", e);
          alert(e.message);
          fetchAgenda(); // Recarrega para voltar o card ao lugar original
        }
      }
    });
  });

  const listDisponiveis = document.getElementById('list-disponiveis');
  if (listDisponiveis) {
    new Sortable(listDisponiveis, {
      group: 'shared',
      animation: 150,
      onAdd: async function (evt) {
        const item = evt.item;
        const evId = item.getAttribute('data-id');
        if (evId) {
          try {
            const token = localStorage.getItem('bo_token');
            const res = await fetch(`/api/agenda/${evId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (!res.ok) throw new Error('Erro ao remover agendamento');
            
            item.remove();
            await fetchAgenda();
          } catch(e) {
            console.error("Erro ao remover:", e);
            alert("Erro ao remover o agendamento.");
            fetchAgenda();
          }
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateColumnHeaders();
  fetchTecnicos().then(() => fetchAgenda());
  initSortable();

  const btnPrev = document.getElementById('btn-prev-week');
  const btnNext = document.getElementById('btn-next-week');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      currentMonday.setDate(currentMonday.getDate() - 7);
      updateColumnHeaders();
      fetchAgenda();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      currentMonday.setDate(currentMonday.getDate() + 7);
      updateColumnHeaders();
      fetchAgenda();
    });
  }
});


function renderSidebar() {
  const listDisponiveis = document.getElementById('list-disponiveis');
  const listIndisponiveis = document.getElementById('list-indisponiveis');
  
  if (!listDisponiveis || !listIndisponiveis) return;

  listDisponiveis.innerHTML = '';
  listIndisponiveis.innerHTML = '';

  let contDisponiveis = 0;
  let contIndisponiveis = 0;

  // Encontrar todos os eventos do selectedDate
  const eventosDoDia = allEvents.filter(ev => ev.data_agendamento === selectedDate);
  
  // Helper: remove acentos para comparação
  function semAcento(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // Helper: colapsa letras duplicadas consecutivas (ATHANASSIOS → ATHANASIOS)
  function semDuplas(str) {
    return str.replace(/(.)\1+/g, '$1');
  }

  // Helper: checa se o nome do evento "casa" com o nome curto do técnico
  // Cobre: acentos (FLÁVIO→FLAVIO), primeiro nome (DOUGLAS→DOUGLAS LIMA),
  // sobrenome (ZANELLA→EMERSON ZANELLA), nome composto (FELIPE DAVID→FELIPE DAVID),
  // letras duplas (ATHANASIOS→ATHANASSIOS)
  function nomesCasam(nomeTecnico, nomeEvento) {
    const tNorm = semAcento(nomeTecnico.trim().toUpperCase());
    const eNorm = semAcento(nomeEvento.trim().toUpperCase());
    // Exato
    if (tNorm === eNorm) return true;
    // O nome do evento começa com o nome do técnico + espaço
    if (eNorm.startsWith(tNorm + ' ')) return true;
    // O nome do técnico começa com o nome do evento + espaço
    if (tNorm.startsWith(eNorm + ' ')) return true;
    // O nome do evento termina com o nome do técnico (sobrenome)
    if (eNorm.endsWith(' ' + tNorm)) return true;
    // O nome do evento contém o nome do técnico como palavra inteira
    if (eNorm.includes(' ' + tNorm + ' ') || eNorm.includes(' ' + tNorm)) return true;

    // Fallback: mesma coisa mas colapsando letras duplas (ATHANASSIOS ↔ ATHANASIOS)
    const tFuzzy = semDuplas(tNorm);
    const eFuzzy = semDuplas(eNorm);
    if (tFuzzy === eFuzzy) return true;
    if (eFuzzy.startsWith(tFuzzy + ' ')) return true;
    if (tFuzzy.startsWith(eFuzzy + ' ')) return true;
    if (eFuzzy.endsWith(' ' + tFuzzy)) return true;
    if (eFuzzy.includes(' ' + tFuzzy + ' ') || eFuzzy.includes(' ' + tFuzzy)) return true;

    return false;
  }

  // Para cada técnico, classificar seus eventos do dia
  allTecnicos.forEach(t => {
    // Buscar todos os eventos desse técnico no dia
    const meus = eventosDoDia.filter(ev => {
      if (!ev.tecnico_nome || ev.tecnico_nome.trim() === '') return false;
      return nomesCasam(t.nome, ev.tecnico_nome);
    });

    // Filtro fds (remove férias/folga do sábado/domingo da contagem)
    const meusValidos = meus.filter(ev => {
      const dateObj = new Date(ev.data_agendamento + 'T00:00:00');
      const dow = dateObj.getDay();
      if (dow === 0 || dow === 6) {
        const sL = String(ev.status).toLowerCase();
        const cL = String(ev.cliente).toLowerCase();
        if (sL.includes('férias') || sL.includes('ferias') || cL.includes('férias') || cL.includes('ferias') || sL.includes('folga') || cL.includes('folga')) {
          return false;
        }
      }
      return true;
    });

    // Classificar
    let ehIndisponivel = false;
    let ehAtendimento = false;
    let motivoIndisponivel = '';

    const palavrasIndisponivel = ['férias', 'ferias', 'folga', 'indispon', 'ausente', 'médico', 'medico', 'atestado'];

    meusValidos.forEach(ev => {
      const statL = String(ev.status).toLowerCase();
      const cliL = String(ev.cliente || '').toLowerCase().trim();

      if (palavrasIndisponivel.some(p => statL.includes(p) || cliL.includes(p))) {
        ehIndisponivel = true;
        motivoIndisponivel = ev.cliente && cliL !== '' ? ev.cliente : ev.status;
      } else {
        const temCliente = (cliL !== '' && cliL !== '-' && cliL !== 'null' && cliL !== 'disponível' && cliL !== 'disponivel');
        if (temCliente || statL.includes('atendimento') || statL.includes('deslocamento')) {
          ehAtendimento = true;
        }
      }
    });

    // Indisponível sempre vence sobre atendimento
    if (ehIndisponivel) {
      // Mostrar como Indisponível
      const li = document.createElement('li');
      const imgUrl = '/api/avatar/' + encodeURIComponent(t.nome);
      li.innerHTML = `
        <img src="${imgUrl}" onerror="this.src='/bo-assets/imgs/user-default.png'">
        <div class="tecnico-info">
          <span class="nome">${t.nome}</span>
          <span class="cargo"><span style="color:var(--color-red); font-size:10px;">●</span> ${motivoIndisponivel || 'Indisponível'}</span>
        </div>
      `;
      listIndisponiveis.appendChild(li);
      contIndisponiveis++;
    } else if (ehAtendimento) {
      // Em atendimento: NÃO aparece na barra lateral
      return;
    } else {
      // Disponível (sem evento ou evento verde)
      const li = document.createElement('li');
      const imgUrl = '/api/avatar/' + encodeURIComponent(t.nome);
      li.innerHTML = `
        <img src="${imgUrl}" onerror="this.src='/bo-assets/imgs/user-default.png'">
        <div class="tecnico-info">
          <span class="nome">${t.nome}</span>
          <span class="cargo"><span style="color:var(--color-green); font-size:10px;">●</span> Livre</span>
        </div>
      `;
      listDisponiveis.appendChild(li);
      contDisponiveis++;
    }
  });

  document.getElementById('count-disponiveis').innerText = contDisponiveis;
  document.getElementById('count-indisponiveis').innerText = contIndisponiveis;
}

// --- Lógica do Modal de Agendamento ---
const modalAgendamento = document.getElementById('modal-agendamento');
const btnAddEvent = document.getElementById('btn-add-agendamento');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelarModal = document.getElementById('btn-cancelar-modal');
const formAgendamento = document.getElementById('form-agendamento');
const selectTecnico = document.getElementById('select-tecnico');
const selectData = document.getElementById('select-data');
const selectStatus = document.getElementById('select-status');
const inputCliente = document.getElementById('input-cliente');

function abrirModalAgendamento() {
  // Preencher Técnicos
  selectTecnico.innerHTML = '<option value="">Selecione um técnico...</option>';
  allTecnicos.filter(t => t.cargo !== 'BO').forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.nome;
    opt.textContent = t.nome;
    selectTecnico.appendChild(opt);
  });

  // Definir a data do calendário
  if (selectedDate) {
    selectData.value = selectedDate;
  } else {
    selectData.value = getStrDate(new Date());
  }

  // Resetar campos
  selectStatus.value = 'Atendimento';
  inputCliente.value = '';
  inputCliente.disabled = false;
  document.getElementById('select-periodo').value = 'manha';

  modalAgendamento.classList.add('active');
}

function fecharModalAgendamento() {
  modalAgendamento.classList.remove('active');
}

if (btnAddEvent) btnAddEvent.addEventListener('click', abrirModalAgendamento);
if (btnCloseModal) btnCloseModal.addEventListener('click', fecharModalAgendamento);
if (btnCancelarModal) btnCancelarModal.addEventListener('click', fecharModalAgendamento);

// Fechar modal ao clicar fora
modalAgendamento.addEventListener('click', (e) => {
  if (e.target === modalAgendamento.querySelector('.modal-overlay')) {
    fecharModalAgendamento();
  }
});

// Desabilitar cliente se for ausência
selectStatus.addEventListener('change', () => {
  const val = selectStatus.value;
  if (['Folga', 'Atestado', 'Ausente', 'Médico', 'Férias', 'Treinamento'].includes(val)) {
    inputCliente.value = '-';
    inputCliente.disabled = true;
  } else {
    if (inputCliente.value === '-') inputCliente.value = '';
    inputCliente.disabled = false;
  }
});

formAgendamento.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const tecnico = selectTecnico.value;
  const data = selectData.value;
  const status = selectStatus.value;
  let cliente = inputCliente.value.trim();
  const periodo = document.getElementById('select-periodo').value;

  if (!tecnico || !data) return;
  if (inputCliente.disabled) cliente = '-'; // Garantir que não envie vazio se disabled

  let startTime, endTime;
  if (periodo === 'manha') {
    startTime = '08:30:00';
    endTime = '13:00:00';
  } else if (periodo === 'tarde') {
    startTime = '13:01:00';
    endTime = '17:30:00';
  } else if (periodo === 'integral') {
    startTime = '08:30:00';
    endTime = '17:30:00';
  }

  const payload = {
    tecnico_nome: tecnico,
    cliente: cliente,
    start_time: startTime,
    end_time: endTime,
    data_agendamento: data,
    status: status
  };

  try {
    const res = await fetch('/api/agenda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error('Erro ao salvar agendamento');
    
    fecharModalAgendamento();
    // Recarregar os eventos e a tela
    await fetchAgenda();
  } catch (error) {
    console.error(error);
    alert('Erro ao salvar o agendamento.');
  }
});
