// Orden personalizado del alfabeto español incluyendo dígrafos
const SPANISH_ALPHABET = "AEIOUBCÇDFGHJLKMNÑPQRWSTVXYZ";

/**
 * Ordena un string según el orden del alfabeto español
 */
export const sortSpanishLetters = (input: string): string => {
  return [...input].sort((a, b) => {
    const posA = SPANISH_ALPHABET.indexOf(a);
    const posB = SPANISH_ALPHABET.indexOf(b);
    
    // Si alguna letra no está en el alfabeto, la ponemos al final
    if (posA === -1) return 1;
    if (posB === -1) return -1;
    
    return posA - posB;
  }).join('');
};