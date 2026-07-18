import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { PtaxData } from '../services/ptax';

interface PtaxCardsProps {
  ptax: PtaxData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export function PtaxCards({ ptax, isLoading, onRefresh }: PtaxCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 4,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">PTAX Compra</h3>
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {isLoading ? '---' : ptax ? formatCurrency(ptax.USD.compra) : 'Erro'}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">PTAX Venda</h3>
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {isLoading ? '---' : ptax ? formatCurrency(ptax.USD.venda) : 'Erro'}
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-md p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10">
          <TrendingUp className="h-32 w-32 -mr-8 -mt-8" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-blue-100">PTAX Média</h3>
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Minus className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="text-2xl font-bold">
            {isLoading ? '---' : ptax ? formatCurrency(ptax.USD.media) : 'Erro'}
          </div>
          <div className="mt-4 flex justify-between items-center">
            <span className="text-xs text-blue-200">Utilizada para cálculo</span>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
            >
              Atualizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
