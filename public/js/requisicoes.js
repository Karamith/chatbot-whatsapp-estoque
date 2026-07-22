document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('bo_token');
  if (!token) {
    window.location.href = 'bo-login.html';
    return;
  }

  let todasRequisicoes = [];
  let gaugeChart = null;

  function formatMoney(value) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function carregarFiltro(tecnicos) {
    const select = document.getElementById('filtro-tecnico');
    tecnicos.forEach(t => {
      const option = document.createElement('option');
      option.value = t;
      option.textContent = t;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
      renderizar(e.target.value);
    });
  }

  function initGauge() {
    const chartDom = document.getElementById('gauge-meta');
    gaugeChart = echarts.init(chartDom);
    window.addEventListener('resize', () => gaugeChart.resize());
  }

  function updateGauge(valorAtual) {
    const meta = 50000;
    const porcentagem = Math.min((valorAtual / meta) * 100, 100).toFixed(1);
    
    const option = {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: meta,
          splitNumber: 5,
          itemStyle: {
            color: '#8B5CF6',
            shadowColor: 'rgba(0,138,255,0.45)',
            shadowBlur: 10,
            shadowOffsetX: 2,
            shadowOffsetY: 2
          },
          progress: {
            show: true,
            roundCap: true,
            width: 12
          },
          pointer: { show: false },
          axisLine: {
            roundCap: true,
            lineStyle: { width: 12, color: [[1, '#374151']] }
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '0%'],
            fontSize: 16,
            fontWeight: 'bold',
            color: 'inherit',
            formatter: '{value} / 50k'
          },
          data: [{ value: valorAtual }]
        }
      ]
    };
    gaugeChart.setOption(option);
  }

  function renderizar(tecnicoFiltro = '') {
    const tbody = document.getElementById('req-table-body');
    tbody.innerHTML = '';

    const filtradas = tecnicoFiltro ? todasRequisicoes.filter(r => (r.mala + ' - ' + r.tecnico_nome) === tecnicoFiltro) : todasRequisicoes;

    let pendentes = 0;
    let baixadas = 0;
    let valorPendenteTotal = 0;

    filtradas.forEach(req => {
      if (req.status === 'PENDENTE') {
        pendentes++;
        valorPendenteTotal += (Number(req.valor_peca) * Number(req.quantidade));
      } else {
        baixadas++;
      }

      const tr = document.createElement('tr');
      
      let botoes = '';
      if (req.status === 'PENDENTE') {
        botoes = `
          <button class="req-action-btn btn-baixa" onclick="window.acaoReq(${req.id}, 'baixa')">Baixa (NF)</button>
          <button class="req-action-btn btn-retorno" onclick="window.acaoReq(${req.id}, 'retorno')">Retorno</button>
        `;
      } else if (req.status === 'BAIXADA') {
        botoes = `<span style="color: #10B981; font-weight: bold;">NF: ${req.nota_fiscal}</span>`;
      } else if (req.status === 'RETORNADA') {
        botoes = `<span style="color: #F59E0B; font-weight: bold;">Retorno: ${req.numero_retorno}</span>`;
      }

      tr.innerHTML = `
        <td style="font-weight: bold; color: #8B5CF6;">${req.numero_requisicao}</td>
        <td>
          <div style="font-size: 0.85rem; color: #8E929B;">#PD-${String(req.solicitacao_id).padStart(4, '0')}</div>
          <div style="font-size: 0.75rem;">${formatDate(req.criada_em)}</div>
        </td>
        <td>
          <div style="font-weight: 500;">${req.mala}</div>
          <div style="font-size: 0.75rem; color: #8E929B;">${req.tecnico_nome}</div>
        </td>
        <td>
          <div>${req.cliente}</div>
          <div style="font-size: 0.75rem; color: #8E929B;">${req.maquina}</div>
        </td>
        <td>
          <div style="font-size: 0.85rem;">${req.codigo_peca}</div>
          <div style="font-size: 0.75rem; color: #8E929B;">${req.descricao_peca}</div>
          <div style="font-size: 0.75rem; margin-top: 4px;">Qtd: ${req.quantidade}</div>
        </td>
        <td style="font-weight: bold;">${formatMoney(req.valor_peca)}</td>
        <td>
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; background: ${req.status === 'PENDENTE' ? '#374151' : (req.status === 'BAIXADA' ? '#065F46' : '#92400E')}">
            ${req.status}
          </span>
        </td>
        <td>${botoes}</td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById('total-pendentes').textContent = pendentes;
    document.getElementById('total-baixadas').textContent = baixadas;
    document.getElementById('valor-pendente').textContent = formatMoney(valorPendenteTotal);
    
    updateGauge(valorPendenteTotal);
  }

  function fetchRequisicoes() {
    fetch('/api/requisicoes/pendentes', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      todasRequisicoes = data;
      
      const setTecnicos = new Set();
      data.forEach(r => setTecnicos.add(r.mala + ' - ' + r.tecnico_nome));
      const select = document.getElementById('filtro-tecnico');
      if (select.options.length === 1) { // Só tem "Todos"
        carregarFiltro(Array.from(setTecnicos).sort());
      }
      
      renderizar(select.value);
    });
  }

  window.acaoReq = function(id, acao) {
    let infoExtra = '';
    if (acao === 'baixa') {
      infoExtra = prompt('Digite o número da Nota Fiscal (Obrigatório):');
    } else {
      infoExtra = prompt('Digite o número da requisição de Retorno (Obrigatório):');
    }

    if (!infoExtra) {
      alert('Ação cancelada. A informação é obrigatória.');
      return;
    }

    fetch(`/api/requisicoes/${id}/acao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ acao, infoExtra })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchRequisicoes();
      } else {
        alert('Erro ao processar: ' + data.error);
      }
    });
  };

  initGauge();
  fetchRequisicoes();
});
