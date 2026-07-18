import type { HistoryRecord } from '../App';

interface ResultPanelProps {
  result: HistoryRecord | null;
}

export function ResultPanel({ result }: ResultPanelProps) {
  if (!result) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center h-full min-h-[300px]">
        <p className="text-gray-500 dark:text-gray-400 text-center">
          Preencha os dados e calcule<br />para ver o resultado aqui.
        </p>
      </div>
    );
  }

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden h-full">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 text-white text-center">
        <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-2">
          Valor Final {result.mode === 'importacao' ? '(USD)' : '(BRL)'}
        </h2>
        <div className="text-4xl md:text-5xl font-extrabold tracking-tight">
          {result.mode === 'importacao' ? formatCurrency(result.finalValue, 'USD') : formatCurrency(result.finalValue, 'BRL')}
        </div>
        {result.partNumber && (
          <div className="mt-3 inline-block bg-white/10 px-3 py-1 rounded-full text-sm">
            PN: {result.partNumber}
          </div>
        )}
      </div>
      
      <div className="p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
          Composição do Preço ({result.mode === 'importacao' ? 'Importação' : 'Pronta Entrega'})
        </h3>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Preço FOB ({result.currency})</span>
            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(result.fob, result.currency)}</span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400">Fator ({result.factorName})</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">x {result.factorValue.toFixed(2)}</span>
          </div>
          
          {result.currency !== 'USD' && result.mode === 'importacao' && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Conversão ({result.currency} para USD)</span>
              <span className="font-medium text-orange-600 dark:text-orange-400">x {result.paridade.toFixed(4)}</span>
            </div>
          )}

          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 -mx-6 px-6">
            <span className="font-medium text-gray-700 dark:text-gray-300">Valor Ajustado</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {formatCurrency(result.fob * result.factorValue, result.currency)}
            </span>
          </div>
          
          {result.mode === 'pronta-entrega' && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Conversão ({result.currency} para BRL)</span>
              <span className="font-medium text-green-600 dark:text-green-400">x R$ {result.ptax.toFixed(4)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
