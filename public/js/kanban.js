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
      mdIndicator = `<div class="bo-card-indicator" style="height: 8px; background: repeating-linear-gradient(45deg, #8B0000, #8B0000 10px, #FF0000 10px, #FF0000 20px);"></div>`;
      mdFooter = `
        <div style="background: linear-gradient(90deg, #5c0000, #ff0000); color: white; text-align: center; padding: 10px; font-weight: bold; font-size: 0.8rem; margin: 16px -16px -16px -16px; border-radius: 0 0 12px 12px;">
          ⚠️ MACHINE DOWN | PRIORIDADE MÁXIMA
        </div>
      `;
    }

    card.innerHTML = `
      ${mdIndicator}
      <div class="bo-card-row" style="gap: 8px;">
        <div class="tech-info-flex" style="white-space: nowrap; flex-shrink: 0;">
          <span class="icon" style="margin-right: 4px;">📋</span> 
          <span class="bo-value large" style="font-size: 1rem;">#PD-${String(pedido.id).padStart(4, '0')}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: nowrap;">
          ${pedido.itens && pedido.itens.some(i => i.descricao_peca && i.descricao_peca.includes('[! Importar]')) ? '<span class="bo-role-badge" style="border-color: #F59E0B; color: #F59E0B; white-space: nowrap; padding: 2px 4px; font-size: 0.6rem;">⚠️ IMPORTAR</span>' : ''}
          ${isMD ? '<span class="bo-role-badge" style="border-color: #EF4444; color: #EF4444; white-space: nowrap; padding: 2px 4px; font-size: 0.6rem;">MD</span>' : ''}
          <span class="bo-role-badge" style="border-color: ${statusColor}; color: ${statusColor}; white-space: nowrap; padding: 2px 4px; font-size: 0.6rem;">${pedido.status_pedido.replace('_', ' ')}</span>
          <div style="position: relative; display: inline-block;">
            <span class="btn-dots" style="color: var(--text-secondary); cursor: pointer; margin-left: 2px; padding: 0 6px;">⋮</span>
            <div class="dropdown-reprovado" style="display: none; position: absolute; right: 0; top: 100%; background: #2A2D35; border: 1px solid #374151; border-radius: 4px; padding: 4px; z-index: 10; box-shadow: 0 4px 6px rgba(0,0,0,0.3); min-width: 100px;">
              <button onclick="window.importarPedido(${pedido.id})" style="background: #F59E0B; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; white-space: nowrap; width: 100%; margin-bottom: 4px;">Importação</button>
              <button onclick="window.reprovarPedido(${pedido.id})" style="background: #EF4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; white-space: nowrap; width: 100%;">Reprovado</button>
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
        
        ${isCIF ? `
        <!-- Esquerda: PEDIDO (CIF não tem orçamento) -->
        <div class="bo-info-group" style="flex: 1; text-align: left;">
          <span class="bo-label">📦 PEDIDO</span>
          <span class="bo-value" style="font-size: 0.85rem;">${pedido.numero_pedido_protheus || 'N/A'}</span>
        </div>
        <!-- Centro: Vazio para manter alinhamento -->
        <div class="bo-info-group" style="flex: 1; text-align: center;"></div>
        ` : `
        <!-- Esquerda: ORÇAMENTO -->
        <div class="bo-info-group" style="flex: 1; text-align: left;">
          <span class="bo-label">📄 ORÇAMENTO</span>
          <span class="bo-value" style="font-size: 0.85rem;">${pedido.numero_orcamento || 'N/A'}</span>
        </div>

        <!-- Centro: PEDIDO -->
        <div class="bo-info-group" style="flex: 1; text-align: center;">
          <span class="bo-label" style="justify-content: center;">📦 PEDIDO</span>
          <span class="bo-value" style="font-size: 0.85rem;">${pedido.numero_pedido_protheus || 'N/A'}</span>
        </div>
        `}

        <!-- Direita: NF (se houver) e B.O. -->
        <div class="bo-info-group" style="flex: 1; text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
          ${pedido.nota_fiscal ? `
          <div style="display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 4px;">
            <span class="bo-label" style="justify-content: flex-end;">🧾 NF</span>
            <span class="bo-value" style="font-size: 0.85rem;">${pedido.nota_fiscal}</span>
          </div>
          ` : ''}
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
    if (confirm("Mover este pedido para Importação? Ele sairá do Kanban principal.")) {
      updatePedidoStatus(id, 'IMPORTACAO');
    }
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
        fetchPedidos();
      }
    })
    .catch(err => {
      console.error('Erro:', err);
      fetchPedidos();
    });
  }

  fetchPedidos();
  
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('kanban_update', () => {
      if (!document.querySelector('.is-dragging')) {
        fetchPedidos();
      }
    });
  }
});
