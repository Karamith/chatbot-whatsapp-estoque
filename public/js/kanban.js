document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('bo_token');
  if (!token) {
    window.location.href = 'bo-login.html';
    return;
  }

  const columns = {
    'PENDENTE': document.querySelector('.col-pendente .column-body'),
    'EM_ANALISE': document.querySelector('.col-analise .column-body'),
    'ORCAMENTO_ENVIADO': document.querySelector('.col-oenv .column-body'),
    'APROVADO': document.querySelector('.col-oaprov .column-body'),
    'EM_PROCESSAMENTO': document.querySelector('.col-separacao .column-body'),
    'FINALIZADO': document.querySelector('.col-finalizado .column-body')
  };

  const mapStatus = {
    'EM_ANALISE': 'EM_ANALISE',
    'PENDENTE': 'PENDENTE',
    'ORCAMENTO_ENVIADO': 'ORCAMENTO_ENVIADO',
    'APROVADO': 'APROVADO',
    'EM_PROCESSAMENTO': 'EM_PROCESSAMENTO',
    'FINALIZADO': 'FINALIZADO',
    'FINALIZADO': 'FINALIZADO',
    'FINALIZADO': 'FINALIZADO',
    'FINALIZADOS': 'FINALIZADO',
    'REPROVADO': 'REPROVADO',
    'IMPORTACAO': 'IMPORTACAO'
  };

  function fetchPedidos() {
    fetch('/api/pedidos', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('bo_token');
        window.location.href = 'bo-login.html';
        throw new Error('Não autorizado');
      }
      return res.json();
    })
    .then(data => {
      window.pedidosKanban = data;
      renderKanban(data);
    })
    .catch(err => console.error('Erro ao buscar pedidos:', err));
  }

  function getAvatarUrl(tecnicoNome) {
    if (!tecnicoNome) return '/bo-assets/default-avatar.png';
    return `/api/avatar/${encodeURIComponent(tecnicoNome)}`;
  }

  function getStatusColor(status) {
    switch (status) {
      case 'PENDENTE': return 'var(--color-pendente)';
      case 'EM_ANALISE': return 'var(--color-analise)';
      case 'ORCAMENTO_ENVIADO': return 'var(--color-oenv)';
      case 'APROVADO': return 'var(--color-oaprov)';
      case 'EM_PROCESSAMENTO': return 'var(--color-separacao)';
      case 'FINALIZADO': return 'var(--color-finalizado)';
      default: return 'var(--text-secondary)';
    }
  }

  function getRoleColor(cargo) {
    switch (cargo) {
      case 'FSE': return '#3B82F6';
      case 'RSE': return '#EF4444';
      case 'CC': return '#22C55E';
      case 'B.O': return '#F59E0B'; // Amarelo
      default: return 'var(--text-secondary)';
    }
  }

  function createCard(pedido) {
    const isMD = pedido.md === 'sim' || pedido.md === 'Sim' || pedido.md === '1' || pedido.em_md === 'sim';
    
    const card = document.createElement('div');
    card.className = `bo-card ${isMD ? 'card-md' : ''}`;
    card.draggable = true;
    card.dataset.id = pedido.id;
    card.dataset.status = pedido.status_pedido;

    const isCIF = (pedido.cliente && pedido.cliente.toUpperCase().includes('CIF')) || 
                  (pedido.modelo && pedido.modelo.toUpperCase().includes('CIF'));
    card.dataset.iscif = isCIF ? 'true' : 'false';

    const cargo = pedido.cargo_tecnico || 'TÉCNICO';
    const cargoColor = getRoleColor(cargo);
    const statusColor = getStatusColor(pedido.status_pedido);

    // Efeito Neon do Status
    card.style.borderColor = statusColor;
    card.style.boxShadow = `0 0 15px ${statusColor}33, inset 0 0 10px ${statusColor}15`;

    let mdFooter = '';
    let mdIndicator = '';
    
    if (isMD) {
      mdIndicator += `<div class="bo-card-indicator" style="height: 8px; background: repeating-linear-gradient(45deg, #8B0000, #8B0000 10px, #FF0000 10px, #FF0000 20px);"></div>`;
      mdFooter += `
        <div style="background: linear-gradient(90deg, #5c0000, #ff0000); color: white; text-align: center; padding: 10px; font-weight: bold; font-size: 0.8rem; margin: 16px -16px -16px -16px; border-radius: 0 0 8px 8px;">
          ⚠️ MACHINE DOWN | PRIORIDADE MÁXIMA
        </div>
      `;
    }

    if (pedido.is_parcial === 1) {
      mdIndicator += `<div class="bo-card-indicator" style="height: 8px; background: repeating-linear-gradient(45deg, #b45309, #b45309 10px, #f59e0b 10px, #f59e0b 20px);"></div>`;
      mdFooter += `
        <div style="background: linear-gradient(90deg, #78350f, #d97706); color: white; text-align: center; padding: 10px; font-weight: bold; font-size: 0.8rem; margin: 16px -16px -16px -16px; border-radius: 0 0 8px 8px;">
          ⚠️ PARCIAL | IMPORTAÇÃO
        </div>
      `;
    }

    const isImportacao = pedido.is_importacao === 1 || (pedido.itens && pedido.itens.some(i => i.importacao === 1 || (i.descricao_peca && i.descricao_peca.includes('[! Importar]'))));
    const tipoEntregaIcon = isImportacao 
      ? '<img src="/icons/importacao.svg" alt="Importação" title="Importação" style="width: 28px; height: 28px;">'
      : '<img src="/icons/pronta_entrega.svg" alt="Pronta Entrega" title="Pronta Entrega" style="width: 28px; height: 28px;">';

    const displayId = pedido.is_importacao === 1 ? `#PDI-${String(pedido.parent_id || pedido.id).padStart(4, '0')}` : `#PD-${String(pedido.id).padStart(4, '0')}`;
    card.innerHTML = `
      ${mdIndicator}
      <div class="bo-card-row" style="gap: 8px;">
        <div class="tech-info-flex" style="white-space: nowrap; flex-shrink: 0;">
          <span class="icon" style="margin-right: 4px;">📋</span> 
          <span class="bo-value large" style="font-size: 1rem;">${displayId}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: flex-end;">
          ${isImportacao ? '<span class="bo-role-badge" style="border-color: #F59E0B; color: #F59E0B; white-space: nowrap; padding: 2px 4px; font-size: 0.6rem;">⚠️ IMPORTAR</span>' : ''}
          ${pedido.tag_requisicao ? `<span class="bo-role-badge" style="border-color: #8B5CF6; color: #8B5CF6; white-space: nowrap; padding: 2px 4px; font-size: 0.6rem;">${pedido.tag_requisicao}</span>` : ''}
          <span class="bo-role-badge" style="border-color: ${statusColor}; color: ${statusColor}; white-space: nowrap; padding: 2px 4px; font-size: 0.6rem;">${pedido.status_pedido === 'EM_PROCESSAMENTO' ? 'EM PROCESS.' : pedido.status_pedido.replace('_', ' ')}</span>
          <div style="position: relative; display: inline-block;">
            <span class="btn-dots" style="color: var(--text-secondary); cursor: pointer; margin-left: 2px; padding: 0 6px;">⋮</span>
            <div class="dropdown-reprovado" style="display: none; position: absolute; right: 0; top: 100%; background: #2A2D35; border: 1px solid #374151; border-radius: 4px; padding: 4px; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.3); min-width: 100px;">
              <button onclick="window.importarPedido(${pedido.id})" style="background: #F59E0B; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; white-space: nowrap; width: 100%; margin-bottom: 4px;">Importação</button>
              <button onclick="window.abrirModalRequisicao(${pedido.id})" style="background: #8B5CF6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; white-space: nowrap; width: 100%; margin-bottom: 4px;">Requisição</button>
              ${localStorage.getItem('bo_acesso') === 'MASTER' ? `<button onclick="window.reprovarPedido(${pedido.id})" style="background: #EF4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; white-space: nowrap; width: 100%;">Reprovado</button>` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="bo-card-row">
        <div class="tech-info-flex">
          <img src="${getAvatarUrl(pedido.tecnico_nome)}" alt="Avatar" class="card-tech-avatar">
          <div class="bo-info-group">
            <span class="bo-label">TÉCNICO</span>
            <span class="bo-value" style="font-size: 0.85rem;">${pedido.tecnico_nome || 'N/A'}</span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${tipoEntregaIcon}
          ${pedido.motivo && pedido.motivo.toLowerCase().includes('diagn') ? '<img src="/bo-assets/diagnostico.png" alt="Diagnóstico" title="Peças para Diagnóstico" style="width: 32px; height: 32px; object-fit: contain;">' : ''}
        </div>
        <span class="bo-role-badge" style="border-color: ${cargoColor}; color: ${cargoColor};">${cargo}</span>
      </div>
      <div class="bo-card-grid">
        <div class="bo-info-group">
          <span class="bo-label">🏢 CLIENTE</span>
          <span class="bo-value" style="font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pedido.cliente || 'Sem Cliente'}</span>
        </div>
        <div class="bo-info-group">
          <span class="bo-label">${isMD ? '🔴' : '<img src="/bo-assets/icone-maquina.png" style="width: 16px; height: 16px; border-radius: 50%; object-fit: cover; vertical-align: text-bottom; margin-right: 4px;">'} MÁQUINA</span>
          <span class="bo-value" style="font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pedido.modelo || 'Sem Modelo'}</span>
        </div>
      </div>
      <div class="bo-card-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <!-- Col 1: ORÇAMENTO -->
        <div class="bo-info-group" style="flex: 1; text-align: left; display: flex; flex-direction: column; align-items: flex-start;">
          <span class="bo-label" style="justify-content: flex-start;"><img src="/bo-assets/orcamento.png" style="width: 14px; height: 14px; object-fit: contain; vertical-align: text-bottom; margin-right: 4px;"> ORÇAMENTO</span>
          <span class="bo-value" style="font-size: 0.85rem;">${pedido.numero_orcamento || 'N/A'}</span>
        </div>

        <!-- Col 2: PEDIDO -->
        <div class="bo-info-group" style="flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center;">
          <span class="bo-label" style="justify-content: center;"><img src="/bo-assets/pedido.png" style="width: 14px; height: 14px; object-fit: contain; vertical-align: text-bottom; margin-right: 4px;"> PEDIDO</span>
          <span class="bo-value" style="font-size: 0.85rem;">${pedido.numero_pedido_protheus || 'N/A'}</span>
        </div>

        <!-- Col 3: NF e B.O. -->
        <div class="bo-info-group" style="flex: 1; text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
          <!-- NF -->
          <div style="display: flex; flex-direction: column; align-items: flex-end;">
            <span class="bo-label" style="justify-content: flex-end;"><img src="/bo-assets/nf.png" style="width: 14px; height: 14px; object-fit: contain; vertical-align: text-bottom; margin-right: 4px;"> NF</span>
            <span class="bo-value" style="font-size: 0.85rem;">${pedido.nota_fiscal || 'N/A'}</span>
          </div>
          <!-- B.O. -->
          <div style="display: flex; flex-direction: column; align-items: flex-end;">
            <span class="bo-label" style="justify-content: flex-end;">🛡️ B.O.</span>
            <span class="bo-value" style="font-size: 0.85rem; color: #8E929B;">${(pedido.responsavel_baixa || 'N/A').split(' ')[0]}</span>
          </div>
        </div>
      </div>
      ${mdFooter}
    `;

    const dotsBtn = card.querySelector('.btn-dots');
    const dropdown = card.querySelector('.dropdown-reprovado');
    if (dotsBtn && dropdown) {
      dotsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdown.style.display === 'block';
        // Fechar todos os outros dropdowns
        document.querySelectorAll('.dropdown-reprovado').forEach(d => d.style.display = 'none');
        dropdown.style.display = isVisible ? 'none' : 'block';
      });
    }

    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    return card;
  }

  // Fechar dropdown ao clicar fora
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-reprovado').forEach(d => d.style.display = 'none');
  });

  window.importarPedido = function(id) {
    const pedido = window.pedidosKanban.find(p => p.id === id);
    if (!pedido) return alert('Pedido não encontrado');
    
    document.getElementById('import-solicitacao-id').value = pedido.id;
    
    const container = document.getElementById('import-pecas-container');
    container.innerHTML = '';
    
    if (pedido.itens && pedido.itens.length > 0) {
      pedido.itens.forEach(i => {
        const isImportar = i.importacao === 1 || (i.descricao_peca && i.descricao_peca.includes('[! Importar]'));
        container.innerHTML += `
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
            <input type="checkbox" name="import-peca" value="${i.id}" ${isImportar ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #F59E0B;">
            <b>${i.codigo_peca}</b> - ${i.descricao_peca || ''} (Qtd: ${i.quantidade})
          </label>
        `;
      });
    } else {
      container.innerHTML = '<div style="color: #9CA3AF;">Nenhum item neste pedido.</div>';
    }
    
    document.getElementById('modal-importacao-split').style.display = 'flex';
  };

  window.salvarSplitImportacao = function() {
    const id = document.getElementById('import-solicitacao-id').value;
    const checkboxes = document.querySelectorAll('input[name="import-peca"]:checked');
    const itensSelecionadosIds = Array.from(checkboxes).map(cb => Number(cb.value));
    
    if (itensSelecionadosIds.length === 0) {
      return alert('Selecione ao menos uma peça para desmembrar.');
    }
    
    fetch(`/api/pedidos/${id}/split-importacao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ itensSelecionadosIds })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('modal-importacao-split').style.display = 'none';
        fetchPedidos();
      } else {
        alert('Erro ao separar importação: ' + data.error);
      }
    })
    .catch(err => console.error(err));
  };

  window.reprovarPedido = function(id) {
    if (confirm("Tem certeza que deseja reprovar este pedido? Ele sumirá do Kanban e ficará como Reprovado no Excel.")) {
      updatePedidoStatus(id, 'REPROVADO');
    }
  };

  function renderKanban(pedidos) {
    // 1. Limpar as colunas e as bordas de MD
    Object.values(columns).forEach(col => {
      if (col) {
        col.innerHTML = '';
        const kanbanCol = col.closest('.kanban-column');
        if (kanbanCol) kanbanCol.classList.remove('has-md');
      }
    });

    // 2. Agrupar pedidos por coluna
    const pedidosPorColuna = {};
    Object.keys(columns).forEach(k => pedidosPorColuna[k] = []);

    pedidos.forEach(pedido => {
      const statusMapeado = mapStatus[pedido.status_pedido] || 'PENDENTE';
      if (pedidosPorColuna[statusMapeado]) {
        pedidosPorColuna[statusMapeado].push(pedido);
      }
    });

    // 3. Ordenar e renderizar por coluna
    Object.keys(pedidosPorColuna).forEach(status => {
      const colPedidos = pedidosPorColuna[status];
      
      colPedidos.sort((a, b) => {
        const aIsMD = a.md === 'sim' || a.md === 'Sim' || a.md === '1' || a.em_md === 'sim';
        const bIsMD = b.md === 'sim' || b.md === 'Sim' || b.md === '1' || b.em_md === 'sim';

        if (aIsMD && !bIsMD) return -1;
        if (!aIsMD && bIsMD) return 1;

        if (status === 'FINALIZADO') {
          return b.id - a.id; // Mais novo primeiro
        } else {
          return a.id - b.id; // Mais antigo primeiro
        }
      });

      colPedidos.forEach(pedido => {
        const isMD = pedido.md === 'sim' || pedido.md === 'Sim' || pedido.md === '1' || pedido.em_md === 'sim';
        columns[status].appendChild(createCard(pedido));
        
        if (isMD) {
          const kanbanCol = columns[status].closest('.kanban-column');
          if (kanbanCol) kanbanCol.classList.add('has-md');
        }
      });
    });
  }

  let draggedCard = null;

  function handleDragStart(e) {
    draggedCard = this;
    setTimeout(() => this.classList.add('dragging'), 0);
  }

  function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedCard = null;
  }

  const kanbanColumns = document.querySelectorAll('.kanban-column');
  kanbanColumns.forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-over');
    });

    col.addEventListener('dragleave', e => {
      col.classList.remove('drag-over');
    });

    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      
      if (draggedCard) {
        const body = col.querySelector('.column-body');
        body.appendChild(draggedCard);
        
        let newStatus = '';
        if (col.classList.contains('col-pendente')) newStatus = 'PENDENTE';
        else if (col.classList.contains('col-analise')) newStatus = 'EM_ANALISE';
        else if (col.classList.contains('col-oenv')) newStatus = 'ORCAMENTO_ENVIADO';
        else if (col.classList.contains('col-oaprov')) newStatus = 'APROVADO';
        else if (col.classList.contains('col-separacao')) newStatus = 'EM_PROCESSAMENTO';
        else if (col.classList.contains('col-finalizado')) newStatus = 'FINALIZADO';

        const id = draggedCard.dataset.id;
        const oldStatus = draggedCard.dataset.status;
        
        if (newStatus && newStatus !== oldStatus) {
          let extraData = {};
          
          if (newStatus === 'ORCAMENTO_ENVIADO') {
            const isCIF = draggedCard.dataset.iscif === 'true';
            
            if (isCIF) {
              const num = prompt('Cliente CIF identificado. Insira o número do Pedido:');
              if (!num) {
                alert('Preenchimento obrigatório para mover o card!');
                fetchPedidos();
                return;
              }
              extraData.numero_pedido_protheus = num;
            } else {
              const num = prompt('Insira o número do Orçamento:');
              if (!num) {
                alert('Preenchimento obrigatório para mover o card!');
                fetchPedidos();
                return;
              }
              extraData.numero_orcamento = num;
            }
          } else if (newStatus === 'EM_PROCESSAMENTO') {
            const isCIF = draggedCard.dataset.iscif === 'true';
            // Se for CIF, o pedido já foi digitado na etapa anterior ou pode ser digitado agora caso pule direto
            const num = prompt('Insira o número do Pedido:');
            if (!num) {
              alert('Preenchimento obrigatório para mover o card!');
              fetchPedidos();
              return;
            }
            extraData.numero_pedido_protheus = num;
          } else if (newStatus === 'FINALIZADO') {
            const num = prompt('Insira o número da Nota Fiscal:');
            if (!num) {
              alert('Preenchimento obrigatório para mover o card!');
              fetchPedidos();
              return;
            }
            extraData.nota_fiscal = num;
          }
          
          draggedCard.dataset.status = newStatus;
          updatePedidoStatus(id, newStatus, extraData);
        }
      }
    });
  });

  function updatePedidoStatus(id, newStatus, extraData = {}) {
    fetch(`/api/pedidos/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus, ...extraData })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        alert('Erro ao atualizar status do pedido');
      }
      fetchPedidos();
    })
    .catch(err => {
      console.error('Erro:', err);
      fetchPedidos();
    });
  }

  fetch('/api/me', { headers: { 'Authorization': `Bearer ${token}` } })
    .then(res => res.json())
    .then(data => {
      if (data.acesso) localStorage.setItem('bo_acesso', data.acesso);
      fetchPedidos();
    })
    .catch(() => fetchPedidos());
  
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('kanban_update', () => {
      if (!document.querySelector('.is-dragging')) {
        fetchPedidos();
      }
    });
  }
  window.abrirModalRequisicao = function(id) {
    try {
      const pedido = window.pedidosKanban.find(p => p.id === id);
      if (!pedido) return alert('Pedido não encontrado');

      if (!document.getElementById('req-solicitacao-id')) {
        alert('O seu navegador está utilizando uma versão antiga da página (cache). Por favor, pressione Ctrl + F5 ou limpe o cache para recarregar a interface atualizada.');
        return;
      }

      document.getElementById('req-solicitacao-id').value = pedido.id;
      document.getElementById('req-numero').value = '';
      document.getElementById('req-valor').value = '';
      document.getElementById('req-cliente').value = pedido.cliente || '';
      document.getElementById('req-maquina').value = pedido.modelo || '';

    const pecaSelect = document.getElementById('req-peca-select');
    pecaSelect.innerHTML = '';
    if (pedido.itens && pedido.itens.length > 1) {
      pecaSelect.innerHTML += `<option value="TODAS">Todas as peças</option>`;
    }
    if (pedido.itens) {
      pedido.itens.forEach((i, idx) => {
        pecaSelect.innerHTML += `<option value="${idx}">${i.codigo_peca} - ${i.descricao_peca || 'Sem descrição'} (Qtd: ${i.quantidade_solicitada || 1})</option>`;
      });
    }

    fetch('/api/tecnicos-malas', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        const malaSelect = document.getElementById('req-mala-select');
        malaSelect.innerHTML = '<option value="">Selecione...</option>';
        if (data.error) {
          alert('Erro na API de malas: ' + data.error);
          return;
        }
        if (Array.isArray(data)) {
          data.forEach(t => {
            malaSelect.innerHTML += `<option value="${t.mala}" data-nome="${t.nome}">${t.mala} - ${t.nome}</option>`;
          });
        }
      })
      .catch(e => {
        console.error('Erro no fetch de malas:', e);
        alert('Erro de conexão ao buscar malas.');
      });

    document.getElementById('modal-requisicao').style.display = 'flex';
    } catch (e) {
      alert('Erro inesperado ao abrir a janela: ' + e.message);
      console.error(e);
    }
  };

  window.salvarRequisicao = function() {
    const solicitacao_id = document.getElementById('req-solicitacao-id').value;
    const numero_requisicao = document.getElementById('req-numero').value;
    const valor_peca = document.getElementById('req-valor').value;
    const malaSelect = document.getElementById('req-mala-select');
    const mala = malaSelect.value;
    const tecnico_nome = malaSelect.options[malaSelect.selectedIndex]?.dataset?.nome || '';
    const pecaIdx = document.getElementById('req-peca-select').value;
    const cliente = document.getElementById('req-cliente').value;
    const maquina = document.getElementById('req-maquina').value;

    if (!numero_requisicao || !mala || !valor_peca) {
      return alert('Preencha os campos obrigatórios (Número, Mala e Valor).');
    }

    const pedido = window.pedidosKanban.find(p => p.id == solicitacao_id);
    let itens = [];
    if (pecaIdx === 'TODAS') {
      itens = pedido.itens;
    } else {
      itens = [pedido.itens[Number(pecaIdx)]];
    }

    // mapear quantidade
    itens = itens.map(i => ({
      ...i,
      quantidade: i.quantidade_solicitada || 1
    }));

    fetch('/api/requisicoes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        solicitacao_id, numero_requisicao, valor_peca, mala, tecnico_nome, cliente, maquina, itens
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('modal-requisicao').style.display = 'none';
        fetchPedidos();
      } else {
        alert('Erro ao salvar: ' + data.error);
      }
    });
  };

});
