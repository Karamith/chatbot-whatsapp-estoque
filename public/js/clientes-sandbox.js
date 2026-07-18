let clientesData = [];

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/clientes-dashboard');
    if (!res.ok) throw new Error('Erro ao buscar dados');
    clientesData = await res.json();
    renderGrid(clientesData);
  } catch (error) {
    console.error('Falha ao carregar os clientes:', error);
    document.getElementById('clients-grid').innerHTML = '<p style="color:red;">Erro ao carregar dados do servidor.</p>';
  }

  // Bind dos botões do cabeçalho
  const botoes = document.querySelectorAll('.header-btn');
  botoes.forEach(btn => {
    const btnText = btn.textContent.trim().toLowerCase();
    if (btnText.includes('atualizar')) {
      btn.addEventListener('click', async () => {
        btn.innerText = 'Atualizando...';
        btn.disabled = true;
        try {
          const res = await fetch('/api/clientes-reload', { method: 'POST' });
          if (res.ok) {
            const result = await res.json();
            clientesData = result.data;
            renderGrid(clientesData);
          } else {
            alert('Erro ao atualizar dados.');
          }
        } catch (error) {
          console.error('Erro:', error);
          alert('Falha ao atualizar dados.');
        } finally {
          btn.innerText = 'Atualizar';
          btn.disabled = false;
        }
      });
    } else if (btnText.includes('voltar')) {
      btn.addEventListener('click', () => {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage('closeClientesDrawer', '*');
        } else {
          window.history.back();
        }
      });
    }
  });
});

function renderGrid(dados) {
  const grid = document.getElementById('clients-grid');
  grid.innerHTML = '';

  dados.forEach((cliente, index) => {
    const div = document.createElement('div');
    div.className = 'client-btn';
    div.innerText = cliente.cliente;
    div.dataset.index = index;

    div.addEventListener('click', () => {
      document.querySelectorAll('.client-btn').forEach(b => b.classList.remove('active'));
      div.classList.add('active');
      
      atualizarDashboardCliente(cliente);
    });

    grid.appendChild(div);
  });

  if (dados.length > 0) {
    document.querySelector('.client-btn').click();
  }
}

function atualizarDashboardCliente(cliente) {
  const equipContainer = document.getElementById('dash-equipamentos');
  equipContainer.innerHTML = '';

  // Limpa campos se não houver equipamento
  limparMetricas();

  if (cliente.equipamentos && cliente.equipamentos.length > 0) {
    cliente.equipamentos.forEach((eq, idx) => {
      const eqCard = document.createElement('div');
      eqCard.className = 'dash-card eq-card-btn';
      eqCard.style.cursor = 'pointer';
      // Borda vermelha se estiver ativo
      eqCard.innerHTML = `<h4>Equipamento</h4><h2>${eq.equipamento || '-'}</h2>`;
      
      eqCard.addEventListener('click', () => {
        // Remove active dos equipamentos
        document.querySelectorAll('.eq-card-btn').forEach(b => {
           b.style.borderColor = 'rgba(255, 255, 255, 0.08)';
           b.style.boxShadow = 'none';
        });
        // Adiciona active no clicado
        eqCard.style.borderColor = 'var(--neon-red)';
        eqCard.style.boxShadow = '0 0 10px var(--neon-red-glow)';
        
        atualizarMetricasEquipamento(eq);
      });

      equipContainer.appendChild(eqCard);
    });

    // Auto-clicar no primeiro equipamento
    equipContainer.firstChild.click();
  } else {
    equipContainer.innerHTML = '<div class="dash-card"><h4>Aviso</h4><h2>Nenhum equipamento</h2></div>';
  }
}

function limparMetricas() {
  document.getElementById('dash-encerramento').innerText = '-';
  document.getElementById('dash-dias-restantes').innerText = '-';
  document.getElementById('dash-modalidades').innerHTML = '';
  document.getElementById('dash-servicos').innerHTML = '';
  document.getElementById('gauge-value').innerText = `0%`;
  const pbar = document.getElementById('progress-bar');
  if (pbar) {
    pbar.style.width = '0%';
    pbar.style.backgroundColor = '#00ff80';
  }
  const warning = document.getElementById('progress-warning');
  if (warning) warning.style.display = 'none';
}

function atualizarMetricasEquipamento(eq) {
  // Serviços
  const servContainer = document.getElementById('dash-servicos');
  servContainer.innerHTML = '';
  if (eq.servicos && eq.servicos !== '-') {
    const servCard = document.createElement('div');
    servCard.className = 'dash-card';
    servCard.innerHTML = `<h4>Serviços</h4><h2>${eq.servicos}</h2>`;
    servContainer.appendChild(servCard);
  } else {
    servContainer.innerHTML = '<div class="dash-card"><h4>Serviços</h4><h2>-</h2></div>';
  }

  // Modalidade (Contrato)
  const modContainer = document.getElementById('dash-modalidades');
  modContainer.innerHTML = '';
  if (eq.contrato && eq.contrato !== '-') {
    const modCard = document.createElement('div');
    modCard.className = 'dash-card';
    modCard.innerHTML = `<h4>Contrato</h4><h2>${eq.contrato}</h2>`;
    modContainer.appendChild(modCard);
  } else {
    modContainer.innerHTML = '<div class="dash-card"><h4>Contrato</h4><h2>-</h2></div>';
  }

  // Datas
  document.getElementById('dash-encerramento').innerText = eq.data_encerramento || 'N/A';
  const diasRestantes = eq.dias_restantes;
  document.getElementById('dash-dias-restantes').innerText = diasRestantes <= 0 ? 'Finalizado' : diasRestantes;

  // Barra de Progresso
  const progresso = eq.progresso_porcentagem || 0;
  document.getElementById('gauge-value').innerText = `${progresso}%`;
  
  const pbar = document.getElementById('progress-bar');
  if (pbar) {
    pbar.style.width = `${progresso}%`;
    
    // 0 a 50 = verde. 50 a 75 = amarelo. 75 a 90 = laranja. 90 a 100 = vermelho.
    if (progresso <= 50) {
      pbar.style.backgroundColor = '#00ff80'; // verde neon
    } else if (progresso <= 75) {
      pbar.style.backgroundColor = '#ffeb3b'; // amarelo
    } else if (progresso <= 90) {
      pbar.style.backgroundColor = '#ff9800'; // laranja
    } else {
      pbar.style.backgroundColor = '#f44336'; // vermelho
    }
  }

  const warning = document.getElementById('progress-warning');
  if (warning) {
    if (progresso > 80) {
      warning.style.display = 'block';
    } else {
      warning.style.display = 'none';
    }
  }
}
