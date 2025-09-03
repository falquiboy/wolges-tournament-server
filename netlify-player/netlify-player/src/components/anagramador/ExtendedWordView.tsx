import React from 'react';
import { AnagramWordInfo } from '@/utils/anagramWordData';
import VerbWordView from './VerbWordView';

interface ExtendedWordViewProps {
  word: string;
  wordInfo?: AnagramWordInfo;
  isLoading?: boolean;
  highlightedWord?: React.ReactNode;
}

const ExtendedWordView: React.FC<ExtendedWordViewProps> = ({
  word,
  wordInfo,
  isLoading,
  highlightedWord
}) => {
  const handleRAEClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://dle.rae.es/${word.toLowerCase()}`, '_blank');
  };

  const getWordTypeColor = (type?: string) => {
    switch (type) {
      case 'femenino': return 'text-pink-600 bg-pink-50';
      case 'plural': return 'text-purple-600 bg-purple-50';
      case 'conjugación': return 'text-blue-600 bg-blue-50';
      case 'variante': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatLemmaWithSuperscript = (lemma: string) => {
    // Check for digit before comma (homonym digit pattern)
    const commaMatch = lemma.match(/^(.+?)(\d+)(,.*)$/);
    if (commaMatch) {
      const [, base, digit, afterComma] = commaMatch;
      return (
        <>
          {base}
          <sup>{digit}</sup>
          {afterComma}
        </>
      );
    }
    
    // Check if lemma ends with a digit for homonymy
    const match = lemma.match(/^(.+?)(\d+)$/);
    if (match) {
      const [, base, digit] = match;
      return (
        <>
          {base}
          <sup>{digit}</sup>
        </>
      );
    }
    return lemma;
  };

  const getWordTypeLabel = (type?: string, lemma?: string, partOfSpeech?: string) => {
    if (!type) return null;
    
    // Abbreviated part of speech
    const getPartOfSpeechAbbr = (pos?: string) => {
      if (!pos) return '';
      // Handle specific database abbreviations
      if (pos === 's.') return 'sust.';
      if (pos === 'v.') return 'verbo';
      if (pos === 'adj.') return 'adj.';
      if (pos === 'adv.') return 'adv.';
      
      // Handle full words as fallback
      const lower = pos.toLowerCase();
      if (lower.includes('sustantivo')) return 'sust.';
      if (lower.includes('verbo')) return 'verbo';
      if (lower.includes('adjetivo')) return 'adj.';
      if (lower.includes('adverbio')) return 'adv.';
      
      return pos; // fallback to original if no match
    };
    
    const posAbbr = getPartOfSpeechAbbr(partOfSpeech);
    const posText = posAbbr ? `, ${posAbbr}` : '';
    
    switch (type) {
      case 'femenino': 
        return lemma && lemma !== word.toLowerCase() ? (
          <>femenino de <strong>"{formatLemmaWithSuperscript(lemma)}"</strong>{posText}</>
        ) : `femenino${posText}`;
      case 'plural': 
        return lemma && lemma !== word.toLowerCase() ? (
          <>plural de <strong>"{formatLemmaWithSuperscript(lemma)}"</strong>{posText}</>
        ) : `plural${posText}`;
      case 'conjugación': 
        return lemma && lemma !== word.toLowerCase() ? (
          <>conjug. de <strong>"{formatLemmaWithSuperscript(lemma)}"</strong>{posText}</>
        ) : `conjug.${posText}`;
      case 'variante': 
        return lemma && lemma !== word.toLowerCase() ? (
          <>variante de <strong>"{formatLemmaWithSuperscript(lemma)}"</strong>{posText}</>
        ) : `variante${posText}`;
      case 'base': 
        return lemma ? (
          <>lema: <strong>"{formatLemmaWithSuperscript(lemma)}"</strong>{posText}</>
        ) : `lema${posText}`;
      default: return null;
    }
  };

  const getTypeColor = (type?: string, partOfSpeech?: string) => {
    // Color by grammatical category first, then by word type
    if (partOfSpeech === 'sust.' || partOfSpeech?.toLowerCase().includes('sustantivo')) {
      return 'text-blue-600';
    }
    if (partOfSpeech === 'verbo' || partOfSpeech?.toLowerCase().includes('verbo')) {
      return 'text-green-600';
    }
    if (partOfSpeech === 'adj.' || partOfSpeech?.toLowerCase().includes('adjetivo')) {
      return 'text-purple-600';
    }
    if (partOfSpeech === 'adv.' || partOfSpeech?.toLowerCase().includes('adverbio')) {
      return 'text-orange-600';
    }
    
    // Fallback to word type colors
    switch (type) {
      case 'conjugación': return 'text-green-600';
      case 'plural': return 'text-blue-600';
      case 'femenino': return 'text-pink-600';
      case 'variante': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border rounded-lg p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">{highlightedWord || word}</span>
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        <div className="text-xs text-gray-500">Cargando información...</div>
      </div>
    );
  }

  // If this is a verb, use the specialized VerbWordView
  if (wordInfo?.isVerb && wordInfo.verbInfo) {
    return (
      <VerbWordView
        word={word}
        wordInfo={wordInfo}
        highlightedWord={highlightedWord}
      />
    );
  }

  return (
    <div className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Clickable word */}
      <div className="mb-2">
        <span 
          onClick={handleRAEClick}
          className="font-medium text-lg cursor-pointer hover:text-blue-600 transition-colors"
        >
          {highlightedWord || word}
          {wordInfo?.wordType && (
            <span className="text-sm font-normal ml-1 text-blue-600">
              ({getWordTypeLabel(wordInfo.wordType, wordInfo.lemma, wordInfo.partOfSpeech)})
            </span>
          )}
        </span>
      </div>

      {/* Word information */}
      {wordInfo ? (
        <div className="space-y-1 text-sm">

          {/* Short definition */}
          {wordInfo.shortDefinition && (
            <div className="text-xs text-gray-600 italic mt-2 leading-relaxed">
              "{wordInfo.shortDefinition}"
            </div>
          )}

          {/* No info available */}
          {!wordInfo.lemma && !wordInfo.partOfSpeech && !wordInfo.shortDefinition && wordInfo.isScrabbleValid && (
            <div className="text-xs text-gray-500 italic">
              Información no disponible en diccionario local
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ExtendedWordView;