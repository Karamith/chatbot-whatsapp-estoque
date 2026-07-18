import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PtaxCards } from './components/PtaxCards';
import { Calculator } from './components/Calculator';
import type { Factor, CalculationInput, CalculationMode } from './components/Calculator';
import { ResultPanel } from './components/ResultPanel';
import { HistoryTable } from './components/HistoryTable';
import { fetchPtax } from './services/ptax';
import type { PtaxData } from './services/ptax';
import { useLocalStorage } from './hooks/useLocalStorage';
import { format } from 'date-fns';

export interface HistoryRecord {
  id: string;
  date: string;
  fob: number;
  currency: 'USD' | 'EUR' | 'GBP';
  partNumber: string;
  factorId: string;
  factorName: string;
  factorValue: number;
  ptax: number;
  paridade: number;
  finalValue: number;
  mode: CalculationMode;
}

const DEFAULT_FACTORS: Factor[] = [
  { id: 'contrato', name: 'Contrato', value: 1.20 },
  { id: 'venda_4', name: 'Venda (4.0)', value: 4.00 },
  { id: 'venda_6', name: 'Venda (6.0)', value: 6.00 },
  { id: 'venda_8', name: 'Venda (8.0)', value: 8.00 },
  { id: 'venda_10', name: 'Venda (10.0)', value: 10.00 }
];

function App() {
  const [isDarkMode, setIsDarkMode] = useLocalStorage<boolean>('theme-dark', true);
  const [factors, setFactors] = useLocalStorage<Factor[]>('custom-factors', DEFAULT_FACTORS);
  const [history, setHistory] = useLocalStorage<HistoryRecord[]>('calc-history', []);
  
  const [ptax, setPtax] = useState<PtaxData | null>(null);
  const [isLoadingPtax, setIsLoadingPtax] = useState(true);
  const [lastResult, setLastResult] = useState<HistoryRecord | null>(null);
  const [mode, setMode] = useState<CalculationMode>('pronta-entrega');

  const loadPtax = async () => {
    setIsLoadingPtax(true);
    const data = await fetchPtax();
    if (data) {
      setPtax(data);
    }
    setIsLoadingPtax(false);
  };

  useEffect(() => {
    loadPtax();
    
    // Migrate new default factors to existing local storage
    const missingFactors = DEFAULT_FACTORS.filter(
      df => !factors.some(f => f.id === df.id)
    );
    if (missingFactors.length > 0) {
      setFactors(prev => {
        // Replace old 'venda' if present to avoid duplication
        const withoutOldVenda = prev.filter(f => f.id !== 'venda');
        return [...withoutOldVenda, ...missingFactors];
      });
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleAddFactor = (name: string, value: number) => {
    const newFactor: Factor = {
      id: `custom_${Date.now()}`,
      name,
      value
    };
    setFactors([...factors, newFactor]);
  };

  const handleDeleteFactor = (id: string) => {
    setFactors(factors.filter(f => f.id !== id));
  };

  const handleCalculate = (input: CalculationInput) => {
    if (!ptax) {
      alert("Aguarde a atualização da PTAX ou tente novamente.");
      return;
    }

    const rateData = ptax[input.currency];
    const adjustedFob = input.fob * input.factor.value;
    
    // For importacao: base FOB * factor * paridade (to convert to USD)
    // For pronta-entrega: base FOB * factor * media (to convert to BRL directly)
    const finalValue = input.mode === 'importacao' 
      ? adjustedFob * rateData.paridadeMedia 
      : adjustedFob * rateData.media;

    const newRecord: HistoryRecord = {
      id: `rec_${Date.now()}`,
      date: new Date().toISOString(),
      fob: input.fob,
      currency: input.currency,
      partNumber: input.partNumber,
      factorId: input.factor.id,
      factorName: input.factor.name,
      factorValue: input.factor.value,
      ptax: rateData.media,
      paridade: rateData.paridadeMedia,
      finalValue,
      mode: input.mode
    };

    setLastResult(newRecord);
    setHistory([newRecord, ...history].slice(0, 15));
  };

  const handleDeleteRecord = (id: string) => {
    setHistory(history.filter(r => r.id !== id));
    if (lastResult?.id === id) {
      setLastResult(null);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    setLastResult(null);
  };

  const lastUpdated = ptax ? format(new Date(ptax.dataHoraCotacao), 'dd/MM/yyyy HH:mm') : null;

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 font-sans flex`}>
      <Sidebar activeMode={mode} onModeChange={setMode} />

      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <Header 
          isDarkMode={isDarkMode} 
          toggleTheme={() => setIsDarkMode(!isDarkMode)} 
          lastUpdated={lastUpdated} 
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PtaxCards 
            ptax={ptax} 
            isLoading={isLoadingPtax} 
            onRefresh={loadPtax} 
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Calculator 
                factors={factors}
                onAddFactor={handleAddFactor}
                onDeleteFactor={handleDeleteFactor}
                onCalculate={handleCalculate}
                mode={mode}
              />
            </div>
            <div className="lg:col-span-1">
              <ResultPanel result={lastResult} />
            </div>
          </div>

          <HistoryTable 
            records={history}
            onDeleteRecord={handleDeleteRecord}
            onClearAll={handleClearHistory}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
