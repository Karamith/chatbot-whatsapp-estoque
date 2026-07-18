import { Moon, Sun, Calculator } from 'lucide-react';

interface HeaderProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  lastUpdated: string | null;
}

export function Header({ isDarkMode, toggleTheme, lastUpdated }: HeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Import Parts Pricing
          </h1>
        </div>
        
        <div className="flex items-center gap-6">
          {lastUpdated && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="hidden sm:inline">Última PTAX: </span>
              {lastUpdated}
            </div>
          )}
          
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle theme"
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5 text-yellow-500" />
            ) : (
              <Moon className="h-5 w-5 text-gray-500" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
