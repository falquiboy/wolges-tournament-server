
import { processDigraphs } from '@/utils/digraphs';
import { convertPatternToRegex } from './conversion';

/**
 * Validates if a word matches a pattern and can be built using the available rack letters
 */
export const validateWordPattern = (
  word: string,
  pattern: string,
  rackLetters?: string
): boolean => {
  // First process the word with digraphs
  const processedWord = processDigraphs(word);
  
  // For the pattern, we need to handle special characters differently
  // We'll split the pattern into parts that should and shouldn't be processed
  const parts = pattern.split(/([?^$\-])/);
  const processedParts = parts.map(part => {
    // Don't process special characters
    if (part === '?' || part === '^' || part === '$' || part === '-') return part;
    // Process other parts for digraphs
    return processDigraphs(part);
  });
  const processedPattern = processedParts.join('');

  // Quick regex check using the processed pattern
  const regex = convertPatternToRegex(processedPattern);
  
  if (!regex.test(processedWord)) {
    return false;
  }

  // If no rack letters provided, pattern match is sufficient
  if (!rackLetters || rackLetters.trim() === '') {
    return true;
  }

  // For pattern search with rack letters, we need to verify that:
  // 1. Fixed characters in the pattern are preserved
  // 2. Variable parts (.) can be filled with rack letters
  // 3. Multi-character parts (*) expand to zero or more letters

  // Extract the fixed parts of the pattern (remove single-char wildcards)
  let patternFixed = processedPattern.replace(/\./g, '');
  
  // For start/end patterns, we need to extract the actual fixed text
  if (patternFixed.startsWith('^')) patternFixed = patternFixed.slice(1);
  if (patternFixed.endsWith('$')) patternFixed = patternFixed.slice(0, -1);
  if (patternFixed.includes('.*')) patternFixed = patternFixed.replace(/\.\*/g, '');
  
  const fixedChars = patternFixed.split('');
  
  // Create a "remaining word" by removing fixed pattern characters
  let remainingWord = [...processedWord];
  
  // Count letters in rack
  const rackLetterCount = new Map<string, number>();
  const processedRack = processDigraphs(rackLetters);
  let wildcardCount = 0;
  
  // Count rack letters and wildcards
  for (const char of processedRack) {
    if (char === '*') {
      wildcardCount++;
    } else {
      rackLetterCount.set(char, (rackLetterCount.get(char) || 0) + 1);
    }
  }
  
  // First, let's handle fixed pattern characters
  // Verify all fixed pattern characters exist in the word
  for (const fixedChar of fixedChars) {
    const fixedCharIndex = remainingWord.findIndex(c => c === fixedChar);
    if (fixedCharIndex === -1) {
      return false; // Fixed character not found in word
    }
    
    // Remove the fixed character from remainingWord
    remainingWord.splice(fixedCharIndex, 1);
  }
  
  // Now, remainingWord contains only the characters that need to be formed from rack
  // Check if we can form these characters using our rack
  for (const char of remainingWord) {
    const availableCount = rackLetterCount.get(char) || 0;
    
    if (availableCount > 0) {
      // Use the letter from rack
      rackLetterCount.set(char, availableCount - 1);
    } else if (wildcardCount > 0) {
      // Use a wildcard for this letter
      wildcardCount--;
    } else {
      // Can't form this letter
      return false;
    }
  }
  
  return true;
};
