document.addEventListener('DOMContentLoaded', () => {
  fetchKPIs();
  updateWorkdayProgress();
  fetchReposicoes();
  fetchDatabase();
  // Atualiza a mascote/horário a cada 60 segundos
  setInterval(updateWorkdayProgress, 60000);
  
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('kanban_update', () => {
      fetchKPIs();
      fetchReposicoes();
      fetchDatabase();
    });
  }
});

function updateWorkdayProgress() {
  const now = new Date();
  const d = now.getDay();
  const m = (now.getHours() * 60) + now.getMinutes();
  
  const startMinutes = 510; // 08:30
  const endMinutes = 1050;  // 17:30
  const totalDuration = 540; // 540 minutos
  
  let progress = 0;
  let showSpeech = false;
  let speechText = "";
  let showMascot = true;
  let statusText = "Expediente em Andamento";
  let isOffHours = false;
  
  if (d === 0 || d === 6) {
    // Final de semana
    showMascot = false;
    showSpeech = false;
    statusText = "O expediente retorna no próximo dia útil";
    progress = 0;
    isOffHours = true;
  } else {
    // Dia de semana
    if (m >= 451 && m < 510) { // 07:31 às 08:29
      progress = 0; // Mascote volta pro início
      showSpeech = false;
      statusText = "O expediente iniciará em breve";
      isOffHours = true;
    } else if (m >= 510 && m <= 540) { // 08:30 às 09:00
      progress = ((m - startMinutes) / totalDuration) * 100;
      showSpeech = true;
      speechText = "Bom dia!";
      statusText = "Expediente em Andamento";
      isOffHours = false;
    } else if (m > 540 && m < 1035) { // 09:01 às 17:14
      progress = ((m - startMinutes) / totalDuration) * 100;
      showSpeech = false;
      statusText = "Expediente em Andamento";
      isOffHours = false;
    } else if (m >= 1035 && m < 1050) { // 17:15 às 17:29
      progress = ((m - startMinutes) / totalDuration) * 100;
      showSpeech = true;
      speechText = "Até amanhã!";
      statusText = "Expediente em Andamento";
      isOffHours = false;
    } else if (m >= 1050 || m <= 450) { // 17:30 às 07:30
      progress = 100; // Mascote fica no final
      showSpeech = false;
      statusText = "Expediente encerrado";
      isOffHours = true;
    }
  }
  
  progress = Math.max(0, Math.min(100, progress));
  const fillWidth = isOffHours ? 100 : progress;
  
  const fillEl = document.getElementById('workday-fill');
  fillEl.style.width = `${fillWidth}%`;
  
  if (isOffHours) {
    fillEl.style.background = 'linear-gradient(90deg, #e11d48, #9f1239)'; // Carmesim
    fillEl.style.boxShadow = '0 0 10px rgba(225, 29, 72, 0.4)';
  } else {
    fillEl.style.background = 'linear-gradient(90deg, #38bdf8, #10b981)'; // Original
    fillEl.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
  }
  
  document.getElementById('mascot-container').style.left = `${progress}%`;
  
  // Ocultar/Mostrar Mascote
  const mascotImg = document.querySelector('.mascot-img');
  if (mascotImg) mascotImg.style.display = showMascot ? 'block' : 'none';
  
  // Ocultar/Mostrar Balão
  const speechEl = document.getElementById('mascot-speech');
  if (showSpeech) {
    speechEl.style.display = 'block';
    speechEl.innerText = speechText;
  } else {
    speechEl.style.display = 'none';
  }
  
  // Atualizar Status Label abaixo da barra
  const statusEl = document.getElementById('status-expediente');
  if (statusEl) {
    statusEl.innerText = statusText;
  }
}

async function fetchKPIs() {
  try {
    const response = await fetch('/api/kpis');
    const result = await response.json();
    
    if (result.success) {
      renderData(result.data);
    } else {
      console.error("Erro na API:", result.error);
      showToast("Erro ao carregar KPIs: " + (result.error || "Desconhecido"));
    }
  } catch (error) {
    console.error("Falha ao buscar KPIs:", error);
    showToast("Falha de conexão. O servidor parece estar offline.");
  }
}

function renderData(data) {
  // Animar Totais
  animateValue("val-total-pedidos", data.totalPedidos);
  animateValue("val-total-hoje", data.totalHoje);
  animateValue("val-total-fila", data.totalFila);
  animateValue("val-total-md", data.totalMD);
  if(data.totalImportacoes !== undefined) animateValue("val-total-importacao", data.totalImportacoes);
  animateValue("val-jigs", data.jigsEmprestados);

  // Status Kanban (Segunda Fileira) e Tooltips
  if (data.statusCounts) {
    animateValue("val-pendentes", data.statusCounts['PENDENTE'] || 0);
    animateValue("val-analise", data.statusCounts['EM_ANALISE'] || 0);
    animateValue("val-enviados", data.statusCounts['ORCAMENTO_ENVIADO'] || 0);
    animateValue("val-aprovados", data.statusCounts['APROVADO'] || 0);
    animateValue("val-processamento", data.statusCounts['EM_PROCESSAMENTO'] || 0);
    animateValue("val-finalizados", data.statusCounts['FINALIZADO'] || 0);
  }
  
  if (data.pedidosPorStatus) {
    const renderTooltip = (id, lista) => {
      const tt = document.getElementById(id);
      if (!tt) return;
      if (!lista || lista.length === 0) {
        tt.innerHTML = "<em>Nenhum pedido</em>";
        return;
      }
      // Limita a 10 itens para não bugar a tela
      const displayList = lista.slice(0, 10);
      tt.innerHTML = displayList.map(p => `
        <div class="tt-item">
          <span class="tt-cliente">#${p.id} ${p.cliente}</span>
          <span class="tt-tecnico">${p.tecnico_nome}</span>
        </div>
      `).join('') + (lista.length > 10 ? `<div class="tt-item"><em>...e mais ${lista.length - 10}</em></div>` : '');
    };

    renderTooltip("tt-pendentes", data.pedidosPorStatus['PENDENTE']);
    renderTooltip("tt-analise", data.pedidosPorStatus['EM_ANALISE']);
    renderTooltip("tt-enviados", data.pedidosPorStatus['ORCAMENTO_ENVIADO']);
    renderTooltip("tt-aprovados", data.pedidosPorStatus['APROVADO']);
    renderTooltip('tt-processamento', data.pedidosPorStatus['EM_PROCESSAMENTO']);
    renderTooltip('tt-finalizados', data.pedidosPorStatus['FINALIZADO']);
  }

  // Ticker de Máquina Parada (MD)
  const tickerContainer = document.getElementById('md-ticker-container');
  const tickerContent = document.getElementById('md-ticker-content');
  if (data.mdTickerData && data.mdTickerData.length > 0) {
    const tickerText = data.mdTickerData.map(item => {
      let modeloLimpo = (item.modelo || "").replace(/\s*-\s*(venda|carepack|cif)\b/i, '');
      return `${item.cliente} - ${modeloLimpo}`;
    }).join(' &nbsp;&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;&nbsp; ');
    
    tickerContent.innerHTML = tickerText;
    tickerContainer.style.display = 'flex';
  } else {
    tickerContainer.style.display = 'none';
  }

  // Renderizar Listas
  renderList("list-top-pecas", data.topPecas, item => `
    <li class="ranking-item" style="animation-delay: ${Math.random() * 0.3}s">
      <div class="ranking-info">
        <span class="ranking-title">${item.codigo_peca}</span>
        <span class="ranking-subtitle">${item.descricao_peca}</span>
      </div>
      <span class="ranking-score">${item.total}</span>
    </li>
  `);

  renderList("list-top-equipamentos", data.topEquipamentos, item => `
    <li class="ranking-item" style="animation-delay: ${Math.random() * 0.3}s">
      <div class="ranking-info">
        <span class="ranking-title">${item.modelo}</span>
      </div>
      <span class="ranking-score">${item.total_pecas} pçs</span>
    </li>
  `);

  renderList("list-top-clientes", data.topClientes, item => `
    <li class="ranking-item" style="animation-delay: ${Math.random() * 0.3}s">
      <div class="ranking-info">
        <span class="ranking-title">${item.cliente}</span>
      </div>
      <span class="ranking-score">${item.total_pecas} pçs</span>
    </li>
  `);

  // Função removida: formatPecas (agora exibidas via modal)

  const pedidosPendentesApenas = data.pedidosPorStatus ? data.pedidosPorStatus['PENDENTE'] : [];
  renderList("list-pedidos-pendentes", pedidosPendentesApenas, item => {
    const eq = (item.equipamento || 'N/I').replace(/'/g, "\\'");
    return `
    <li class="ranking-item" style="animation-delay: ${Math.random() * 0.3}s">
      <div class="ranking-info">
        <span class="ranking-title">
          <a href="#" onclick="openPecasModal('${encodeURIComponent(JSON.stringify(item.pecas_solicitadas || []))}', ${item.id}, '${eq}'); return false;" style="color:var(--accent-color); text-decoration:none; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-hover)'" onmouseout="this.style.color='var(--accent-color)'">#PD-${item.id}</a>
        </span>
        <span class="ranking-subtitle">${item.cliente} / ${item.tecnico_nome}</span>
      </div>
    </li>
  `});

  let pedidosEmAnalise = [];
  if (data.pedidosPorStatus) {
    pedidosEmAnalise = [
      ...data.pedidosPorStatus['EM_ANALISE'],
      ...data.pedidosPorStatus['ORCAMENTO_ENVIADO'],
      ...data.pedidosPorStatus['APROVADO'],
      ...data.pedidosPorStatus['EM_PROCESSAMENTO']
    ];
  }

  renderList("list-pedidos-em-analise", pedidosEmAnalise, item => {
    let extra = '';
    if (item.numero_pedido_protheus) extra = `<span style="font-size:0.95rem; font-weight:bold; color:var(--text-primary);">PED: ${item.numero_pedido_protheus}</span>`;
    else if (item.numero_orcamento) extra = `<span style="font-size:0.95rem; font-weight:bold; color:var(--text-primary);">ORÇ: ${item.numero_orcamento}</span>`;

    let statusColor = 'rgba(255,255,255,0.1)';
    let textColor = 'var(--text-primary)';
    if (item.status_pedido === 'APROVADO') {
      statusColor = 'var(--success-color)';
      textColor = '#000';
    } else if (item.status_pedido === 'ORCAMENTO_ENVIADO' || item.status_pedido === 'EM_ANALISE') {
      statusColor = 'var(--warning-color)';
      textColor = '#000';
    } else if (item.status_pedido === 'EM_PROCESSAMENTO') {
      statusColor = 'var(--accent-color)';
      textColor = '#fff';
    }

    const eq = (item.equipamento || 'N/I').replace(/'/g, "\\'");

    return `
    <li class="ranking-item" style="animation-delay: ${Math.random() * 0.3}s">
      <div class="ranking-info">
        <span class="ranking-title">
          <a href="#" onclick="openPecasModal('${encodeURIComponent(JSON.stringify(item.pecas_solicitadas || []))}', ${item.id}, '${eq}'); return false;" style="color:var(--accent-color); text-decoration:none; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-hover)'" onmouseout="this.style.color='var(--accent-color)'">#PD-${item.id}</a>
        </span>
        <span class="ranking-subtitle">${item.cliente} / ${item.tecnico_nome}</span>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
        <span style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:2px;">${item.equipamento || ''}</span>
        ${extra}
        <span class="ranking-score" style="font-size:0.75rem; background:${statusColor}; color:${textColor}; padding:2px 6px; border-radius:4px; font-weight:bold;">${item.status_pedido.replace('_', ' ')}</span>
      </div>
    </li>
  `});

  renderList("list-nf-emitida", data.pedidosPorStatus ? data.pedidosPorStatus['FINALIZADO'] : [], item => {
    let extra = item.nota_fiscal ? `<span class="ranking-score" style="font-size:0.95rem; font-weight:bold; color:var(--success-color); background:rgba(42, 203, 114, 0.1); padding:4px 8px; border-radius:6px; border: 1px solid var(--success-color);">NF: ${item.nota_fiscal}</span>` : '';
    const eq = (item.equipamento || 'N/I').replace(/'/g, "\\'");
    return `
    <li class="ranking-item" style="animation-delay: ${Math.random() * 0.3}s">
      <div class="ranking-info">
        <span class="ranking-title">
          <a href="#" onclick="openPecasModal('${encodeURIComponent(JSON.stringify(item.pecas_solicitadas || []))}', ${item.id}, '${eq}'); return false;" style="color:var(--accent-color); text-decoration:none; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-hover)'" onmouseout="this.style.color='var(--accent-color)'">#PD-${item.id}</a>
        </span>
        <span class="ranking-subtitle">${item.cliente} / ${item.tecnico_nome}</span>
      </div>
      ${extra}
    </li>
  `});

  // Renderizar Tabela de JIGs
  renderJigsTable(data.listaJigs);

  const tbodyImportacoes = document.getElementById("tbody-importacoes");
  if (tbodyImportacoes && data.listaImportacoes) {
    if (data.listaImportacoes.length === 0) {
      tbodyImportacoes.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: #9CA3AF;">Nenhuma peça em processo de importação no momento.</td></tr>`;
    } else {
      tbodyImportacoes.innerHTML = data.listaImportacoes.map(item => `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 12px 16px;"><span class="status-badge" style="background: rgba(245, 158, 11, 0.2); color: #F59E0B; border: 1px solid #F59E0B;">#PDI-${item.pedido_id}</span></td>
          <td style="padding: 12px 16px; font-weight: 600;">${item.codigo_peca}</td>
          <td style="padding: 12px 16px;">${item.descricao_peca}</td>
          <td style="padding: 12px 16px; color: var(--accent-color); font-weight: bold;">${item.quantidade_solicitada}</td>
          <td style="padding: 12px 16px;">${item.tecnico_nome}</td>
          <td style="padding: 12px 16px;">${item.eta || '-'}</td>
        </tr>
      `).join('');
    }
  }
}

function renderJigsTable(jigs) {
  const tbody = document.getElementById('table-jigs-body');
  if (!tbody) return;
  if (!jigs || jigs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum JIG encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = jigs.map(j => {
    const isEmprestado = j.status === 'emprestado';
    const badgeClass = isEmprestado ? 'status-emprestado' : 'status-disponivel';
    return `
      <tr>
        <td><strong>${j.codigo}</strong></td>
        <td>${j.descricao}</td>
        <td><span class="status-badge ${badgeClass}">${j.status}</span></td>
        <td>${isEmprestado ? j.tecnico_nome : '-'}</td>
        <td>${isEmprestado ? j.cliente : '-'}</td>
      </tr>
    `;
  }).join('');
}

// Lógica de Abas
window.switchTab = function(tabName, eventObj) {
  // Atualiza botões
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if (eventObj && eventObj.currentTarget) {
    eventObj.currentTarget.classList.add('active');
  } else if (event && event.target) {
    event.target.classList.add('active');
  }

  // Atualiza painéis
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.style.display = 'none';
    pane.classList.remove('active');
  });

  const activePane = document.getElementById('tab-' + tabName);
  if (activePane) {
    activePane.style.display = tabName === 'overview' ? 'block' : 'block';
    activePane.classList.add('active');
  }

  if (tabName === 'instalacoes') {
    fetchInstalacoes();
  }
};

async function fetchInstalacoes() {
  try {
    const response = await fetch('/api/instalacoes');
    const data = await response.json();
    
    const tbody = document.getElementById('table-instalacoes-body');
    if(!tbody) return;

    let countP = 0, countA = 0, countF = 0;
    
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhuma instalação encontrada.</td></tr>';
      document.getElementById('count-programadas').innerText = '0';
      document.getElementById('count-andamento').innerText = '0';
      document.getElementById('count-finalizadas').innerText = '0';
      return;
    }

    const htmlRows = data.map(inst => {
      const dataStr = (dateStr) => {
        if (!dateStr) return '--';
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'});
      };

      // Contagem para os Cards
      if (inst.status === 'programada' || inst.status === 'nao_iniciado') countP++;
      else if (inst.status === 'andamento' || inst.status === 'atrasada' || inst.status === 'pausada') countA++;
      else if (inst.status === 'finalizado') countF++;

      // Badges de Status
      let badgeHtml = '';
      if (inst.status === 'programada' || inst.status === 'nao_iniciado') {
        badgeHtml = `<span class="status-badge" style="background: rgba(148, 163, 184, 0.2); color: #94a3b8; border: 1px solid rgba(148,163,184,0.3);">${inst.status === 'nao_iniciado' ? 'NÃO INICIADO' : 'PROGRAMADA'}</span>`;
      } else if (inst.status === 'andamento') {
        const faseLabel = inst.faseAtivaNome ? `FASE: ${inst.faseAtivaNome.toUpperCase()}` : 'EM ANDAMENTO';
        badgeHtml = `<span class="status-badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3);">${faseLabel}</span>`;
      } else if (inst.status === 'pausada') {
        badgeHtml = `<span class="status-badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3);">PAUSADO</span>`;
      } else if (inst.status === 'atrasada') {
        badgeHtml = `<span class="status-badge" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);">ATRASADA</span>`;
      } else {
        badgeHtml = `<span class="status-badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16,185,129,0.3);">CONCLUÍDO</span>`;
      }

      // Renderização da Barra Segmentada
      let segmentsHtml = '';
      let colorClass = '#38bdf8'; // cor default (andamento)
      
      if (inst.status === 'atrasada') colorClass = '#ef4444';
      else if (inst.status === 'pausada') colorClass = '#f59e0b';
      else if (inst.status === 'finalizado') colorClass = '#10b981';

      if (inst.fases && inst.fases.length > 0 && inst.status !== 'programada' && inst.status !== 'nao_iniciado') {
        const colors = {
          'presite': '#8b5cf6', // Roxo
          'instalacao': '#38bdf8', // Azul
          'treinamento': '#f59e0b', // Amarelo
          'rampup': '#10b981' // Verde
        };
        const icons = {
          'presite': 'ph-clipboard-text',
          'instalacao': 'ph-wrench',
          'treinamento': 'ph-graduation-cap',
          'rampup': 'ph-rocket'
        };
        
        segmentsHtml = `<div style="display: flex; height: 10px; border-radius: 6px; background: #1e293b; overflow: hidden; position: relative;">`;
        
        // Renderizar Ícones Acima
        let iconsHtml = `<div style="display: flex; height: 20px; margin-bottom: 4px; position: relative;">`;
        
        inst.fases.forEach(f => {
           if (f.peso > 0) {
             const color = colors[f.id] || '#94a3b8';
             const icon = icons[f.id] || 'ph-circle';
             
             // Segmento da barra
             segmentsHtml += `
               <div title="${f.nome} (Previsto: ${f.duracao / (1000*60*60*24)} dias) - ${Math.round(f.progresso)}% concluído" 
                    style="width: ${f.peso}%; height: 100%; border-right: 1px solid #0f172a; position: relative; background: rgba(255,255,255,0.05);">
                 <div style="width: ${f.progresso}%; height: 100%; background: ${color};"></div>
               </div>
             `;
             
             // Ícone flutuando no meio do segmento
             iconsHtml += `
               <div style="width: ${f.peso}%; display: flex; justify-content: center; align-items: flex-end; color: ${f.progresso > 0 ? color : '#64748b'}; font-size: 1.1rem;" title="${f.nome}">
                 <i class="ph ${icon}"></i>
               </div>
             `;
           }
        });
        segmentsHtml += `</div>`;
        iconsHtml += `</div>`;
        
        segmentsHtml = iconsHtml + segmentsHtml;
      } else {
        // Barra simples (antiga)
        segmentsHtml = `
          <div class="inst-progress-bg" style="height: 8px;">
            <div class="inst-progress-fill" style="width: ${inst.progresso}%; background: ${inst.status === 'finalizado' ? '#10b981' : (inst.status === 'programada' || inst.status === 'nao_iniciado' ? 'transparent' : colorClass)};"></div>
          </div>
        `;
      }

      // Coluna Linha do Tempo
      let timelineHtml = '';
      if (inst.status === 'finalizado') {
        timelineHtml = `
          <div style="font-size: 0.8rem; color: #10b981; font-weight: 600; margin-bottom: 4px;">Concluída (Prev. ${dataStr(inst.dataFim)})</div>
          ${segmentsHtml}
        `;
      } else if (inst.status === 'programada' || inst.status === 'nao_iniciado') {
        timelineHtml = `
          <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 600; margin-bottom: 4px;">Início: ${dataStr(inst.dataInicio)}</div>
          ${segmentsHtml}
        `;
      } else {
        // Andamento, Pausada ou Atrasada
        let msg = '';
        if (inst.status === 'atrasada') msg = 'Atrasada';
        else if (inst.status === 'pausada') msg = 'Pausada';
        else msg = inst.diasRestantes === 0 ? 'Termina Hoje!' : `Faltam ${inst.diasRestantes} dias`;
        
        timelineHtml = `
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600; margin-bottom: 4px; color: ${colorClass};">
            <span>${Math.round(inst.progresso)}% Total</span>
            <span>${msg}</span>
          </div>
          ${segmentsHtml}
          <div style="font-size: 0.7rem; color: #94a3b8; text-align: right; margin-top: 4px;">Prev: ${dataStr(inst.dataFim)}</div>
        `;
      }

      return `
        <tr>
          <td><strong>${inst.cliente}</strong></td>
          <td>${inst.equipamento}</td>
          <td>${timelineHtml}</td>
          <td>👷‍♂️ ${inst.tecnicos}</td>
          <td style="text-align: center;">${badgeHtml}</td>
        </tr>
      `;
    }).join('');
    
    tbody.innerHTML = htmlRows;
    
    animateValue('count-programadas', countP, 1000);
    animateValue('count-andamento', countA, 1000);
    animateValue('count-finalizadas', countF, 1000);
    
  } catch (err) {
    console.error('Erro ao carregar instalações', err);
    showToast("Falha ao carregar cronograma de instalações.");
  }
}

function renderList(elementId, items, templateFn) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (!items || items.length === 0) {
    el.innerHTML = '<li class="ranking-item"><span class="ranking-subtitle">Sem dados suficientes</span></li>';
    return;
  }
  el.innerHTML = items.map(templateFn).join('');
}

// Efeito de contagem animada para os cards
function animateValue(id, end, duration = 1500) {
  const obj = document.getElementById(id);
  if (!obj) return; // Evita quebrar o JS se o card não existir

  // Pega o valor atual no DOM ou começa do 0
  let start = parseInt(obj.innerText.replace(/\D/g, '')) || 0;
  if (start === end) return;
  
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    
    // Easing out easeOutExpo
    const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const current = Math.floor(easeProgress * (end - start) + start);
    
    obj.innerHTML = current;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.innerHTML = end;
    }
  };
  window.requestAnimationFrame(step);
}

// =====================================
// REPOSIÇÕES PENDENTES
// =====================================
let reposicoesData = [];

async function fetchReposicoes() {
  try {
    const response = await fetch('/api/pendencias');
    const data = await response.json();
    reposicoesData = data;
    
    const tbody = document.getElementById('table-reposicoes-body');
    if(!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma pendência de reposição encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(rep => {
      let badgeClass = 'badge-success';
      if (rep.dias_atraso > 7) badgeClass = 'badge-danger';
      else if (rep.dias_atraso >= 4) badgeClass = 'badge-warning';

      const badgeHtml = `<span class="badge ${badgeClass}">${rep.dias_atraso} dias</span>`;

      return `
        <tr>
          <td>${badgeHtml}</td>
          <td><strong>${rep.tecnico_nome}</strong><br><span style="font-size:0.8em; color:var(--text-secondary)">${rep.tecnico_telefone}</span></td>
          <td>${rep.cliente}</td>
          <td><strong>${rep.codigo_peca}</strong><br><span style="font-size:0.8em; color:var(--text-secondary)">${rep.descricao_peca || ''}</span></td>
          <td>${rep.quantidade}</td>
          <td>${rep.contrato_tipo}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Erro ao buscar reposições pendentes', err);
    showToast("Falha ao carregar fila de reposições.");
  }
}

function baixarCSVReposicoes() {
  if (reposicoesData.length === 0) {
    alert("Nenhuma pendência para exportar.");
    return;
  }

  // Cabeçalho do CSV
  let csvContent = "Atraso (Dias);Telefone do Tecnico;Nome do Tecnico;Cliente;Modelo do Equipamento;Contrato;Codigo da Peca;Descricao;Quantidade;Data da Solicitacao\n";

  reposicoesData.forEach(p => {
    const dataSol = new Date(p.criada_em).toLocaleString('pt-BR');
    const desc = (p.descricao_peca || '').replace(/;/g, ','); // Remove pontos e vírgulas para não quebrar o CSV
    const row = [
      p.dias_atraso,
      p.tecnico_telefone,
      p.tecnico_nome,
      p.cliente,
      p.modelo_equipamento,
      p.contrato_tipo,
      p.codigo_peca,
      desc,
      p.quantidade,
      dataSol
    ].join(';');
    csvContent += row + "\n";
  });

  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM p/ acentos no Excel
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `reposicoes_pendentes_${new Date().getTime()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =====================================
// UI: Toast Notifications
// =====================================
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="ph ph-warning-circle" style="font-size: 1.5rem; color: var(--danger-color);"></i> <span>${message}</span>`;
  
  container.appendChild(toast);

  // Remove após 5 segundos
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    });
  }, 5000);
}

// =====================================
// BASE DE DADOS DE SOLICITAÇÕES
// =====================================
let databaseSolicitacoes = [];

async function fetchDatabase() {
  try {
    const response = await fetch('/api/solicitacoes-todas');
    const result = await response.json();
    if (result.success) {
      databaseSolicitacoes = result.data || [];
      populateFilters();
      renderDatabase();
    }
  } catch (error) {
    console.error("Erro ao buscar base de dados:", error);
  }
}

function populateFilters() {
  const tecnicos = new Set();
  const clientes = new Set();
  const equipamentos = new Set();

  databaseSolicitacoes.forEach(item => {
    if (item.tecnico) tecnicos.add(item.tecnico);
    if (item.cliente) clientes.add(item.cliente);
    if (item.equipamento) equipamentos.add(item.equipamento);
  });

  fillSelect('filter-tecnico', Array.from(tecnicos).sort());
  fillSelect('filter-cliente', Array.from(clientes).sort());
  fillSelect('filter-equipamento', Array.from(equipamentos).sort());
}

function fillSelect(id, items) {
  const select = document.getElementById(id);
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">Todos</option>' + items.map(i => `<option value="${i}">${i}</option>`).join('');
  select.value = currentValue;
}

function renderDatabase() {
  const tbody = document.getElementById('table-database-body');
  if (!tbody) return;

  const dateStart = document.getElementById('filter-date-start').value;
  const dateEnd = document.getElementById('filter-date-end').value;
  const fTecnico = document.getElementById('filter-tecnico').value;
  const fCliente = document.getElementById('filter-cliente').value;
  const fEquipamento = document.getElementById('filter-equipamento').value;
  const fMD = document.getElementById('filter-md').checked;
  const fDiag = document.getElementById('filter-diagnostico').checked;

  const filtered = databaseSolicitacoes.filter(item => {
    // Filtro por Data
    if (dateStart || dateEnd) {
      const itemDate = new Date(item.data);
      itemDate.setHours(0,0,0,0);
      if (dateStart) {
        const ds = new Date(dateStart + 'T00:00:00');
        if (itemDate < ds) return false;
      }
      if (dateEnd) {
        const de = new Date(dateEnd + 'T23:59:59');
        if (itemDate > de) return false;
      }
    }

    if (fTecnico && item.tecnico !== fTecnico) return false;
    if (fCliente && item.cliente !== fCliente) return false;
    if (fEquipamento && item.equipamento !== fEquipamento) return false;
    if (fMD && !(item.md === 'Sim' || item.md === '1' || item.em_md === 'sim')) return false;
    if (fDiag && item.motivo !== 'Diagnóstico') return false;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Nenhum registro encontrado com os filtros atuais.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const dataStr = new Date(item.data).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'});
    let badge = '';
    const s = item.status || '';
    
    if (s === 'EM_PROCESSAMENTO') {
      badge = `<span class="status-badge" style="background:rgba(56,189,248,0.2);color:#38bdf8;border:1px solid rgba(56,189,248,0.3)">${s}</span>`; // Azul
    } else if (s === 'REPROVADO') {
      badge = `<span class="status-badge" style="background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid rgba(239,68,68,0.3)">${s}</span>`; // Vermelho
    } else if (s === 'EM_ANALISE' || s === 'ANALISANDO') {
      badge = `<span class="status-badge" style="background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid rgba(245,158,11,0.3)">EM ANÁLISE</span>`; // Amarelo
    } else if (s === 'ORCAMENTO_ENVIADO' || s === 'APROVADO') {
      badge = `<span class="status-badge" style="background:rgba(168,85,247,0.2);color:#a855f7;border:1px solid rgba(168,85,247,0.3)">${s.replace('_', ' ')}</span>`; // Roxo
    } else if (s === 'FINALIZADO' || s === 'FINALIZADOS') {
      badge = `<span class="status-badge" style="background:rgba(16,185,129,0.2);color:#10b981;border:1px solid rgba(16,185,129,0.3)">FINALIZADO</span>`; // Verde
    } else if (s === 'IMPORTACAO') {
      badge = `<span class="status-badge" style="background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid rgba(245,158,11,0.3)">IMPORTAÇÃO</span>`; // Laranja/Amarelo
    } else {
      badge = `<span class="status-badge status-emprestado">${s}</span>`; // Padrão
    }

    let mdFlag = (item.md === 'Sim' || item.md === '1' || item.em_md === 'sim') ? '<br><span style="color:#ef4444;font-size:0.75rem;font-weight:bold;">🚨 MD</span>' : '';
    let diagFlag = (item.motivo === 'Diagnóstico') ? '<br><span style="color:#f59e0b;font-size:0.75rem;font-weight:bold;">🔬 DIAGNÓSTICO</span>' : '';

    return `
      <tr>
        <td><strong>#${item.pedido_id}</strong></td>
        <td>${dataStr}</td>
        <td>${item.tecnico}</td>
        <td>${item.cliente}</td>
        <td>${item.equipamento}</td>
        <td><strong>${item.codigo_peca}</strong><br><span style="font-size:0.85rem;color:var(--text-secondary);">${item.descricao_peca}</span>${mdFlag}${diagFlag}</td>
        <td style="text-align:center; font-weight:bold;">${item.qtd}</td>
        <td>${item.numero_orcamento || '-'}</td>
        <td>${item.numero_pedido_protheus || '-'}</td>
        <td>${item.nota_fiscal || '-'}</td>
        <td>${badge}</td>
      </tr>
    `;
  }).join('');
}

function limparFiltrosBD() {
  document.getElementById('filter-date-start').value = '';
  document.getElementById('filter-date-end').value = '';
  document.getElementById('filter-tecnico').value = '';
  document.getElementById('filter-cliente').value = '';
  document.getElementById('filter-equipamento').value = '';
  document.getElementById('filter-md').checked = false;
  document.getElementById('filter-diagnostico').checked = false;
  renderDatabase();
}

// Event Listeners para os Filtros
document.addEventListener('DOMContentLoaded', () => {
  const filters = ['filter-date-start', 'filter-date-end', 'filter-tecnico', 'filter-cliente', 'filter-equipamento', 'filter-md', 'filter-diagnostico'];
  filters.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', renderDatabase);
  });
});

// Controle do Modal de Peças
function openPecasModal(pecasJsonEncoded, id, equipamento) {
  try {
    const pecasStr = decodeURIComponent(pecasJsonEncoded);
    const pecas = JSON.parse(pecasStr);
    
    document.getElementById('pecas-modal-title').innerHTML = `Peças Solicitadas (#PD-${id}) <span style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-top:4px;">Máquina: ${equipamento}</span>`;
    
    const body = document.getElementById('pecas-modal-body');
    if (!pecas || pecas.length === 0) {
      body.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Nenhuma peça registrada.</p>';
    } else {
      body.innerHTML = pecas.map(p => `
        <div class="peca-item">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <span class="peca-codigo">${p.codigo_peca || 'N/A'}</span>
            <span class="peca-qtd">${p.quantidade_solicitada || 1}x</span>
          </div>
          <span class="peca-desc">${p.descricao_peca || 'Sem descrição'}</span>
        </div>
      `).join('');
    }
    
    document.getElementById('pecas-modal').classList.add('active');
  } catch (err) {
    console.error("Erro ao abrir modal", err);
  }
}

function closePecasModal() {
  document.getElementById('pecas-modal').classList.remove('active');
}

// Fechar ao clicar fora
document.addEventListener('click', (e) => {
  const modal = document.getElementById('pecas-modal');
  if (modal && e.target === modal) {
    closePecasModal();
  }
});
