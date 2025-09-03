import React, { useState } from 'react';
import { Menu, X, Info, Anchor, ChevronDown, Copy, TrendingUp, Settings } from 'lucide-react';

interface GlobalSettingsMenuProps {
  activeModule: 'judge' | 'anagram' | 'lists';
  // Anagram-specific props (only used when activeModule === 'anagram')
  anagramSettings?: {
    showShorter: boolean;
    onShowShorterChange: (show: boolean) => void;
    showExtendedView: boolean;
    onExtendedViewChange: (show: boolean) => void;
    showHooksView: boolean;
    onHooksViewChange: (show: boolean) => void;
    hasActiveSearch: boolean;
    onCopyAll?: () => void;
    sortByEquity: boolean;
    onSortByEquityChange: (sort: boolean) => void;
    isPatternWithoutRack?: boolean;
  };
}

const GlobalSettingsMenu: React.FC<GlobalSettingsMenuProps> = ({
  activeModule,
  anagramSettings
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const handleToggleChange = (toggleFn: (value: boolean) => void, currentValue: boolean) => {
    toggleFn(!currentValue);
  };

  const renderToggle = (
    label: string,
    value: boolean,
    onChange: (value: boolean) => void,
    icon: React.ReactNode,
    disabled = false
  ) => (
    <div className={`flex items-center justify-between py-3 px-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center space-x-3">
        {icon}
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <button
        onClick={() => !disabled && handleToggleChange(onChange, value)}
        disabled={disabled}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
          value ? 'bg-blue-600' : 'bg-gray-300'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  const renderAnagramSettings = () => {
    if (!anagramSettings) return null;

    const {
      showShorter,
      onShowShorterChange,
      showExtendedView,
      onExtendedViewChange,
      showHooksView,
      onHooksViewChange,
      hasActiveSearch,
      onCopyAll,
      sortByEquity,
      onSortByEquityChange,
      isPatternWithoutRack = false
    } = anagramSettings;

    return (
      <div className="space-y-1">
        {/* Shorter Words Toggle */}
        {renderToggle(
          'Palabras más cortas',
          showShorter,
          onShowShorterChange,
          <ChevronDown size={16} className="text-orange-500" />,
          !hasActiveSearch || isPatternWithoutRack
        )}

        {/* Equity Sort Toggle - Only show when shorter words are enabled */}
        {showShorter && hasActiveSearch && (
          <>
            <div className="border-t border-gray-100" />
            {renderToggle(
              'Ordenar por equity',
              sortByEquity,
              onSortByEquityChange,
              <TrendingUp size={16} className="text-purple-500" />,
              false
            )}
          </>
        )}

        <div className="border-t border-gray-100" />

        {/* Extended View Toggle */}
        {renderToggle(
          'Vista extendida',
          showExtendedView,
          onExtendedViewChange,
          <Info size={16} className="text-blue-500" />,
          !hasActiveSearch
        )}

        <div className="border-t border-gray-100" />

        {/* Hooks View Toggle */}
        {renderToggle(
          'Vista de ganchos',
          showHooksView,
          onHooksViewChange,
          <Anchor size={16} className="text-green-500" />,
          !hasActiveSearch
        )}

        {/* Copy Button */}
        {hasActiveSearch && onCopyAll && (
          <>
            <div className="border-t border-gray-100" />
            <div className="py-3 px-4">
              <button
                onClick={() => {
                  onCopyAll();
                  setIsOpen(false);
                }}
                className="w-full flex items-center space-x-3 text-left hover:bg-gray-50 rounded-lg p-2 transition-colors"
              >
                <Copy size={16} className="text-purple-500" />
                <span className="text-sm font-medium text-gray-700">Copiar resultados</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderModuleContent = () => {
    switch (activeModule) {
      case 'anagram':
        return renderAnagramSettings();
      
      case 'judge':
        return (
          <div className="py-8 text-center">
            <Settings size={24} className="text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              No hay opciones de configuración disponibles para el módulo de validación
            </p>
          </div>
        );
      
      case 'lists':
        return (
          <div className="py-8 text-center">
            <Settings size={24} className="text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              No hay opciones de configuración disponibles para el módulo de listas
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

  const renderStatusSection = () => {
    if (activeModule !== 'anagram' || !anagramSettings?.hasActiveSearch) {
      return null;
    }

    const { showHooksView, showExtendedView, showShorter } = anagramSettings;

    return (
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Vista actual:</h3>
        <p className="text-xs text-blue-600">
          {showHooksView
            ? '🎣 Vista de ganchos activa'
            : showExtendedView
            ? '📖 Vista extendida activa'
            : '📝 Vista normal activa'}
        </p>
        {showShorter && (
          <p className="text-xs text-orange-600 mt-1">
            📏 Incluyendo palabras más cortas
          </p>
        )}
      </div>
    );
  };

  const getModuleTitle = () => {
    switch (activeModule) {
      case 'judge': return 'Configuración - Juez';
      case 'anagram': return 'Configuración - Anagramas';
      case 'lists': return 'Configuración - Listas';
      default: return 'Configuración';
    }
  };

  return (
    <>
      {/* Hamburger Button - Always present, aligned with tabs */}
      <div className="fixed top-0 right-4 h-16 flex items-center z-50">
        <button
          onClick={toggleMenu}
          className="p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
          aria-label="Abrir menú de configuración"
        >
          {isOpen ? (
            <X size={20} className="text-gray-600" />
          ) : (
            <Menu size={20} className="text-gray-600" />
          )}
        </button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleMenu}
        />
      )}

      {/* Side Menu */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">{getModuleTitle()}</h2>
            <button
              onClick={toggleMenu}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Module-specific content */}
          {renderModuleContent()}

          {/* Info Section for anagram module when no active search */}
          {activeModule === 'anagram' && !anagramSettings?.hasActiveSearch && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 text-center">
                Realiza una búsqueda para activar las opciones de visualización
              </p>
            </div>
          )}

          {/* Current Status */}
          {renderStatusSection()}
        </div>
      </div>
    </>
  );
};

export default GlobalSettingsMenu;