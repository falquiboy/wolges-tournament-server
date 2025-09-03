// Spanish digraphs and their internal representations
const DIGRAPHS = {
  CH: 'Ç',
  LL: 'K',
  RR: 'W'
} as const;

/**
 * Processes digraphs in a word, converting them to internal representation
 * This handles the complete normalization process including case conversion and accents
 */
export const processDigraphs = (input: string): string => {
  if (!input) return '';
  
  // First convert to uppercase
  let result = input.toUpperCase();
  
  // Special handling for Ñ to preserve it through normalization
  result = result.replace(/Ñ/g, '#');
  
  // Remove accents
  result = result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
  
  // Restore Ñ
  result = result.replace(/#/g, 'Ñ');
  
  // Process digraphs in a specific order
  Object.entries(DIGRAPHS).forEach(([digraph, replacement]) => {
    result = result.replace(new RegExp(digraph, 'g'), replacement);
  });
  
  return result;
};

/**
 * Converts internal representation back to display format
 */
export const toDisplayFormat = (word: string): string => {
  if (!word) return '';
  
  let result = word;
  
  // Convert back in reverse order to avoid conflicts
  Object.entries(DIGRAPHS).forEach(([digraph, replacement]) => {
    result = result.replace(new RegExp(replacement, 'g'), digraph);
  });
  
  return result;
};

/**
 * Generates an alphagram (sorted letters) from input
 */
export const generateAlphagram = (input: string): string => {
  return [...input].sort((a, b) => {
    const posA = CUSTOM_ALPHABET.indexOf(a);
    const posB = CUSTOM_ALPHABET.indexOf(b);
    return posA - posB;
  }).join('');
};

/**
 * Calculate digraph-sensitive length
 * Each digraph (CH, LL, RR) counts as one letter
 */
export const getInternalLength = (word: string): number => {
  // Use processDigraphs to ensure consistent handling
  const processed = processDigraphs(word);
  
  // Now the length will be correct as each digraph is represented by one character
  return processed.length;
};

// Custom alphabet order for sorting
const CUSTOM_ALPHABET = "AEIOUBCÇDFGHJLKMNÑPQRWSTVXYZ";