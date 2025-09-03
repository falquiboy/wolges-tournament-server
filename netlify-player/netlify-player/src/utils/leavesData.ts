import { supabase } from "@/integrations/supabase/client";
import { processDigraphs } from "./digraphs";
import { identifyWildcardLetters } from "./wildcardUtils";

export interface LeaveInfo {
  leave: string;  // The combination column (e.g., "AS", "[CH]A")
  value: number;  // The numeric value column
}

// Cache local para evitar queries repetidas
const leavesCache = new Map<string, number | null>();
const CACHE_STATS = { hits: 0, misses: 0 };

// Orden ALFABÉTICO correcto para Scrabble español (según user)
// ?ABC[CH]DEFGHIJL[LL]MNÑOPQR[RR]STUVXYZ
const SCRABBLE_ORDER = '?ABC[CH]DEFGHIJL[LL]MNÑOPQR[RR]STUVXYZ';
const SCRABBLE_ORDER_MAP = new Map<string, number>();

// Crear mapa de orden alfabético correcto
let orderIndex = 0;
for (let i = 0; i < SCRABBLE_ORDER.length; i++) {
  const char = SCRABBLE_ORDER[i];
  
  // Manejar dígrafos entre corchetes
  if (char === '[') {
    // Encontrar el cierre del dígrafo
    const closeIndex = SCRABBLE_ORDER.indexOf(']', i);
    const digraph = SCRABBLE_ORDER.substring(i, closeIndex + 1);
    SCRABBLE_ORDER_MAP.set(digraph, orderIndex);
    orderIndex++;
    i = closeIndex; // Saltar al cierre del corchete
  } else {
    SCRABBLE_ORDER_MAP.set(char, orderIndex);
    orderIndex++;
  }
}

// Agregar dígrafos internos al mapa de orden (después de sus letras base)
SCRABBLE_ORDER_MAP.set('Ç', SCRABBLE_ORDER_MAP.get('C')! + 0.1); // CH después de C
SCRABBLE_ORDER_MAP.set('K', SCRABBLE_ORDER_MAP.get('L')! + 0.1); // LL después de L  
SCRABBLE_ORDER_MAP.set('W', SCRABBLE_ORDER_MAP.get('R')! + 0.1); // RR después de R

// Scrabble order mapping ready

/**
 * Ordena letras según el orden alfabético del Scrabble español
 * ?ABC[CH]DEFGHIJL[LL]MNÑOPQR[RR]STUVXYZ
 */
function sortByScrabbleOrder(letters: string[]): string[] {
  return letters.sort((a, b) => {
    const orderA = SCRABBLE_ORDER_MAP.get(a) ?? 999;
    const orderB = SCRABBLE_ORDER_MAP.get(b) ?? 999;
    
    if (orderA === 999) console.warn(`⚠️ Letra no encontrada en orden: "${a}"`);
    if (orderB === 999) console.warn(`⚠️ Letra no encontrada en orden: "${b}"`);
    
    return orderA - orderB;
  });
}

/**
 * Calcula el residuo (leave) de un rack después de formar una palabra
 * IMPORTANTE: Convierte dígrafos al formato interno antes del cálculo
 * @param rack - Las letras disponibles (ej: "CHARO", "CASERON")
 * @param word - La palabra formada (ej: "CERO", "HARO")
 * @returns El residuo en formato de tabla leaves (ej: "AS", "[CH]A")
 */
export function calculateLeave(rack: string, word: string, searchTerm?: string): string {
  // CRÍTICO: Convertir ambos a formato interno primero
  const internalRack = processDigraphs(rack.toUpperCase());
  const internalWord = processDigraphs(word.toUpperCase());
  
  // MANEJO ESPECIAL DE COMODINES
  const wildcardCount = (internalRack.match(/\?/g) || []).length;
  
  if (wildcardCount > 0 && searchTerm) {
    // Identificar exactamente qué letras vienen del comodín
    const wildcardIndices = identifyWildcardLetters(word, searchTerm);
    
    // Comenzar con el rack completo
    const rackLetters = internalRack.split('');
    const leave = [...rackLetters];
    
    // PASO 1: Consumir comodines (tantos como letras de comodín identificadas)
    const wildcardsUsed = wildcardIndices.length;
    for (let i = 0; i < wildcardsUsed; i++) {
      const wildcardIndex = leave.indexOf('?');
      if (wildcardIndex !== -1) {
        leave.splice(wildcardIndex, 1);
      }
    }
    
    // PASO 2: Remover solo las letras que NO vienen del comodín
    for (let i = 0; i < internalWord.length; i++) {
      const letter = internalWord[i];
      const isWildcardLetter = wildcardIndices.includes(i);
      
      if (!isWildcardLetter) {
        // Esta letra viene del rack real, removerla del leave
        const leaveIndex = leave.indexOf(letter);
        if (leaveIndex !== -1) {
          leave.splice(leaveIndex, 1);
        }
      }
    }
    
    // Ordenar y convertir
    const sortedLeave = sortByScrabbleOrder(leave);
    let leaveStr = sortedLeave.join('');
    
    // Convertir dígrafos internos al formato de tabla leaves
    leaveStr = leaveStr.replace(/Ç/g, '[CH]');
    leaveStr = leaveStr.replace(/K/g, '[LL]');
    leaveStr = leaveStr.replace(/W/g, '[RR]');
    
    return leaveStr;
  } else {
    // Lógica original para palabras sin comodines
    const rackLetters = internalRack.split('').sort();
    const wordLetters = internalWord.split('').sort();
    
    const leave = [...rackLetters];
    
    // Remover las letras de la palabra del rack
    for (const letter of wordLetters) {
      const index = leave.indexOf(letter);
      if (index !== -1) {
        leave.splice(index, 1);
      }
    }
    
    // Ordenar y convertir
    const sortedLeave = sortByScrabbleOrder(leave);
    let leaveStr = sortedLeave.join('');
    
    // Convertir dígrafos internos al formato de tabla leaves
    leaveStr = leaveStr.replace(/Ç/g, '[CH]');
    leaveStr = leaveStr.replace(/K/g, '[LL]');
    leaveStr = leaveStr.replace(/W/g, '[RR]');
    
    return leaveStr;
  }
}

/**
 * Busca el valor de un residuo en la tabla leaves (con cache)
 * @param leaveStr - El residuo (ej: "AS", "[CH]A")
 * @returns El valor del residuo o null si no se encuentra
 */
export async function getLeaveValue(leaveStr: string): Promise<number | null> {
  // Verificar cache primero
  if (leavesCache.has(leaveStr)) {
    CACHE_STATS.hits++;
    return leavesCache.get(leaveStr)!;
  }

  // Si no está en cache, hacer query a la base de datos
  CACHE_STATS.misses++;
  
  try {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .eq('leave', leaveStr)
      .single();
    
    let result: number | null = null;
    
    if (error) {
      console.warn(`No se encontró valor para residuo "${leaveStr}":`, error);
      result = null;
    } else if (data) {
      // Try to find the numeric value in the returned data
      const possibleValues = Object.values(data).filter(val => typeof val === 'number');
      if (possibleValues.length > 0) {
        result = possibleValues[0] as number;
      } else {
        result = null;
      }
    }
    
    // Guardar en cache (incluso si es null para evitar queries repetidas)
    leavesCache.set(leaveStr, result);
    
    // Log cache stats periodically
    if ((CACHE_STATS.hits + CACHE_STATS.misses) % 50 === 0) {
      const total = CACHE_STATS.hits + CACHE_STATS.misses;
      const hitRate = ((CACHE_STATS.hits / total) * 100).toFixed(1);
      console.log(`📊 Leaves Cache Stats: ${CACHE_STATS.hits}/${total} hits (${hitRate}% hit rate)`);
    }
    
    return result;
  } catch (error) {
    console.error('Error consultando leaves:', error);
    // Cache the null result to avoid repeated failed queries
    leavesCache.set(leaveStr, null);
    return null;
  }
}

/**
 * Busca múltiples residuos en una sola query (optimización batch)
 * @param leaveStrings - Array de residuos a buscar
 * @returns Map con los valores encontrados
 */
export async function getBatchLeaveValues(leaveStrings: string[]): Promise<Map<string, number | null>> {
  const results = new Map<string, number | null>();
  const uncachedLeaves: string[] = [];
  
  // Verificar cuáles ya están en cache
  for (const leaveStr of leaveStrings) {
    if (leavesCache.has(leaveStr)) {
      CACHE_STATS.hits++;
      results.set(leaveStr, leavesCache.get(leaveStr)!);
    } else {
      uncachedLeaves.push(leaveStr);
    }
  }
  
  // Si todos estaban en cache, devolver resultados
  if (uncachedLeaves.length === 0) {
    return results;
  }
  
  // Query batch para los que no están en cache
  CACHE_STATS.misses += uncachedLeaves.length;
  
  try {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .in('leave', uncachedLeaves);
    
    if (error) {
      console.error('Error en batch query de leaves:', error);
      // Mark all uncached as null
      for (const leaveStr of uncachedLeaves) {
        leavesCache.set(leaveStr, null);
        results.set(leaveStr, null);
      }
      return results;
    }
    
    // Procesar resultados
    const foundLeaves = new Set<string>();
    
    if (data) {
      for (const row of data) {
        const leaveStr = row.leave;
        const possibleValues = Object.values(row).filter(val => typeof val === 'number');
        const value = possibleValues.length > 0 ? possibleValues[0] as number : null;
        
        leavesCache.set(leaveStr, value);
        results.set(leaveStr, value);
        foundLeaves.add(leaveStr);
      }
    }
    
    // Marks not found as null in cache
    for (const leaveStr of uncachedLeaves) {
      if (!foundLeaves.has(leaveStr)) {
        leavesCache.set(leaveStr, null);
        results.set(leaveStr, null);
      }
    }
    
    // Log performance improvement
    console.log(`🚀 Batch query: ${uncachedLeaves.length} leaves in 1 query (vs ${uncachedLeaves.length} individual queries)`);
    
    return results;
  } catch (error) {
    console.error('Error en batch query de leaves:', error);
    // Fallback: mark all as null
    for (const leaveStr of uncachedLeaves) {
      leavesCache.set(leaveStr, null);
      results.set(leaveStr, null);
    }
    return results;
  }
}

/**
 * Calcula el valor potencial de una jugada (valor de palabra + valor de residuo)
 * @param wordValue - Valor nominal de la palabra
 * @param rack - Rack completo (ej: "CASERON")
 * @param word - Palabra formada (ej: "CERON") 
 * @returns Valor potencial redondeado a 2 decimales
 */
export async function calculatePotentialValue(
  wordValue: number, 
  rack: string, 
  word: string,
  searchTerm?: string
): Promise<number> {
  const leave = calculateLeave(rack, word, searchTerm);
  const leaveValue = await getLeaveValue(leave);
  
  if (leaveValue === null) {
    console.warn(`No se encontró valor para residuo "${leave}"`);
    return wordValue; // Solo devolver valor de palabra si no hay residuo
  }
  
  const potentialValue = wordValue + leaveValue;
  return Math.round(potentialValue * 100) / 100; // Redondear a 2 decimales
}

