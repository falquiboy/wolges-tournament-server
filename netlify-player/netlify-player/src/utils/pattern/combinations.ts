
import { processDigraphs } from "../digraphs";
import { SPANISH_LETTERS } from '@/hooks/anagramSearch/constants';

export const generatePatternCombinations = (
  pattern: string,
  rackLetters: string,
  isStartPattern: boolean = false,
  isEndPattern: boolean = false,
  isContainsPattern: boolean = false
): string[] => {
  // If pattern is empty, return an empty array
  if (!pattern.trim()) {
    return [];
  }

  const processedPattern = processDigraphs(pattern);
  const processedRack = processDigraphs(rackLetters);

  // Handle the contains pattern case
  if (isContainsPattern) {
    return generateContainsPatternCombinations(processedPattern, processedRack);
  }

  // For patterns with start/end modifiers
  if (isStartPattern || isEndPattern) {
    return generateModifiedPatternCombinations(
      processedPattern, 
      processedRack, 
      isStartPattern, 
      isEndPattern
    );
  }

  // For exact patterns without modifiers
  return [processedPattern];
};

// Helper function for contains pattern (e.g., -R-)
const generateContainsPatternCombinations = (
  pattern: string,
  rackLetters: string
): string[] => {
  // For contains pattern, we'll need to check during trie search
  // but return the basic pattern here
  return [pattern];
};

// Helper function for start/end patterns (e.g., R-, -R)
const generateModifiedPatternCombinations = (
  pattern: string,
  rackLetters: string,
  isStartPattern: boolean,
  isEndPattern: boolean
): string[] => {
  // Process wildcard characters in the rack
  const availableLetters = new Map<string, number>();
  let wildcardCount = 0;
  
  for (const char of rackLetters) {
    if (char === '*') {
      wildcardCount++;
    } else {
      availableLetters.set(char, (availableLetters.get(char) || 0) + 1);
    }
  }

  // For simple cases with no rack letters or wildcards
  if (rackLetters.length === 0) {
    if (isStartPattern && !isEndPattern) {
      return [pattern + '.*']; // Starts with pattern
    } else if (!isStartPattern && isEndPattern) {
      return ['.*' + pattern]; // Ends with pattern
    }
  }

  // When we have a start pattern with rack letters
  if (isStartPattern && !isEndPattern) {
    // Return the base pattern - extensions will be handled in matching.ts
    return [pattern];
  }

  // When we have an end pattern with rack letters
  if (!isStartPattern && isEndPattern) {
    // Return the base pattern - prefixes will be handled in matching.ts
    return [pattern];
  }

  // Both start and end pattern (should be rare)
  return [pattern];
};
