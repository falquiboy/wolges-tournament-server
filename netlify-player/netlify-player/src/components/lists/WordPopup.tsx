import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface WordData {
  word: string;
  isValid: boolean;
  etymology?: string;
  etymologyLanguage?: string;
  definitions?: Array<{
    definition: string;
    partOfSpeech?: string;
    domain?: string;
    usage?: string;
  }>;
  scrabblePoints?: number;
}

interface WordPopupProps {
  wordData: WordData | null;
  isOpen: boolean;
  onClose: () => void;
}

const WordPopup: React.FC<WordPopupProps> = ({ wordData, isOpen, onClose }) => {
  if (!isOpen) return null;

  // Process definition to create a shorter version
  const processDefinition = (definition: string): string => {
    // Remove references like "V. palabra" or "U. t. c. s."
    let processed = definition.replace(/^[VvUu]\.\s*[tc]\.\s*[cs]\.\s*/g, '');
    processed = processed.replace(/^[VvUu]\.\s*/g, '');
    
    // Limit to first sentence or 100 characters
    const sentences = processed.split('.');
    let result = sentences[0];
    
    if (result.length > 100) {
      result = result.substring(0, 100) + '...';
    } else if (sentences.length > 1 && result.length < 80) {
      result += '.';
    }
    
    return result.trim();
  };

  const handleRAEClick = () => {
    window.open(`https://dle.rae.es/${wordData.word.toLowerCase()}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {wordData ? wordData.word : 'Cargando...'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {!wordData ? (
            /* Loading state */
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Cargando información...</span>
            </div>
          ) : (
            <>
              {/* Scrabble validity */}
              <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              wordData.isValid 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {wordData.isValid ? '✓ Válida para Scrabble' : '✗ No válida para Scrabble'}
            </span>
            {wordData.scrabblePoints && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                {wordData.scrabblePoints} pts
              </span>
            )}
          </div>

          {/* Etymology */}
          {wordData.etymology && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-1">Etimología</h3>
              <p className="text-sm text-gray-600">
                {wordData.etymologyLanguage && (
                  <span className="font-medium">{wordData.etymologyLanguage}: </span>
                )}
                {wordData.etymology}
              </p>
            </div>
          )}

          {/* Definitions */}
          {wordData.definitions && wordData.definitions.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Definiciones</h3>
              <div className="space-y-3">
                {wordData.definitions.slice(0, 3).map((def, index) => (
                  <div key={index} className="border-l-3 border-blue-200 pl-3">
                    {def.partOfSpeech && (
                      <div className="text-xs text-blue-600 font-medium mb-1">
                        {def.partOfSpeech}
                        {def.domain && ` • ${def.domain}`}
                        {def.usage && ` • ${def.usage}`}
                      </div>
                    )}
                    <p className="text-sm text-gray-700">
                      {processDefinition(def.definition)}
                    </p>
                  </div>
                ))}
                {wordData.definitions.length > 3 && (
                  <p className="text-xs text-gray-500 italic">
                    Y {wordData.definitions.length - 3} definiciones más...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* No definitions available */}
          {(!wordData.definitions || wordData.definitions.length === 0) && (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">
                No hay definiciones disponibles en la base de datos local
              </p>
            </div>
          )}
          </>
        )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cerrar
          </button>
          {wordData && (
            <button
              onClick={handleRAEClick}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <span>Ver en RAE</span>
              <ExternalLink size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WordPopup;