import { processDigraphs } from "./digraphs";

/**
 * Identifica qué letras de una palabra vienen del comodín (basado en wildcardHighlighting.tsx)
 * @param word - La palabra formada
 * @param searchTerm - El término de búsqueda con comodín (ej: "HSERON?")
 * @returns Array con las posiciones de letras que vienen del comodín
 */
export function identifyWildcardLetters(word: string, searchTerm: string): number[] {
  if (!word || !searchTerm || !searchTerm.includes('?')) return [];

  // Trabajar con versiones procesadas para alphagram matching
  const cleanSearchTerm = searchTerm.replace(/\/\d+$/, '').replace(/\?/g, '');
  const processedWord = processDigraphs(word);
  const processedSearch = processDigraphs(cleanSearchTerm);
  
  // Create a map to track letter usage from the search term (sin comodines)
  const letterUsage = new Map<string, number>();
  for (const char of processedSearch) {
    letterUsage.set(char, (letterUsage.get(char) || 0) + 1);
  }
  
  // Track which characters have been matched
  const matchedIndices = new Set<number>();
  
  // First pass: mark exact matches
  for (let i = 0; i < processedWord.length; i++) {
    const char = processedWord[i];
    if (letterUsage.has(char) && letterUsage.get(char)! > 0) {
      matchedIndices.add(i);
      letterUsage.set(char, letterUsage.get(char)! - 1);
    }
  }
  
  // Return indices of unmatched letters (these come from wildcards)
  const wildcardIndices: number[] = [];
  for (let i = 0; i < processedWord.length; i++) {
    if (!matchedIndices.has(i)) {
      wildcardIndices.push(i);
    }
  }
  
  return wildcardIndices;
}