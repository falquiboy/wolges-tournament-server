
import { Trie } from "../trie/types";
import { searchTrie } from "../trie/search";
import { convertPatternToRegex } from "./conversion";
import { translateHyphenPattern } from "./translation";
import { processDigraphs } from "../digraphs";
import { generatePatternCombinations } from "./combinations";
import { SPANISH_LETTERS } from '@/hooks/anagramSearch/constants';

// Variable para almacenar los patrones base generados
const basePatches: string[] = [];

export const findPatternMatches = async (
  pattern: string, 
  trie: Trie, 
  showLongerWords: boolean = false,
  maxDefaultLength: number = 8,
  targetLength: number | null = null
): Promise<string[]> => {
  // Limpiar los patrones base de búsquedas anteriores
  basePatches.length = 0;

  const patternParts = pattern.split(':');
  let processedPattern = pattern;
  let specifiedLength = targetLength;
  
  if (patternParts.length > 1) {
    processedPattern = patternParts[0];
    const lengthStr = patternParts[1];
    if (lengthStr && /^\d+$/.test(lengthStr)) {
      specifiedLength = parseInt(lengthStr, 10);
      console.log('Length extracted from pattern with colon:', specifiedLength);
    }
  }
  
  const [patternPart, rackPart] = processedPattern.includes(',') ? 
    processedPattern.split(',') : [processedPattern, ''];
  
  console.log('Processing pattern search:', { patternPart, rackPart, showLongerWords, specifiedLength });
  
  const translatedPattern = translateHyphenPattern(patternPart);
  console.log('Translated pattern:', translatedPattern);
  
  try {
    let matches: string[] = [];
    
    const processedPatternWithDigraphs = processDigraphs(translatedPattern);
    
    if (rackPart && rackPart.trim().length > 0) {
      console.log('Using rack letters for pattern:', rackPart.trim());
      // Identificar si el patrón debe extenderse
      const patternEndsWithHyphen = patternPart.endsWith('-');
      const patternStartsWithHyphen = patternPart.startsWith('-');
      
      // Para patrones tipo -R-, necesitamos asegurarnos de que se buscan coincidencias en cualquier parte
      const isContainsPattern = patternStartsWithHyphen && patternEndsWithHyphen;
      
      matches = await findPatternMatchesWithRack(
        processedPatternWithDigraphs, 
        rackPart.trim(), 
        trie, 
        patternEndsWithHyphen,
        patternStartsWithHyphen && !patternEndsWithHyphen,
        isContainsPattern
      );
    } else {
      // For patterns without rack letters, handle standard wildcards: . (one char) and * (zero or more)
      // . stays as . (single character), * becomes .* (zero or more characters)
      const finalPattern = processedPatternWithDigraphs.replace(/\*/g, '.*');
      const regexPattern = convertPatternToRegex(finalPattern);
      console.log('Searching trie with:', { pattern: regexPattern.toString(), rackLetters: '', hasRackLetters: '' });
      matches = await searchTrie(trie.getRoot(), regexPattern);
    }
    
    console.log(`Found ${matches.length} matches before filtering`);
    
    if (specifiedLength !== null) {
      return matches.filter(word => word.length === specifiedLength);
    }
    
    if (showLongerWords) {
      return matches.filter(word => word.length > maxDefaultLength);
    } else {
      return matches.filter(word => word.length <= maxDefaultLength);
    }
  } catch (error) {
    console.error('Error in pattern matching:', error);
    return [];
  }
};

const findPatternMatchesWithRack = async (
  pattern: string, 
  rackLetters: string,
  trie: Trie,
  extendPattern: boolean = false,
  prefixPattern: boolean = false,
  isContainsPattern: boolean = false
): Promise<string[]> => {
  console.log('Generating combinations for pattern', pattern, 'with rack letters', rackLetters, 'extend:', extendPattern, 'contains:', isContainsPattern);
  
  let processedPattern = pattern;
  const endsWithPattern = pattern.endsWith('$');
  const startsWithPattern = pattern.startsWith('^');
  const containsMiddlePattern = isContainsPattern || (pattern.includes('.*') && !startsWithPattern && !endsWithPattern);
  
  if (endsWithPattern) {
    processedPattern = processedPattern.slice(0, -1);
  }
  if (startsWithPattern) {
    processedPattern = processedPattern.slice(1);
  }
  
  processedPattern = processedPattern.replace(/\.\*/g, '').replace(/\.\+/g, '');
  
  // Si el patrón contiene comodines o se debe extender
  if (processedPattern.includes('*') || processedPattern.includes('.') || extendPattern || prefixPattern || isContainsPattern) {
    return findWildcardPatternMatches(processedPattern, rackLetters, trie, extendPattern, prefixPattern, isContainsPattern);
  }
  
  const formattedPattern = processedPattern;
  const processedRack = processDigraphs(rackLetters.toUpperCase());
  
  const isStartPattern = startsWithPattern || pattern.includes('^');
  const isEndPattern = endsWithPattern || pattern.endsWith('$');
  
  const possibleWords = generatePatternCombinations(
    formattedPattern, 
    processedRack, 
    isStartPattern, 
    isEndPattern,
    isContainsPattern
  );
  
  console.log(`Generated ${possibleWords.length} possible combinations to check`);
  
  const matches: string[] = [];
  for (const word of possibleWords) {
    if (trie.search(word)) {
      const foundWords = trie.getWordsStartingWith(word).filter(w => w.length === word.length);
      matches.push(...foundWords);
    }
  }
  
  return Array.from(new Set(matches));
};

const findWildcardPatternMatches = async (
  pattern: string,
  rackLetters: string,
  trie: Trie,
  extendPattern: boolean = false,
  prefixPattern: boolean = false,
  isContainsPattern: boolean = false
): Promise<string[]> => {
  console.log(`Buscando coincidencias para patrón con comodín: ${pattern}, extender: ${extendPattern}, prefijo: ${prefixPattern}, contiene: ${isContainsPattern}`);
  
  // Primero, buscar coincidencias exactas con el patrón base
  let allMatches: string[] = [];
  
  // Limpiamos la lista de patrones base antes de empezar
  basePatches.length = 0;
  
  // Dividir el patrón en parte fija y parte expandible (*)
  const asteriskIndex = pattern.indexOf('*');
  
  if (asteriskIndex !== -1) {
    // Patrón con * - manejar expansión variable
    return await handlePatternWithAsterisk(pattern, rackLetters, trie, asteriskIndex);
  }
  
  // Para patrones solo con . (comodines de posición fija)
  const singleWildcardPositions: number[] = [];
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '.') {
      singleWildcardPositions.push(i);
    }
  }
  
  const patternChars = pattern.split('');
  const processedRack = processDigraphs(rackLetters.toUpperCase());
  
  const availableLetters = new Map<string, number>();
  let wildcards = 0;
  
  for (const char of processedRack) {
    if (char === '?') {
      wildcards++;
    } else {
      availableLetters.set(char, (availableLetters.get(char) || 0) + 1);
    }
  }
  
  console.log(`Rack letters available:`, Object.fromEntries(availableLetters.entries()), `Wildcards: ${wildcards}`);
  
  // Generar variaciones del patrón básico (reemplazando comodines de un carácter)
  await generateAllPatternVariations(
    patternChars, 
    singleWildcardPositions, 
    0, 
    new Map(availableLetters), 
    wildcards, 
    trie, 
    allMatches,
    rackLetters,
    isContainsPattern,
    extendPattern,
    prefixPattern
  );
  
  // Si necesitamos extender el patrón o buscar en cualquier posición (contains),
  // buscar palabras que incluyan las variaciones básicas
  if ((extendPattern || prefixPattern || isContainsPattern) && basePatches.length > 0) {
    console.log('Extendiendo o buscando en cualquier posición con patrones base:', basePatches);
    const extendedMatches: string[] = [];
    
    // Palabras para optimizar la búsqueda
    const baseWords = trie.getAllWords();
    
    // Por cada variación del patrón base, buscar extensiones o inclusiones
    for (const basePattern of basePatches) {
      if (isContainsPattern) {
        // Buscar palabras que contengan el patrón en cualquier posición
        for (const word of baseWords) {
          // Verificar que la palabra contenga el patrón
          if (word.includes(basePattern)) {
            // Comprobar si podemos formar esta palabra con las fichas del rack
            if (canFormWordWithRack(word, rackLetters, basePattern)) {
              extendedMatches.push(word);
            }
          }
        }
      } else if (extendPattern) {
        // Buscar palabras que empiecen con el patrón base y se extiendan
        const baseLetterUsed = countLettersUsed(basePattern, new Map());
        
        // Calcular letras disponibles después de usar el patrón base
        const remainingLetters = new Map<string, number>();
        let remainingWildcards = wildcards;
        
        for (const [letter, count] of availableLetters.entries()) {
          const used = baseLetterUsed.get(letter) || 0;
          if (count > used) {
            remainingLetters.set(letter, count - used);
          } else {
            const deficit = used - count;
            if (remainingWildcards >= deficit) {
              remainingWildcards -= deficit;
            }
          }
        }
        
        // Buscar palabras que comiencen con el patrón base
        const possibleExtensions = trie.getWordsStartingWith(basePattern);
        
        // Comprobar qué extensiones se pueden formar con las letras restantes
        for (const word of possibleExtensions) {
          if (word.length > basePattern.length) {
            const extension = word.slice(basePattern.length);
            if (canFormWithRack(extension, new Map(remainingLetters), remainingWildcards)) {
              extendedMatches.push(word);
            }
          } else if (word.length === basePattern.length) {
            // Incluir las coincidencias exactas también
            extendedMatches.push(word);
          }
        }
      } else if (prefixPattern) {
        // Buscar palabras que terminen con el patrón base y tengan prefijos
        const baseLetterUsed = countLettersUsed(basePattern, new Map());
        
        // Calcular letras disponibles después de usar el patrón base
        const remainingLetters = new Map<string, number>();
        let remainingWildcards = wildcards;
        
        for (const [letter, count] of availableLetters.entries()) {
          const used = baseLetterUsed.get(letter) || 0;
          if (count > used) {
            remainingLetters.set(letter, count - used);
          } else {
            const deficit = used - count;
            if (remainingWildcards >= deficit) {
              remainingWildcards -= deficit;
            }
          }
        }
        
        // Buscar palabras que terminen con el patrón base
        for (const word of baseWords) {
          if (word.endsWith(basePattern)) {
            if (word.length > basePattern.length) {
              const prefix = word.slice(0, word.length - basePattern.length);
              if (canFormWithRack(prefix, new Map(remainingLetters), remainingWildcards)) {
                extendedMatches.push(word);
              }
            } else if (word.length === basePattern.length) {
              // Incluir las coincidencias exactas también
              extendedMatches.push(word);
            }
          }
        }
      }
    }
    
    // Combinar las coincidencias exactas y extendidas
    allMatches = [...allMatches, ...extendedMatches];
  }
  
  return Array.from(new Set(allMatches));
};

// Verifica si podemos formar una palabra completa con las letras del rack
// considerando que ya tenemos un patrón base incluido
const canFormWordWithRack = (
  word: string,
  rackLetters: string,
  basePattern: string
): boolean => {
  // Primero, identificar índices donde aparece el patrón base
  const patternIndex = word.indexOf(basePattern);
  if (patternIndex === -1) return false;
  
  // Contar letras disponibles en el rack
  const availableLetters = new Map<string, number>();
  let wildcards = 0;
  
  const processedRack = processDigraphs(rackLetters.toUpperCase());
  for (const char of processedRack) {
    if (char === '?') {
      wildcards++;
    } else {
      availableLetters.set(char, (availableLetters.get(char) || 0) + 1);
    }
  }
  
  // Ahora, comprobar si podemos formar el resto de la palabra
  const wordLetters = new Map<string, number>();
  
  // Contar todas las letras en la palabra
  for (const char of word) {
    wordLetters.set(char, (wordLetters.get(char) || 0) + 1);
  }
  
  // Descontar letras del patrón base (no las necesitamos formar)
  for (const char of basePattern) {
    const currentCount = wordLetters.get(char) || 0;
    if (currentCount > 0) {
      wordLetters.set(char, currentCount - 1);
      if (wordLetters.get(char) === 0) {
        wordLetters.delete(char);
      }
    }
  }
  
  // Verificar si tenemos suficientes letras para formar el resto
  for (const [letter, count] of wordLetters.entries()) {
    const available = availableLetters.get(letter) || 0;
    if (available >= count) {
      availableLetters.set(letter, available - count);
    } else {
      // Necesitamos usar comodines
      const neededWildcards = count - available;
      if (wildcards >= neededWildcards) {
        wildcards -= neededWildcards;
        if (available > 0) {
          availableLetters.set(letter, 0);
        }
      } else {
        // No tenemos suficientes comodines
        return false;
      }
    }
  }
  
  return true;
};

const canFormWithRack = (
  word: string,
  availableLetters: Map<string, number>,
  wildcards: number
): boolean => {
  const wordLetters = new Map<string, number>();
  
  // Contar letras en la palabra
  for (const char of word) {
    wordLetters.set(char, (wordLetters.get(char) || 0) + 1);
  }
  
  // Verificar si tenemos suficientes letras
  for (const [letter, count] of wordLetters) {
    const available = availableLetters.get(letter) || 0;
    
    if (available < count) {
      // No tenemos suficientes de esta letra, 
      // veamos si podemos usar comodines
      const needed = count - available;
      if (wildcards >= needed) {
        wildcards -= needed;
        if (available > 0) {
          availableLetters.set(letter, 0);
        }
      } else {
        return false;
      }
    } else {
      // Tenemos suficientes, descontamos
      availableLetters.set(letter, available - count);
    }
  }
  
  return true;
};

const countLettersUsed = (
  pattern: string,
  nonWildcardPositions: Map<number, string>
): Map<string, number> => {
  const usedLetters = new Map<string, number>();
  
  for (let i = 0; i < pattern.length; i++) {
    // Si esta posición tenía un comodín, no contamos 
    // (porque ya se descontó de las letras disponibles)
    if (!nonWildcardPositions.has(i)) {
      const char = pattern[i];
      usedLetters.set(char, (usedLetters.get(char) || 0) + 1);
    }
  }
  
  return usedLetters;
};

const generateAllPatternVariations = async (
  patternChars: string[],
  wildcardPositions: number[],
  currentPosition: number,
  remainingLetters: Map<string, number>,
  remainingWildcards: number,
  trie: Trie,
  results: string[],
  rackLetters: string,
  isContainsPattern: boolean = false,
  extendPattern: boolean = false,
  prefixPattern: boolean = false
): Promise<void> => {
  if (currentPosition >= wildcardPositions.length) {
    const finalPattern = patternChars.join('');
    basePatches.push(finalPattern);
    
    // Si estamos en modo "contiene", no necesitamos buscar coincidencias exactas aquí
    // Las buscaremos después con la función específica para patrones "contiene"
    if (!isContainsPattern && !extendPattern && !prefixPattern) {
      const isStartPattern = finalPattern.startsWith('^');
      const isEndPattern = finalPattern.endsWith('$');
      
      let cleanPattern = finalPattern;
      if (isStartPattern) cleanPattern = cleanPattern.slice(1);
      if (isEndPattern) cleanPattern = cleanPattern.slice(0, -1);
      cleanPattern = cleanPattern.replace(/\.\*/g, '').replace(/\.\+/g, '');
      
      try {
        const possibleWords = generatePatternCombinations(
          cleanPattern,
          '',
          isStartPattern,
          isEndPattern
        );
        
        for (const word of possibleWords) {
          if (trie.search(word)) {
            const foundWords = trie.getWordsStartingWith(word).filter(w => w.length === word.length);
            results.push(...foundWords);
          }
        }
      } catch (error) {
        console.error('Error generando variaciones de patrón:', error);
      }
    }
    
    return;
  }
  
  const wildcardPos = wildcardPositions[currentPosition];
  
  // For each wildcard position, try all letters from the rack
  if (rackLetters && rackLetters.trim().length > 0) {
    // Track if we've used any letters from the rack to fill the wildcard
    let usedRackLetter = false;
    
    // Try all letters from the rack first (prioritize using rack letters)
    for (const [letter, count] of remainingLetters.entries()) {
      if (count > 0) {
        patternChars[wildcardPos] = letter;
        usedRackLetter = true;
        
        const newRemainingLetters = new Map(remainingLetters);
        newRemainingLetters.set(letter, count - 1);
        
        await generateAllPatternVariations(
          patternChars,
          wildcardPositions,
          currentPosition + 1,
          newRemainingLetters,
          remainingWildcards,
          trie,
          results,
          rackLetters,
          isContainsPattern,
          extendPattern,
          prefixPattern
        );
      }
    }
    
    // Try using wildcards from the rack if available
    if (remainingWildcards > 0) {
      for (const letter of SPANISH_LETTERS) {
        patternChars[wildcardPos] = letter;
        usedRackLetter = true;
        
        await generateAllPatternVariations(
          patternChars,
          wildcardPositions,
          currentPosition + 1,
          new Map(remainingLetters),
          remainingWildcards - 1,
          trie,
          results,
          rackLetters,
          isContainsPattern,
          extendPattern,
          prefixPattern
        );
      }
    }
    
    // If we haven't used any rack letter (neither regular nor wildcard),
    // we need to handle that edge case to prevent recursion from stopping
    if (!usedRackLetter) {
      // If we can't fill the wildcard, we shouldn't continue with this branch
      patternChars[wildcardPos] = '.'; // Restore the original wildcard
    }
  } else {
    // If no rack letters provided, try all possible letters
    for (const letter of SPANISH_LETTERS) {
      patternChars[wildcardPos] = letter;
      
      await generateAllPatternVariations(
        patternChars,
        wildcardPositions,
        currentPosition + 1,
        new Map(remainingLetters),
        remainingWildcards,
        trie,
        results,
        rackLetters,
        isContainsPattern,
        extendPattern,
        prefixPattern
      );
    }
  }
  
  patternChars[wildcardPos] = '.';
};

// Función simplificada para manejar patrones con * (expansión variable)
const handlePatternWithAsterisk = async (
  pattern: string,
  rackLetters: string,
  trie: Trie,
  asteriskIndex: number
): Promise<string[]> => {
  console.log(`Manejando patrón con *: ${pattern}, índice *: ${asteriskIndex}`);
  
  const matches: string[] = [];
  
  // Solo soportar * al final por ahora (caso más común: .R.Z*)
  if (asteriskIndex !== pattern.length - 1) {
    console.warn('Solo se soporta * al final del patrón por ahora');
    return [];
  }
  
  const fixedPart = pattern.substring(0, asteriskIndex); // .R.Z
  console.log(`Parte fija: "${fixedPart}"`);
  
  // Usar la lógica existente para resolver la parte fija
  const fixedPartMatches = await findFixedPartWithDots(fixedPart, rackLetters, trie);
  
  // Para cada coincidencia de la parte fija, probar expansiones
  for (const fixedMatch of fixedPartMatches) {
    // Calcular letras restantes después de usar la parte fija
    const remainingRack = calculateRemainingRack(rackLetters, fixedMatch.usedLetters);
    console.log(`Parte fija resuelta: ${fixedMatch.word}, rack restante: ${remainingRack}`);
    
    // Probar expansiones con las letras restantes
    const expansions = generateSimpleExpansions(remainingRack, 6); // Máx 6 letras adicionales
    
    for (const expansion of expansions) {
      const fullWord = fixedMatch.word + expansion;
      if (trie.search(fullWord)) {
        console.log(`¡Encontrada palabra: ${fullWord}!`);
        matches.push(fullWord);
      }
    }
  }
  
  return Array.from(new Set(matches));
};

// Resolver parte fija con puntos (.)
const findFixedPartWithDots = async (
  fixedPart: string,
  rackLetters: string,
  trie: Trie
): Promise<{word: string, usedLetters: string}[]> => {
  const results: {word: string, usedLetters: string}[] = [];
  const processedRack = processDigraphs(rackLetters.toUpperCase());
  
  // Usar la lógica existente de generateAllPatternVariations para resolver los puntos
  const patternChars = fixedPart.split('');
  const dotPositions: number[] = [];
  
  for (let i = 0; i < patternChars.length; i++) {
    if (patternChars[i] === '.') {
      dotPositions.push(i);
    }
  }
  
  if (dotPositions.length === 0) {
    // No hay puntos, devolver tal como está
    return [{word: fixedPart, usedLetters: ''}];
  }
  
  // Contar letras disponibles
  const availableLetters = new Map<string, number>();
  let wildcards = 0;
  
  for (const char of processedRack) {
    if (char === '?') {
      wildcards++;
    } else {
      availableLetters.set(char, (availableLetters.get(char) || 0) + 1);
    }
  }
  
  // Generar combinaciones para los puntos
  const combinations: {pattern: string, usedLetters: Map<string, number>}[] = [];
  await generateDotCombinationsSimple(
    patternChars,
    dotPositions,
    0,
    new Map(availableLetters),
    wildcards,
    combinations
  );
  
  // Convertir a formato de resultado
  for (const combo of combinations) {
    const usedLettersStr = Array.from(combo.usedLetters.entries())
      .map(([letter, count]) => letter.repeat(count))
      .join('');
    results.push({word: combo.pattern, usedLetters: usedLettersStr});
  }
  
  return results;
};

// Versión simplificada de generación de combinaciones para puntos
const generateDotCombinationsSimple = async (
  patternChars: string[],
  dotPositions: number[],
  currentIndex: number,
  availableLetters: Map<string, number>,
  wildcards: number,
  results: {pattern: string, usedLetters: Map<string, number>}[]
): Promise<void> => {
  if (currentIndex >= dotPositions.length) {
    const usedLetters = new Map<string, number>();
    const finalPattern = patternChars.join('');
    
    // Solo contar las letras que se usaron para reemplazar puntos
    for (let i = 0; i < dotPositions.length; i++) {
      const pos = dotPositions[i];
      const letter = patternChars[pos];
      if (letter !== '.') {
        usedLetters.set(letter, (usedLetters.get(letter) || 0) + 1);
      }
    }
    
    results.push({pattern: finalPattern, usedLetters});
    return;
  }
  
  const dotPos = dotPositions[currentIndex];
  
  // Probar cada letra disponible
  for (const [letter, count] of availableLetters.entries()) {
    if (count > 0) {
      patternChars[dotPos] = letter;
      const newAvailableLetters = new Map(availableLetters);
      newAvailableLetters.set(letter, count - 1);
      
      await generateDotCombinationsSimple(
        patternChars,
        dotPositions,
        currentIndex + 1,
        newAvailableLetters,
        wildcards,
        results
      );
    }
  }
  
  // Probar con comodines (solo primeras 5 letras para simplificar)
  if (wildcards > 0) {
    const commonLetters = ['A', 'E', 'I', 'O', 'S']; // Letras más comunes
    for (const letter of commonLetters) {
      patternChars[dotPos] = letter;
      
      await generateDotCombinationsSimple(
        patternChars,
        dotPositions,
        currentIndex + 1,
        new Map(availableLetters),
        wildcards - 1,
        results
      );
    }
  }
  
  // Restaurar el punto
  patternChars[dotPos] = '.';
};

// Calcular rack restante después de usar letras
const calculateRemainingRack = (originalRack: string, usedLetters: string): string => {
  const rackChars = processDigraphs(originalRack.toUpperCase()).split('');
  const usedChars = usedLetters.split('');
  
  // Quitar las letras usadas del rack
  for (const usedChar of usedChars) {
    const index = rackChars.indexOf(usedChar);
    if (index !== -1) {
      rackChars.splice(index, 1);
    }
  }
  
  return rackChars.join('');
};

// Generar expansiones simples con las letras restantes
const generateSimpleExpansions = (remainingRack: string, maxLength: number): string[] => {
  const expansions: string[] = ['']; // Incluir expansión vacía (cero caracteres)
  const letters = remainingRack.split('');
  
  if (letters.length === 0) {
    return expansions;
  }
  
  // Generar permutaciones hasta la longitud máxima
  for (let len = 1; len <= Math.min(maxLength, letters.length); len++) {
    const permutations = generatePermutations(letters, len);
    expansions.push(...permutations);
  }
  
  return expansions;
};

// Generar permutaciones de longitud específica
const generatePermutations = (letters: string[], targetLength: number): string[] => {
  if (targetLength === 0) return [''];
  if (letters.length === 0) return [];
  
  const permutations: string[] = [];
  const used = new Array(letters.length).fill(false);
  
  const generate = (current: string) => {
    if (current.length === targetLength) {
      permutations.push(current);
      return;
    }
    
    for (let i = 0; i < letters.length; i++) {
      if (!used[i]) {
        used[i] = true;
        generate(current + letters[i]);
        used[i] = false;
      }
    }
  };
  
  generate('');
  return permutations.slice(0, 20); // Limitar para evitar explosion
};

