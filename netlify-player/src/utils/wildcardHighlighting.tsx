import React from 'react';
import { processDigraphs, toDisplayFormat } from './digraphs';
import { translateHyphenPattern } from './pattern/translation';

const findDigraphPositions = (word: string): { start: number, end: number }[] => {
  const positions: { start: number, end: number }[] = [];
  
  // Convert to display format first to handle both internal (Ç) and display (CH) formats consistently
  const displayWord = toDisplayFormat(word);
  const chars = displayWord.split('');
  
  for (let i = 0; i < chars.length - 1; i++) {
    if (
      (chars[i] === 'C' && chars[i + 1] === 'H') ||
      (chars[i] === 'L' && chars[i + 1] === 'L') ||
      (chars[i] === 'R' && chars[i + 1] === 'R')
    ) {
      positions.push({ start: i, end: i + 1 });
      i++; // Skip next character as it's part of the digraph
    }
  }
  
  return positions;
};

export const highlightWildcardLetter = (word: string, searchTerm: string): React.ReactNode => {
  if (!word || !searchTerm) return word;

  // Remove length filter if present
  const cleanSearchTerm = searchTerm.replace(/\/\d+$/, '');
  
  // Convert to display format first to handle both internal and display formats consistently
  const displayWord = toDisplayFormat(word);
  
  // Process both the word and search term to handle digraphs
  const processedWord = processDigraphs(displayWord);
  const processedSearchNoWildcards = processDigraphs(cleanSearchTerm.replace(/\*/g, '').replace(/\?/g, ''));
  
  // Count wildcards
  const wildcardCount = (cleanSearchTerm.match(/\?/g) || []).length;
  
  // Check if this is an additional letter word
  const totalRackLength = processedSearchNoWildcards.length + wildcardCount;
  const isAdditionalLetterWord = processedWord.length > totalRackLength;
  
  // Find digraph positions in the display word
  const digraphPositions = findDigraphPositions(displayWord);
  
  // Create a map to track letter usage from the search term
  const letterUsage = new Map<string, number>();
  for (const char of processedSearchNoWildcards) {
    letterUsage.set(char, (letterUsage.get(char) || 0) + 1);
  }
  
  // Track which characters have been matched and which are wildcards
  const matchedIndices = new Set<number>();
  const wildcardIndices = new Set<number>();
  
  // First pass: mark exact matches
  const availableLetters = new Map(letterUsage);
  for (let i = 0; i < displayWord.length; i++) {
    if (matchedIndices.has(i)) continue;
    
    const digraph = digraphPositions.find(pos => pos.start === i || pos.end === i);
    
    if (digraph && digraph.start === i) {
      const digraphStr = displayWord.slice(digraph.start, digraph.end + 1);
      const processedDigraph = processDigraphs(digraphStr);
      
      if (availableLetters.has(processedDigraph) && availableLetters.get(processedDigraph)! > 0) {
        matchedIndices.add(digraph.start);
        matchedIndices.add(digraph.end);
        availableLetters.set(processedDigraph, availableLetters.get(processedDigraph)! - 1);
      }
    } else if (!digraph) {
      const char = displayWord[i];
      if (availableLetters.has(char) && availableLetters.get(char)! > 0) {
        matchedIndices.add(i);
        availableLetters.set(char, availableLetters.get(char)! - 1);
      }
    }
  }
  
  // Second pass: assign wildcards to remaining unmatched positions
  let remainingWildcards = wildcardCount;
  for (let i = 0; i < displayWord.length && remainingWildcards > 0; i++) {
    if (!matchedIndices.has(i)) {
      const digraph = digraphPositions.find(pos => pos.start === i || pos.end === i);
      
      if (digraph && digraph.start === i) {
        wildcardIndices.add(digraph.start);
        wildcardIndices.add(digraph.end);
        remainingWildcards--;
      } else if (!digraph) {
        wildcardIndices.add(i);
        remainingWildcards--;
      }
    }
  }
  
  // Return the word with highlighted characters
  return (
    <span className="inline-flex">
      {displayWord.split('').map((char, index) => {
        // Find if this position is part of a digraph
        const digraph = digraphPositions.find(pos => pos?.start === index || pos?.end === index);
        
        // Determine character type
        const isMatched = matchedIndices.has(index);
        const isWildcard = wildcardIndices.has(index);
        const isAdditional = !isMatched && !isWildcard;
        
        // Determine color class
        let colorClass = "font-semibold";
        if (isAdditional) {
          colorClass = "text-red-600 font-semibold";
        } else if (isWildcard) {
          colorClass = "text-blue-600 font-semibold";
        }
        
        // Handle digraphs
        if (digraph) {
          if (index === digraph.start) {
            // Only render the digraph at its start position
            return (
              <span key={index} className={colorClass}>
                {char.toUpperCase()}{displayWord[index + 1].toUpperCase()}
              </span>
            );
          } else if (index === digraph.end) {
            // Skip the second character of the digraph
            return null;
          }
        }
        
        // Handle regular characters
        return (
          <span key={index} className={colorClass}>
            {char.toUpperCase()}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Enhanced pattern highlighting for all pattern types
 * Highlights fixed letters in normal color and wildcard/fill letters in blue
 */
export const highlightPatternMatchEnhanced = (word: string, pattern: string, rackLetters: string): React.ReactNode => {
  if (!word || !pattern) return word;
  
  // Remove any length specification
  const cleanPattern = pattern.replace(/:\d+$/, '');
  
  // For patterns with . or *, use original pattern directly
  // For hyphen patterns, use translation
  const workingPattern = cleanPattern.includes('.') || cleanPattern.includes('*') ? 
    cleanPattern : translateHyphenPattern(cleanPattern);
  
  // Find digraph positions in the original word
  const digraphPositions = findDigraphPositions(word);
  const processedIndices = new Set<number>();
  
  // Analyze pattern to identify fixed positions
  const fixedPositions = getFixedLetterPositions(word, workingPattern);
  
  // Debug logging
  console.log(`🔍 Pattern: "${pattern}" → "${workingPattern}"`);
  console.log(`🔍 Word: "${word}"`);
  console.log(`🔍 Fixed positions:`, fixedPositions);
  
  return (
    <span className="inline-flex">
      {word.split('').map((char, index) => {
        // Skip if this index is part of an already processed digraph
        if (processedIndices.has(index)) return null;

        // Find if this position is part of a digraph
        const isDiGraphStart = digraphPositions.some(pos => pos.start === index);
        const digraph = digraphPositions.find(pos => pos.start === index);

        // Get the actual character or digraph to display
        const displayText = isDiGraphStart ? 
          `${char}${word[index + 1]}` : char;

        // If this is a digraph, mark both positions as processed
        if (isDiGraphStart && digraph) {
          processedIndices.add(digraph.end);
        }
        
        // Determine if this position is fixed or fill
        const isFixed = fixedPositions.includes(index) || 
                       (isDiGraphStart && digraph && fixedPositions.includes(digraph.end));
        
        if (isFixed) {
          // Fixed letter - normal color
          return (
            <span key={index} className="font-semibold">
              {displayText.toUpperCase()}
            </span>
          );
        } else {
          // Fill letter - blue color
          return (
            <span key={index} className="text-blue-600 font-semibold">
              {displayText.toUpperCase()}
            </span>
          );
        }
      })}
    </span>
  );
};

/**
 * Analyze pattern and word to determine which positions contain fixed letters
 * Uses pattern matching to find actual positions of fixed letters in the word
 */
const getFixedLetterPositions = (word: string, pattern: string): number[] => {
  const fixedPositions: number[] = [];
  
  // Handle different pattern types
  if (pattern.startsWith('*') && pattern.endsWith('*')) {
    // *PATTERN* - contains pattern anywhere
    const fixedPart = pattern.slice(1, -1);
    const startIndex = word.indexOf(fixedPart);
    if (startIndex >= 0) {
      for (let i = 0; i < fixedPart.length; i++) {
        fixedPositions.push(startIndex + i);
      }
    }
  } else if (pattern.startsWith('*')) {
    // *PATTERN - ends with pattern
    const fixedPart = pattern.slice(1);
    const startIndex = word.length - fixedPart.length;
    if (startIndex >= 0) {
      for (let i = 0; i < fixedPart.length; i++) {
        fixedPositions.push(startIndex + i);
      }
    }
  } else if (pattern.endsWith('*')) {
    // PATTERN* - starts with pattern but may contain dots
    const fixedPart = pattern.slice(0, -1);
    
    if (fixedPart.includes('.')) {
      // Handle patterns like .R.Z* - need to match the pattern structure
      const positions = matchPatternWithDots(word, fixedPart);
      fixedPositions.push(...positions);
    } else {
      // Simple prefix match like CO*
      for (let i = 0; i < fixedPart.length && i < word.length; i++) {
        fixedPositions.push(i);
      }
    }
  } else if (pattern.includes('.')) {
    // Pattern with dots but no *, like .R.Z or R..S
    const positions = matchPatternWithDots(word, pattern);
    fixedPositions.push(...positions);
  } else {
    // For other patterns, try to match fixed letters
    const fixedLetters = pattern.replace(/[*.\-^$]/g, '');
    if (fixedLetters) {
      const startIndex = word.indexOf(fixedLetters);
      if (startIndex >= 0) {
        for (let i = 0; i < fixedLetters.length; i++) {
          fixedPositions.push(startIndex + i);
        }
      }
    }
  }
  
  return fixedPositions;
};

/**
 * Match a pattern containing dots against a word to find fixed letter positions
 * Example: pattern ".R.Z" against word "BREZ" would return [1, 3] for R and Z
 */
const matchPatternWithDots = (word: string, pattern: string): number[] => {
  const fixedPositions: number[] = [];
  
  console.log(`🔍 Matching pattern "${pattern}" against word "${word}"`);
  
  // Simple approach: if pattern and word have same length, map directly
  if (pattern.length === word.length) {
    // Direct position mapping for same-length patterns
    for (let i = 0; i < pattern.length; i++) {
      const patternChar = pattern[i];
      const wordChar = word[i];
      
      if (patternChar !== '.') {
        // This should be a fixed letter
        if (patternChar === wordChar) {
          fixedPositions.push(i);
          console.log(`🔍 Fixed letter '${patternChar}' found at position ${i} in "${word}"`);
        } else {
          console.log(`🔍 Mismatch: expected '${patternChar}' at position ${i}, got '${wordChar}'`);
        }
      } else {
        console.log(`🔍 Wildcard '.' at position ${i} matches '${wordChar}'`);
      }
    }
  } else {
    console.log(`🔍 Length mismatch: pattern "${pattern}" (${pattern.length}) vs word "${word}" (${word.length})`);
    
    // For different lengths, try to find the fixed letters in sequence
    let wordIndex = 0;
    for (let patternIndex = 0; patternIndex < pattern.length && wordIndex < word.length; patternIndex++) {
      const patternChar = pattern[patternIndex];
      
      if (patternChar !== '.') {
        // Look for this fixed letter starting from current word position
        const foundIndex = word.indexOf(patternChar, wordIndex);
        if (foundIndex >= 0 && foundIndex >= wordIndex) {
          fixedPositions.push(foundIndex);
          wordIndex = foundIndex + 1;
          console.log(`🔍 Fixed letter '${patternChar}' found at position ${foundIndex} in "${word}"`);
        }
      } else {
        // Skip one character for the wildcard
        wordIndex++;
      }
    }
  }
  
  console.log(`🔍 Pattern "${pattern}" → Fixed positions:`, fixedPositions);
  return fixedPositions;
};

/**
 * Legacy function for backward compatibility - now uses enhanced version
 * Highlight pattern matches with rack letters
 * For patterns like "-NAS,AOL*", highlight the rack letters used to complete the pattern
 */
export const highlightPatternMatch = (word: string, pattern: string, rackLetters: string): React.ReactNode => {
  // Use the enhanced version for better pattern support
  return highlightPatternMatchEnhanced(word, pattern, rackLetters);
};
