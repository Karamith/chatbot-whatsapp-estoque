import axios from 'axios';
import { format, subDays, isWeekend } from 'date-fns';

export interface CurrencyRate {
  compra: number;
  venda: number;
  media: number;
  paridadeCompra: number;
  paridadeVenda: number;
  paridadeMedia: number;
}

export interface PtaxData {
  USD: CurrencyRate;
  EUR: CurrencyRate;
  GBP: CurrencyRate;
  dataHoraCotacao: string;
}

const fetchCurrency = async (moeda: string, formattedDate: string) => {
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${moeda}'&@dataCotacao='${formattedDate}'&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`;
  const response = await axios.get(url);
  const data = response.data;
  
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
  return null;
};

const fetchDolar = async (formattedDate: string) => {
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${formattedDate}'&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`;
  const response = await axios.get(url);
  const data = response.data;
  
  if (data && data.value && data.value.length > 0) {
    const rate = data.value[0];
    return {
      compra: rate.cotacaoCompra,
      venda: rate.cotacaoVenda,
      media: (rate.cotacaoCompra + rate.cotacaoVenda) / 2,
      paridadeCompra: 1, // USD to USD parity is 1
      paridadeVenda: 1,
      paridadeMedia: 1,
      dataHoraCotacao: rate.dataHoraCotacao,
    };
  }
  return null;
};

export const fetchPtax = async (): Promise<PtaxData | null> => {
  let date = new Date();
  
  while (isWeekend(date)) {
    date = subDays(date, 1);
  }

  for (let i = 0; i < 5; i++) {
    const formattedDate = format(date, 'MM-dd-yyyy');
    
    try {
      const usdRate = await fetchDolar(formattedDate);
      
      if (usdRate) {
        // Fetch EUR and GBP for the same date
        const [eurRate, gbpRate] = await Promise.all([
          fetchCurrency('EUR', formattedDate),
          fetchCurrency('GBP', formattedDate)
        ]);

        if (eurRate && gbpRate) {
          return {
            USD: { ...usdRate },
            EUR: eurRate,
            GBP: gbpRate,
            dataHoraCotacao: usdRate.dataHoraCotacao,
          };
        }
      }
    } catch (error) {
      console.error('Error fetching rates from BCB API', error);
    }
    
    date = subDays(date, 1);
    while (isWeekend(date)) {
      date = subDays(date, 1);
    }
  }

  return null;
};

