/**
 * Utilidades para ordenar palabras con letra adicional según la letra añadida
 */

import { processDigraphs } from './digraphs';

/**
 * Determina qué letra fue añadida a una palabra base para formar una palabra más larga
 */
export function findAddedLetter(baseWord: string, longerWord: string): string {
  // Normalizar ambas palabras
  const baseNormalized = processDigraphs(baseWord.toUpperCase());
  const longerNormalized = processDigraphs(longerWord.toUpperCase());
  
  // Contar letras en ambas palabras
  const baseCount = new Map<string, number>();
  const longerCount = new Map<string, number>();
  
  // Contar letras en palabra base
  for (const letter of baseNormalized) {
    baseCount.set(letter, (baseCount.get(letter) || 0) + 1);
  }
  
  // Contar letras en palabra más larga
  for (const letter of longerNormalized) {
    longerCount.set(letter, (longerCount.get(letter) || 0) + 1);
  }
  
  // Encontrar la letra que se agregó
  for (const [letter, count] of longerCount) {
    const baseLetterCount = baseCount.get(letter) || 0;
    if (count > baseLetterCount) {
      return letter; // Esta es la letra adicional
    }
  }
  
  // Si no se encontró diferencia, devolver la primera letra (fallback)
  return longerNormalized[0] || 'A';
}

/**
 * Agrupa palabras por la letra adicional que contienen
 */
export function groupWordsByAddedLetter(
  baseWord: string, 
  wordsWithAdditionalLetter: string[]
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  
  for (const word of wordsWithAdditionalLetter) {
    const addedLetter = findAddedLetter(baseWord, word);
    
    if (!groups.has(addedLetter)) {
      groups.set(addedLetter, []);
    }
    groups.get(addedLetter)!.push(word);
  }
  
  return groups;
}

/**
 * Ordena palabras con letra adicional según la letra añadida alfabéticamente
 */
export function sortWordsByAddedLetter(
  baseWord: string, 
  wordsWithAdditionalLetter: string[]
): string[] {
  // Agrupar por letra adicional
  const groups = groupWordsByAddedLetter(baseWord, wordsWithAdditionalLetter);
  
  // Obtener letras ordenadas alfabéticamente usando el orden español
  const sortedLetters = Array.from(groups.keys()).sort((a, b) => {
    // Use the same custom alphabet as digraphs for consistency
    const CUSTOM_ALPHABET = "AEIOUBCÇDFGHJLKMNÑPQRWSTVXYZ";
    const posA = CUSTOM_ALPHABET.indexOf(a);
    const posB = CUSTOM_ALPHABET.indexOf(b);
    
    // If letter not found in alphabet, put it at the end
    if (posA === -1) return 1;
    if (posB === -1) return -1;
    
    return posA - posB;
  });
  
  // Construir array final ordenado
  const result: string[] = [];
  
  for (const letter of sortedLetters) {
    const wordsForLetter = groups.get(letter) || [];
    // Ordenar palabras dentro del grupo alfabéticamente
    wordsForLetter.sort((a, b) => a.localeCompare(b));
    result.push(...wordsForLetter);
  }
  
  return result;
}

/**
 * Crea una estructura de datos que incluye información sobre la letra añadida
 */
export interface WordWithAddedLetter {
  word: string;
  addedLetter: string;
}

export function analyzeWordsWithAddedLetter(
  baseWord: string,
  wordsWithAdditionalLetter: string[]
): WordWithAddedLetter[] {
  return wordsWithAdditionalLetter.map(word => ({
    word,
    addedLetter: findAddedLetter(baseWord, word)
  }));
}