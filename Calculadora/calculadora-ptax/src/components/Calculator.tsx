import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface Factor {
  id: string;
  name: string;
  value: number;
}

export type CurrencyCode = 'USD' | 'EUR' | 'GBP';

export type CalculationMode = 'importacao' | 'pronta-entrega';

export interface CalculationInput {
  fob: number;
  factor: Factor;
  partNumber: string;
  mode: CalculationMode;
  currency: CurrencyCode;
}

interface CalculatorProps {
  factors: Factor[];
  onAddFactor: (name: string, value: number) => void;
  onDeleteFactor: (id: string) => void;
  onCalculate: (input: CalculationInput) => void;
  mode: CalculationMode;
}

export function Calculator({ factors, onAddFactor, onDeleteFactor, onCalculate, mode }: CalculatorProps) {
  const [fob, setFob] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [selectedFactorId, setSelectedFactorId] = useState(factors[0]?.id || '');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [isAbgMode, setIsAbgMode] = useState(false);
  
  const [showAddFactor, setShowAddFactor] = useState(false);
  const [newFactorName, setNewFactorName] = useState('');
  const [newFactorValue, setNewFactorValue] = useState('');

  const handleAddFactor = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFactorName && newFactorValue) {
      onAddFactor(newFactorName, parseFloat(newFactorValue));
      setNewFactorName('');
      setNewFactorValue('');
      setShowAddFactor(false);
    }
  };

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const factor = factors.find((f) => f.id === selectedFactorId);
    if (fob && factor) {
      onCalculate({
        fob: parseFloat(fob),
        factor,
        partNumber,
        mode,
        currency
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Calculadora de Preço</h2>
        
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
          mode === 'importacao'
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            mode === 'importacao' ? 'bg-purple-500' : 'bg-green-500'
          }`} />
          {mode === 'importacao' ? 'Importação' : 'Pronta Entrega'}
        </div>
      </div>
      
      <form onSubmit={handleCalculate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="fob" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preço FOB (USD) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 dark:text-gray-400 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                id="fob"
                required
                min="0"
                step="0.01"
                value={fob}
                onChange={(e) => setFob(e.target.value)}
                className="pl-7 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label htmlFor="partNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Part Number (Opcional)
            </label>
            <input
              type="text"
              id="partNumber"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
              placeholder="Ex: CQ114A"
            />
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Moeda de Origem
            </label>
            <button
              type="button"
              onClick={() => {
                const newMode = !isAbgMode;
                setIsAbgMode(newMode);
                setCurrency(newMode ? 'GBP' : 'USD');
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isAbgMode
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {isAbgMode ? 'Fechar Painel ABG' : 'Painel ABG'}
            </button>
          </div>

          {isAbgMode ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-blue-100 dark:border-blue-900/30">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">Selecione a Moeda ABG</h4>
              <div className="flex gap-3">
                {(['GBP', 'EUR'] as CurrencyCode[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                      currency === c
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {c === 'GBP' ? 'Libra (GBP)' : 'Euro (EUR)'}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700/50 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-md">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Padrão: Dólar (USD)
            </div>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Fator Multiplicador *
            </label>
            <button
              type="button"
              onClick={() => setShowAddFactor(!showAddFactor)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Novo Fator
            </button>
          </div>

          {showAddFactor && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nome do Fator</label>
                  <input
                    type="text"
                    value={newFactorName}
                    onChange={(e) => setNewFactorName(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm px-3 py-1.5 text-sm"
                    placeholder="Ex: Margem Especial"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Valor (Ex: 1.5)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newFactorValue}
                    onChange={(e) => setNewFactorValue(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm px-3 py-1.5 text-sm"
                    placeholder="1.00"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddFactor}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {factors.map((factor) => (
              <div
                key={factor.id}
                className={`relative rounded-lg border p-3 cursor-pointer transition-all ${
                  selectedFactorId === factor.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                }`}
                onClick={() => setSelectedFactorId(factor.id)}
              >
                <div className="font-medium text-sm text-gray-900 dark:text-white">{factor.name}</div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                  x {factor.value.toFixed(2)}
                </div>
                {!['contrato', 'venda', 'venda_4', 'venda_6', 'venda_8', 'venda_10'].includes(factor.id) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFactor(factor.id);
                      if (selectedFactorId === factor.id) {
                        setSelectedFactorId(factors[0]?.id || '');
                      }
                    }}
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            type="submit"
            disabled={!fob || !selectedFactorId}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Calcular Preço Final
          </button>
        </div>
      </form>
    </div>
  );
}
