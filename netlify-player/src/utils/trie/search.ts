
import { TrieNode } from "./types";
import { processDigraphs } from "../digraphs";
import { validateWordPattern } from "../pattern/validation";

export const search = (node: TrieNode, word: string): boolean => {
  // Process digraphs before searching
  const processedWord = processDigraphs(word.toUpperCase());
  console.log('Searching for processed word:', processedWord);
  
  let current = node;
  for (const char of processedWord) {
    if (!current.children.has(char)) {
      console.log('Character not found in trie:', char);
      return false;
    }
    current = current.children.get(char)!;
  }
  
  const found = current.isEndOfWord;
  console.log('Word found in trie?', found);
  return found;
};

/**
 * Searches the trie for words matching a pattern and optional rack letters
 */
export const searchTrie = async (trie: TrieNode, pattern: RegExp, rackLetters: string = ''): Promise<string[]> => {
  const matches: string[] = [];
  const hasRackLetters = rackLetters && rackLetters.trim().length > 0;
  const patternStr = pattern.toString().slice(1, -1).replace(/^\^|\$$/g, '');
  
  console.log('Searching trie with:', { pattern: patternStr, rackLetters, hasRackLetters });
  
  // This function recursively searches the trie and collects matching words
  const searchNode = (node: TrieNode, currentWord: string) => {
    // If this node is the end of a word, check if it matches the pattern
    if (node.isEndOfWord) {
      // The match must be tested against the processed word
      // Note: Since the pattern is already processed for digraphs,
      // we're correctly comparing processed to processed
      if (pattern.test(currentWord)) {
        // If we have rack letters, validate them against the pattern and word
        if (hasRackLetters) {
          // For patterns with rack letters, validate that we can build the word
          // using the available rack letters
          const isValidWithRack = validateWordPattern(currentWord, patternStr, rackLetters);
          if (isValidWithRack) {
            matches.push(node.word);
          }
        } else {
          matches.push(node.word);
        }
      }
    }
    
    // Continue searching through all children of this node
    node.children.forEach((childNode, char) => {
      searchNode(childNode, currentWord + char);
    });
  };
  
  searchNode(trie, '');
  return matches;
};

/**
 * Generates all possible letter combinations from rack letters
 * Used to highlight wildcard/blank tiles in the results
 */
export const generateRackCombinations = (
  pattern: string, 
  rackLetters: string
): { pattern: string, usedRackLetters: Map<string, string> }[] => {
  const combinations: { pattern: string, usedRackLetters: Map<string, string> }[] = [];
  const processedRack = processDigraphs(rackLetters.toUpperCase());
  
  // Count available letters and wildcards
  const availableLetters = new Map<string, number>();
  let wildcards = 0;
  
  for (const char of processedRack) {
    if (char === '*') {
      wildcards++;
    } else {
      availableLetters.set(char, (availableLetters.get(char) || 0) + 1);
    }
  }
  
  // Find all '.' characters in the pattern that need to be filled
  const questionMarkCount = (pattern.match(/\./g) || []).length;
  if (questionMarkCount === 0) {
    // If no single-char wildcards, return the original pattern
    return [{ pattern, usedRackLetters: new Map() }];
  }
  
  // Generate all possible combinations to fill the question marks
  const fillQuestionMarks = (
    currentPattern: string,
    remainingWildcards: number,
    remainingLetters: Map<string, number>,
    usedRackLetters: Map<string, string>,
    position: number = 0
  ) => {
    // Base case: all question marks have been replaced
    if (position >= currentPattern.length) {
      combinations.push({ 
        pattern: currentPattern,
        usedRackLetters: new Map(usedRackLetters) 
      });
      return;
    }
    
    // If current character is not a single-char wildcard, move to next position
    if (currentPattern[position] !== '.') {
      fillQuestionMarks(
        currentPattern, 
        remainingWildcards, 
        remainingLetters,
        usedRackLetters,
        position + 1
      );
      return;
    }
    
    // Try each available letter
    remainingLetters.forEach((count, letter) => {
      if (count > 0) {
        // Use this letter
        const newLetters = new Map(remainingLetters);
        newLetters.set(letter, count - 1);
        
        // Track which rack letter was used
        const newUsedRackLetters = new Map(usedRackLetters);
        newUsedRackLetters.set(position.toString(), letter);
        
        // Replace the dot with this letter
        const newPattern = 
          currentPattern.substring(0, position) + 
          letter + 
          currentPattern.substring(position + 1);
        
        fillQuestionMarks(
          newPattern, 
          remainingWildcards, 
          newLetters, 
          newUsedRackLetters,
          position + 1
        );
      }
    });
    
    // Try using a wildcard if available
    if (remainingWildcards > 0) {
      // For wildcards, we need to try each possible letter in the alphabet
      const alphabet = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
      for (const letter of alphabet) {
        // Track which position used a wildcard
        const newUsedRackLetters = new Map(usedRackLetters);
        newUsedRackLetters.set(position.toString(), '*' + letter); // Mark as wildcard + the letter used
        
        // Replace the dot with this letter
        const newPattern = 
          currentPattern.substring(0, position) + 
          letter + 
          currentPattern.substring(position + 1);
        
        fillQuestionMarks(
          newPattern, 
          remainingWildcards - 1, 
          new Map(remainingLetters), 
          newUsedRackLetters,
          position + 1
        );
      }
    }
  };
  
  fillQuestionMarks(pattern, wildcards, availableLetters, new Map());
  return combinations;
};
