
import { BaseResults } from "./results/BaseResults";
import { useState, useEffect } from "react";
import { highlightPatternMatch } from "@/utils/wildcardHighlighting";
import { translateHyphenPattern } from "@/utils/pattern/translation";
import { processDigraphs } from "@/utils/digraphs";

interface PatternResultsProps {
  matches: string[];
  searchTerm: string;
  showLongerWords?: boolean;
}

export const PatternResults = ({ 
  matches, 
  searchTerm,
  showLongerWords = false
}: PatternResultsProps) => {
  // Remove duplicates using Set
  const uniqueMatches = Array.from(new Set(matches));
  
  // Check if this is a pattern with rack letters
  const hasRackLetters = searchTerm.includes(',');
  
  // Prepare pattern and rack parts for highlighting
  const [patternPart, rackPart] = hasRackLetters ? 
    searchTerm.split(',') : [searchTerm, ''];
  
  // Remove length filter if present in the pattern
  const cleanPatternPart = patternPart.replace(/:\d+$/, '');
  
  // For special patterns like -NAS, we need custom highlighting
  const translatedPattern = translateHyphenPattern(cleanPatternPart);
  
  // Determine pattern types
  const isEndPattern = translatedPattern.endsWith('$');
  const isStartPattern = translatedPattern.startsWith('^');
  const isContainsPattern = translatedPattern.includes('.*') && !isStartPattern && !isEndPattern;
  
  // Check if this is a compound pattern like "-PUCH-R"
  const isCompoundEndPattern = cleanPatternPart.startsWith('-') && 
                              cleanPatternPart.indexOf('-', 1) > 0 && 
                              !cleanPatternPart.endsWith('-');
  
  // Extract the pattern parts for display purposes
  let mainPattern = "";
  let endPattern = "";
  
  if (isCompoundEndPattern) {
    const parts = cleanPatternPart.split('-').filter(Boolean);
    mainPattern = parts.slice(0, -1).join('');
    endPattern = parts[parts.length - 1];
  } else {
    // Extract the actual pattern without hyphens for standard patterns
    let cleanPattern = cleanPatternPart;
    if (isEndPattern && !cleanPatternPart.endsWith('-')) {
      cleanPattern = cleanPatternPart.slice(1);
    }
    if (isStartPattern && !cleanPatternPart.startsWith('-')) {
      cleanPattern = cleanPattern.slice(0, -1);
    }
    if (cleanPatternPart.startsWith('-') && cleanPatternPart.endsWith('-')) {
      cleanPattern = cleanPattern.slice(1, -1);
    }
    mainPattern = cleanPattern;
  }
  
  // Determine title based on the pattern type
  let titleText = "";
  if (isCompoundEndPattern) {
    titleText = `${uniqueMatches.length} ${uniqueMatches.length === 1 ? "palabra encontrada" : "palabras encontradas"} que contienen "${mainPattern}" y terminan con "${endPattern}"`;
  } else if (cleanPatternPart.startsWith('-') && cleanPatternPart.endsWith('-')) {
    titleText = `${uniqueMatches.length} ${uniqueMatches.length === 1 ? "palabra encontrada" : "palabras encontradas"} que contienen "${mainPattern}"`;
  } else if (isStartPattern || cleanPatternPart.endsWith('-')) {
    titleText = `${uniqueMatches.length} ${uniqueMatches.length === 1 ? "palabra encontrada" : "palabras encontradas"} que empiezan con "${mainPattern}"`;
  } else if (isEndPattern || cleanPatternPart.startsWith('-')) {
    titleText = `${uniqueMatches.length} ${uniqueMatches.length === 1 ? "palabra encontrada" : "palabras encontradas"} que terminan con "${mainPattern}"`;
  } else {
    titleText = `${uniqueMatches.length} ${uniqueMatches.length === 1 ? "palabra encontrada" : "palabras encontradas"} que coinciden con el patrón`;
  }
  
  return (
    <BaseResults
      matches={uniqueMatches}
      title={titleText}
      highlightWildcardLetter={hasRackLetters ? 
        (word) => highlightPatternMatch(word, patternPart, rackPart) : 
        (word) => highlightPatternMatch(word, patternPart, "")}
      searchTerm={searchTerm}
      sortAscending={showLongerWords}
    />
  );
};
