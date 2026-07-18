import { useState } from 'react';
import { Package, Truck, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import type { CalculationMode } from './Calculator';

interface SidebarProps {
  activeMode: CalculationMode;
  onModeChange: (mode: CalculationMode) => void;
}

export function Sidebar({ activeMode, onModeChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const menuItems = [
    {
      id: 'importacao' as CalculationMode,
      label: 'Importação',
      icon: Package,
      description: 'Cálculo em USD',
    },
    {
      id: 'pronta-entrega' as CalculationMode,
      label: 'Pronta Entrega',
      icon: Truck,
      description: 'Conversão para BRL',
    },
  ];

  const handleModeChange = (mode: CalculationMode) => {
    onModeChange(mode);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-[18px] left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 flex flex-col
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          shadow-lg transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-[72px]' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:relative lg:z-0
        `}
      >
        {/* Sidebar Header */}
        <div className={`flex items-center h-16 border-b border-gray-200 dark:border-gray-700 px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Modo
            </span>
          )}

          {/* Close button on mobile */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Collapse toggle on desktop */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-3 py-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMode === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleModeChange(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 rounded-lg transition-all duration-200
                  ${isCollapsed ? 'justify-center px-2 py-3' : 'px-4 py-3'}
                  ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
                {!isCollapsed && (
                  <div className="text-left min-w-0">
                    <div className={`text-sm font-medium truncate ${isActive ? 'text-white' : ''}`}>
                      {item.label}
                    </div>
                    <div className={`text-xs truncate ${isActive ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
                      {item.description}
                    </div>
                  </div>
                )}

                {/* Active indicator dot for collapsed mode */}
                {isCollapsed && isActive && (
                  <span className="absolute right-1 w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Import Parts Pricing
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
