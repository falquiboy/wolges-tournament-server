import React, { useState } from 'react';
import { Loader, ChevronDown, ChevronRight } from "lucide-react";
import { toDisplayFormat, processDigraphs } from "@/utils/digraphs";
import { HookInfo, processHooks } from '@/utils/hooksData';
import { highlightWildcardLetter } from "@/utils/wildcardHighlighting";

interface HooksViewProps {
  isLoading: boolean;
  searchTerm: string;
  results: {
    exactMatches: string[];
    wildcardMatches: string[];
    additionalWildcardMatches: string[];
    shorterMatches: string[];
    patternMatches: string[];
  };
  highlightWildcardLetter: (word: string, originalWord: string) => React.ReactNode;
  showShorter: boolean;
  hooksData: Map<string, HookInfo>;
  isLoadingHooks: boolean;
}

const HooksView: React.FC<HooksViewProps> = ({
  isLoading,
  searchTerm,
  results,
  highlightWildcardLetter,
  showShorter,
  hooksData,
  isLoadingHooks
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['exact', 'wildcard', 'pattern', 'additional', 'shorter']));
  const [expandedLengthGroups, setExpandedLengthGroups] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const toggleLengthGroup = (groupId: string) => {
    setExpandedLengthGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="animate-spin mr-2" size={20} />
        <span className="text-gray-600">Buscando anagramas...</span>
      </div>
    );
  }

  const renderHookLetter = (letter: string, isLeft: boolean) => {
    return (
      <span
        key={letter}
        className={`inline-flex items-center justify-center w-5 h-5 text-xs bg-blue-100 text-blue-700 border border-blue-200 rounded mx-0.5 ${
          isLeft ? 'mr-1' : 'ml-1'
        }`}
      >
        {letter.toLowerCase()}
      </span>
    );
  };

  const renderWordWithHooks = (word: string, originalWord: string, isAdditionalSection: boolean = false) => {
    const displayWord = toDisplayFormat(word);
    const hookInfoKey = displayWord.toUpperCase();
    const hookInfo = hooksData.get(hookInfoKey);
    
    // Check if this word is longer than the search term (has additional letters)
    const cleanSearchTerm = searchTerm.replace(/\/\d+$/, '');
    const processedWordLength = processDigraphs(displayWord).length;
    const processedSearchLength = processDigraphs(cleanSearchTerm.replace(/\*/g, '').replace(/\?/g, '')).length;
    const wildcardCount = (cleanSearchTerm.match(/\?/g) || []).length;
    const totalRackLength = processedSearchLength + wildcardCount;
    const hasAdditionalLetters = processedWordLength > totalRackLength;
    
    // Always use the global highlighting function, then add hook coloring if needed
    const baseHighlighted = highlightWildcardLetter(word, searchTerm);
    const hooks = hookInfo ? processHooks(hookInfo) : null;
    
    // Function to enhance colors for internal hooks
    const enhanceWithHookColors = (element: React.ReactElement): React.ReactElement => {
      if (!element.props.children || !hooks) return element;
      
      const children = React.Children.toArray(element.props.children);
      const enhancedChildren = children.map((child, index) => {
        if (React.isValidElement(child)) {
          const isFirst = index === 0;
          const isLast = index === children.length - 1;
          const isInternalHook = (isFirst && hooks.hasLeftInternal) || (isLast && hooks.hasRightInternal);
          
          if (isInternalHook) {
            const currentClass = child.props.className || '';
            let newClass = currentClass;
            
            // Check if this is an overlapping case (additional letter + internal hook)
            if (currentClass.includes('text-red-600')) {
              // Additional letter + internal hook = more transparent red
              newClass = currentClass.replace('text-red-600', 'text-red-300');
            } else if (currentClass.includes('text-blue-600')) {
              // Wildcard + internal hook = keep blue (no change needed)
              newClass = currentClass;
            } else {
              // Only internal hook = gray
              newClass = currentClass + ' text-gray-400';
            }
            
            return React.cloneElement(child, { className: newClass });
          }
        }
        return child;
      });
      
      return React.cloneElement(element, {}, ...enhancedChildren);
    };
    
    // Apply hook enhancements if needed
    const highlighted = (hookInfo && (hooks?.hasLeftInternal || hooks?.hasRightInternal)) 
      ? enhanceWithHookColors(baseHighlighted as React.ReactElement)
      : baseHighlighted;

    const handleRAEClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      window.open(`https://dle.rae.es/${displayWord.toLowerCase()}`, '_blank');
    };

    if (!hookInfo || (!hookInfo.hasExternalHooks && !hookInfo.hasInternalHooks)) {
      // No hooks available - use normal color, not gray
      return (
        <div className="grid grid-cols-3 items-center py-1.5 px-3">
          <div></div>
          <div className="text-center">
            <span 
              className="text-lg cursor-pointer hover:text-blue-600 transition-colors"
              onClick={handleRAEClick}
            >
              {highlighted}
            </span>
          </div>
          <div></div>
        </div>
      );
    }


    return (
      <div className="grid grid-cols-3 items-center py-1.5 px-3 hover:bg-gray-50 transition-colors">
        {/* Left side: External hooks */}
        <div className="flex items-center justify-end">
          <div className="flex flex-wrap items-center justify-end mr-0.5">
            {hooks.leftExternal.map(letter => renderHookLetter(letter, true))}
          </div>
        </div>

        {/* Center: The word itself with integrated internal indicators */}
        <div className="text-center">
          <span 
            className="font-semibold text-lg cursor-pointer hover:text-blue-600 transition-colors inline-flex items-center"
            onClick={handleRAEClick}
          >
            {highlighted}
          </span>
        </div>

        {/* Right side: External hooks */}
        <div className="flex items-center justify-start">
          <div className="flex flex-wrap items-center justify-start ml-0.5">
            {hooks.rightExternal.map(letter => renderHookLetter(letter, false))}
          </div>
        </div>
      </div>
    );
  };

  const renderWordSection = (sectionId: string, title: string, words: string[], color: string = 'blue', groupByLength: boolean = false, isAdditionalSection: boolean = false) => {
    if (words.length === 0) return null;

    const isExpanded = expandedSections.has(sectionId);

    if (groupByLength) {
      // Agrupar por longitud y ordenar
      const groupedWords = words.reduce((groups, word) => {
        const length = word.length;
        if (!groups[length]) {
          groups[length] = [];
        }
        groups[length].push(word);
        return groups;
      }, {} as Record<number, string[]>);

      // Ordenar cada grupo alfabéticamente
      Object.keys(groupedWords).forEach(length => {
        groupedWords[parseInt(length)].sort();
      });

      // Obtener longitudes ordenadas (mayor a menor para subanagramas)
      const sortedLengths = Object.keys(groupedWords)
        .map(Number)
        .sort((a, b) => b - a);

      return (
        <div className="space-y-4">
          <button
            onClick={() => toggleSection(sectionId)}
            className={`flex items-center gap-2 font-semibold text-${color}-600 text-sm hover:text-${color}-700 transition-colors`}
          >
            {isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
            {title} ({words.length})
          </button>
          
          {isExpanded && (
            <div>
              {sortedLengths.map(length => {
                const lengthGroupId = `${sectionId}-${length}`;
                const isLengthExpanded = expandedLengthGroups.has(lengthGroupId);
                
                return (
                  <div key={length} className="space-y-2 mb-4">
                    <button
                      onClick={() => toggleLengthGroup(lengthGroupId)}
                      className={`flex items-center justify-center gap-2 w-full text-xs font-medium text-${color}-500 uppercase tracking-wide hover:text-${color}-600 transition-colors`}
                    >
                      {isLengthExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                      {length} letras ({groupedWords[length].length})
                    </button>
                    
                    {isLengthExpanded && (
                      <div className="space-y-1">
                        {groupedWords[length].map((word, index) => (
                          <div key={index}>
                            {renderWordWithHooks(word, searchTerm, isAdditionalSection)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <button
          onClick={() => toggleSection(sectionId)}
          className={`flex items-center gap-2 font-semibold text-${color}-600 text-sm hover:text-${color}-700 transition-colors`}
        >
          {isExpanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
          {title} ({words.length})
        </button>
        
        {isExpanded && (
          <div>
            {words.map((word, index) => (
              <div key={index}>
                {renderWordWithHooks(word, searchTerm, isAdditionalSection)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const hasAnyResults = results.exactMatches.length > 0 ||
                        results.wildcardMatches.length > 0 ||
                        results.additionalWildcardMatches.length > 0 ||
                        results.shorterMatches.length > 0 ||
                        results.patternMatches.length > 0;

  if (!hasAnyResults) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No se encontraron resultados</p>
      </div>
    );
  }

  const isPatternSearch = searchTerm.includes('*') || searchTerm.includes('.') || searchTerm.includes('-');

  return (
    <div className="space-y-6">
      {/* Header with copy button and legend */}
      <div className="space-y-3">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Vista de Ganchos</span> - Letras para extender palabras
        </div>

      </div>

      {/* Pattern results (for pattern searches) */}
      {isPatternSearch && renderWordSection(
        "pattern",
        "Coincidencias de patrón", 
        results.patternMatches, 
        "purple"
      )}

      {/* Exact matches */}
      {!isPatternSearch && renderWordSection(
        "exact",
        "Anagramas exactos", 
        results.exactMatches, 
        "green"
      )}

      {/* Wildcard matches */}
      {!isPatternSearch && renderWordSection(
        "wildcard",
        "Con comodines", 
        results.wildcardMatches, 
        "blue"
      )}

      {/* Additional wildcard matches */}
      {!isPatternSearch && renderWordSection(
        "additional",
        "Comodines adicionales", 
        results.additionalWildcardMatches, 
        "indigo",
        false,
        true
      )}

      {/* Shorter matches - SIEMPRE agrupados por longitud */}
      {!isPatternSearch && showShorter && renderWordSection(
        "shorter",
        "Subanagramas", 
        results.shorterMatches, 
        "orange",
        true // Activar agrupamiento por longitud
      )}

      {/* Loading indicator for hooks data */}
      {isLoadingHooks && (
        <div className="flex items-center justify-center py-4 text-sm text-gray-500">
          <Loader className="animate-spin mr-2" size={16} />
          Cargando información de ganchos...
        </div>
      )}
    </div>
  );
};

export default HooksView;