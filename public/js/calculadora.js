// js/calculadora.js

document.addEventListener('DOMContentLoaded', () => {
  const btnCalc = document.getElementById('btn-calc-ptax');
  const drawer = document.getElementById('calc-drawer');
  const btnClose = document.getElementById('calc-close-btn');
  
  const loadingEl = document.getElementById('calc-loading');
  const contentEl = document.getElementById('calc-content');
  const resultPanel = document.getElementById('calc-result-panel');
  
  const ptaxDateDisplay = document.getElementById('ptax-date-display');
  
  const inputFob = document.getElementById('calc-fob');
  const selectCurrency = document.getElementById('calc-currency');
  const selectMode = document.getElementById('calc-mode');
  const selectFactor = document.getElementById('calc-factor');
  const btnSubmit = document.getElementById('calc-submit-btn');

  const finalValueEl = document.getElementById('calc-final-value');
  const detailFobEl = document.getElementById('calc-detail-fob');
  const detailRateEl = document.getElementById('calc-detail-rate');
  const rateLabelEl = document.getElementById('calc-rate-label');

  let currentPtaxData = null;
  let isLoadingPtax = false;
  let ptaxHasLoadedOnce = false;

  // ==== API LOGIC (BCB) ====
  
  const fetchCurrency = async (moeda, formattedDate) => {
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${moeda}'&@dataCotacao='${formattedDate}'&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.value && data.value.length > 0) {
        const rate = data.value[0];
        return {
          compra: rate.cotacaoCompra,
          venda: rate.cotacaoVenda,
          media: (rate.cotacaoCompra + rate.cotacaoVenda) / 2,
          paridadeCompra: rate.paridadeCompra,
          paridadeVenda: rate.paridadeVenda,
          paridadeMedia: (rate.paridadeCompra + rate.paridadeVenda) / 2,
        };
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const fetchDolar = async (formattedDate) => {
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${formattedDate}'&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.value && data.value.length > 0) {
        const rate = data.value[0];
        return {
          compra: rate.cotacaoCompra,
          venda: rate.cotacaoVenda,
          media: (rate.cotacaoCompra + rate.cotacaoVenda) / 2,
          paridadeCompra: 1, 
          paridadeVenda: 1,
          paridadeMedia: 1,
          dataHoraCotacao: rate.dataHoraCotacao,
        };
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const fetchPtax = async () => {
    isLoadingPtax = true;
    loadingEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    
    let date = new Date();
    // Helper para checar FDS
    const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
    const subDays = (d, days) => new Date(d.getTime() - (days * 24 * 60 * 60 * 1000));
    
    while (isWeekend(date)) {
      date = subDays(date, 1);
    }

    for (let i = 0; i < 5; i++) {
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const y = date.getFullYear();
      const formattedDate = `${m}-${d}-${y}`;
      
      const usdRate = await fetchDolar(formattedDate);
      if (usdRate) {
        const [eurRate, gbpRate] = await Promise.all([
          fetchCurrency('EUR', formattedDate),
          fetchCurrency('GBP', formattedDate)
        ]);

        if (eurRate && gbpRate) {
          currentPtaxData = {
            USD: usdRate,
            EUR: eurRate,
            GBP: gbpRate,
            dataHoraCotacao: usdRate.dataHoraCotacao,
          };
          break;
        }
      }
      
      date = subDays(date, 1);
      while (isWeekend(date)) {
        date = subDays(date, 1);
      }
    }

    isLoadingPtax = false;
    loadingEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

    if (currentPtaxData) {
      ptaxHasLoadedOnce = true;
      const dataObj = new Date(currentPtaxData.dataHoraCotacao);
      ptaxDateDisplay.textContent = dataObj.toLocaleString('pt-BR');
    } else {
      ptaxDateDisplay.textContent = 'Erro ao buscar PTAX';
      ptaxDateDisplay.style.color = 'red';
    }
  };

  // ==== UI LOGIC ====

  const abgToggle = document.getElementById('calc-abg-toggle');
  const abgSelector = document.getElementById('abg-currency-selector');

  abgToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
      abgSelector.classList.remove('hidden');
    } else {
      abgSelector.classList.add('hidden');
    }
  });

  btnCalc.addEventListener('click', () => {
    drawer.classList.add('open');
    if (!ptaxHasLoadedOnce && !isLoadingPtax) {
      fetchPtax();
    }
  });

  btnClose.addEventListener('click', () => {
    drawer.classList.remove('open');
  });

  btnSubmit.addEventListener('click', () => {
    if (!currentPtaxData) {
      alert("Aguarde a atualização da PTAX ou recarregue a página.");
      return;
    }

    const fob = parseFloat(inputFob.value) || 0;
    if (fob <= 0) return alert("Insira um valor FOB válido.");

    let currency = selectCurrency.value;
    const mode = selectMode.value;
    const factorValue = parseFloat(selectFactor.value);
    const isAbg = abgToggle.checked;

    let rateData = currentPtaxData[currency];
    let adjustedFob = fob * factorValue;
    let detailFobText = '';

    if (isAbg) {
      const abgCurr = document.querySelector('input[name="abg-curr"]:checked').value;
      
      // Pega a paridade da moeda ABG (EUR ou GBP)
      const parity = currentPtaxData[abgCurr].paridadeMedia;
      const fobInUsd = fob * parity;
      
      // A partir de agora, o cálculo matemático assume as métricas do USD
      rateData = currentPtaxData['USD'];
      adjustedFob = fobInUsd * factorValue;
      
      detailFobText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' }).format(adjustedFob) + ` (ABG de ${abgCurr})`;
    } else {
      detailFobText = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency }).format(adjustedFob);
    }

    let finalValue = 0;
    let rateUsed = 0;
    let outputCurrency = 'BRL';

    if (isAbg) {
      // Quando ABG está ativo: Valor Final = (FOB convertido p/ Dólar) x Fator.
      // O resultado final fica em USD (NÃO CONVERTE PARA BRL).
      const abgCurr = document.querySelector('input[name="abg-curr"]:checked').value;
      rateUsed = currentPtaxData[abgCurr].paridadeMedia; // Apenas para exibição
      finalValue = adjustedFob; // já é o FOB_USD * Fator
      
      outputCurrency = 'USD';
      rateLabelEl.textContent = "Paridade p/ USD";
    } else {
      // Quando ABG está desligado, segue a lógica normal:
      if (mode === 'importacao') {
        rateUsed = rateData.paridadeMedia;
        finalValue = adjustedFob * rateUsed;
        rateLabelEl.textContent = "Paridade Média";
        outputCurrency = 'USD';
      } else {
        rateUsed = rateData.media;
        finalValue = adjustedFob * rateUsed;
        rateLabelEl.textContent = "PTAX Média";
        outputCurrency = 'BRL';
      }
    }
    
    finalValueEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: outputCurrency }).format(finalValue);
    
    detailFobEl.textContent = detailFobText;
    detailRateEl.textContent = rateUsed.toFixed(4);

    resultPanel.classList.remove('hidden');
  });

});
