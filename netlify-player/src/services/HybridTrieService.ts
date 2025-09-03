/**
 * Servicio híbrido que actúa como un Trie pero usa fallbacks progresivos
 * Mantiene la API exacta del Trie legacy para compatibilidad total
 * 
 * Orden de fallback: Trie → SQLite → Supabase
 */

import { Trie } from '@/utils/trie';
import { sqliteAnagramService } from './SqliteAnagramService';
import { supabaseWordService } from './SupabaseWordService';
import { processDigraphs, generateAlphagram } from '@/utils/digraphs';

export class HybridTrieService {
  private actualTrie: Trie | null = null;
  private isTrieReady: boolean = false;
  private isSqliteAvailable: boolean = false;
  private isSupabaseAvailable: boolean = false;

  constructor(trie: Trie | null = null) {
    this.actualTrie = trie;
    this.isTrieReady = trie !== null;
    
    // Inicializar disponibilidad de servicios de fallback
    this.initializeFallbackServices();
  }

  /**
   * 🚀 HOT UPGRADE: Actualiza el Trie sin interrumpir el servicio
   * Permite construcción en background con upgrade transparente
   */
  upgradeTrie(trie: Trie): void {
    console.log('🔥 Hot upgrading HybridTrieService with new Trie');
    this.actualTrie = trie;
    this.isTrieReady = true;
    console.log('✅ Trie upgraded! Ultra-fast mode enabled');
  }

  /**
   * Inicializar servicios de fallback en background
   */
  private async initializeFallbackServices() {
    // Verificar Supabase primero (más confiable)
    try {
      this.isSupabaseAvailable = await supabaseWordService.isAvailable();
      console.log(`🌐 Supabase availability: ${this.isSupabaseAvailable}`);
    } catch (error) {
      console.warn('⚠️ Supabase check failed:', error);
      this.isSupabaseAvailable = false;
    }
    
    // SQLite se verifica dinámicamente para evitar bloqueos durante construcción
    this.checkSqliteAvailability();
  }

  /**
   * Notificar que SQLite está listo (llamado desde SQLiteWordDatabase)
   */
  notifySqliteReady(): void {
    console.log('🔔 SQLite notified as ready to HybridTrieService');
    this.isSqliteAvailable = true;
  }

  /**
   * Verificar dinámicamente si SQLite está disponible para consultas
   * Detecta si está bloqueado por construcción O si tiene datos insuficientes
   */
  private async checkSqliteAvailability(): Promise<boolean> {
    try {
      // Test ultra-rápido: verificar disponibilidad de SQLite con palabra común
      const testPromise = sqliteAnagramService.findAnagrams('ES', 2, false);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('SQLite blocked or timeout')), 500)
      );
      
      const result = await Promise.race([testPromise, timeoutPromise]);
      
      // Verificar si SQLite tiene datos suficientes
      if (result.exactMatches.length === 0) {
        this.isSqliteAvailable = false;
        return false;
      }
      
      this.isSqliteAvailable = true;
      return true;
    } catch (error) {
      this.isSqliteAvailable = false;
      return false;
    }
  }

  /**
   * Actualizar la referencia al Trie cuando esté listo
   */
  updateTrie(trie: Trie | null) {
    this.actualTrie = trie;
    this.isTrieReady = trie !== null;
    console.log(`🔄 Hybrid service updated - Trie ready: ${this.isTrieReady}`);
  }

  /**
   * Método search - API exacta del Trie legacy con fallback de 3 niveles
   */
  search(word: string): boolean {
    if (this.isTrieReady && this.actualTrie) {
      // Nivel 1: Usar Trie si está disponible (ultra-rápido)
      return this.actualTrie.search(word);
    } else {
      // Los niveles 2 y 3 requieren async, pero search() debe ser sync para compatibilidad
      // Delegar a searchAsync() para fallbacks verdaderos
      console.log(`⚡ Sync search limited to Trie only: ${word}`);
      return false;
    }
  }

  /**
   * Método search asíncrono con fallback completo de 3 niveles
   */
  async searchAsync(word: string): Promise<boolean> {
    // Normalize word with digraphs for all searches
    const normalizedWord = processDigraphs(word);
    console.log(`🔤 Normalized word: ${word} → ${normalizedWord}`);
    
    // Nivel 1: Trie (ultra-rápido)
    if (this.isTrieReady && this.actualTrie) {
      console.log(`🚀 Level 1 - Trie search: ${normalizedWord}`);
      return this.actualTrie.search(normalizedWord);
    }

    // Nivel 2: SQLite (rápido, pero verificar disponibilidad real)
    const isSqliteReady = await this.checkSqliteAvailability();
    if (isSqliteReady) {
      console.log(`⚡ Level 2 - SQLite search: ${normalizedWord}`);
      try {
        const results = await sqliteAnagramService.findAnagrams(normalizedWord, normalizedWord.length, false);
        return results.exactMatches.includes(normalizedWord.toUpperCase());
      } catch (error) {
        console.log(`⚠️ SQLite search failed, falling back: ${error}`);
        this.isSqliteAvailable = false; // Marcar como no disponible
      }
    }

    // Nivel 3: Supabase (remoto)
    if (this.isSupabaseAvailable) {
      console.log(`🌐 Level 3 - Supabase search: ${normalizedWord}`);
      return await supabaseWordService.search(normalizedWord);
    }

    console.log(`❌ No services available for search: ${word}`);
    return false;
  }

  /**
   * Método findAnagrams - API exacta del Trie legacy (SYNC para compatibilidad)
   */
  findAnagrams(letters: string): string[] {
    if (this.isTrieReady && this.actualTrie) {
      // Process digraphs in user input to match stored data format (CH→Ç, LL→K, RR→W)
      const processedLetters = processDigraphs(letters);
      const alphagram = generateAlphagram(processedLetters);
      console.log(`🚀 Using Trie for anagrams: ${letters} → ${processedLetters} → alphagram: ${alphagram}`);
      return this.actualTrie.findAnagrams(processedLetters);
    } else {
      // Sin Trie disponible, no podemos hacer búsqueda sync
      console.log(`❌ Sync anagrams not available without Trie: ${letters}`);
      return [];
    }
  }

  /**
   * Método findAnagrams async con fallback completo de 3 niveles
   */
  async findAnagramsAsync(letters: string): Promise<string[]> {
    // Nivel 1: Trie (ultra-rápido)
    if (this.isTrieReady && this.actualTrie) {
      const processedLetters = processDigraphs(letters);
      console.log(`🚀 Level 1 - Trie anagrams: ${letters} → ${processedLetters}`);
      return this.actualTrie.findAnagrams(processedLetters);
    }

    // Nivel 2: SQLite (rápido, pero verificar disponibilidad real)
    const isSqliteReady = await this.checkSqliteAvailability();
    if (isSqliteReady) {
      console.log(`⚡ Level 2 - SQLite anagrams: ${letters}`);
      try {
        const results = await sqliteAnagramService.findAnagrams(letters, 2, false);
        return results.exactMatches;
      } catch (error) {
        console.log(`⚠️ SQLite anagrams failed, falling back: ${error}`);
        this.isSqliteAvailable = false;
      }
    }

    // Nivel 3: Supabase (remoto)
    if (this.isSupabaseAvailable) {
      console.log(`🌐 Level 3 - Supabase anagrams: ${letters}`);
      return await supabaseWordService.findAnagrams(letters);
    }

    console.log(`❌ No services available for anagrams: ${letters}`);
    return [];
  }

  /**
   * 🎯 Método findAnagramsWithWildcards - Soporte para comodines (?)
   * Máximo 2 comodines permitidos, compatible con sistema legacy
   */
  async findAnagramsWithWildcards(letters: string): Promise<{
    exactMatches: string[];
    wildcardMatches: string[];
    additionalWildcardMatches: string[];
  }> {
    const wildcardCount = (letters.match(/\?/g) || []).length;
    
    if (wildcardCount > 2) {
      console.log(`❌ Too many wildcards (${wildcardCount}), max allowed: 2`);
      return { exactMatches: [], wildcardMatches: [], additionalWildcardMatches: [] };
    }

    // Nivel 1: Trie + lógica de wildcards
    if (this.isTrieReady && this.actualTrie) {
      return await this.processWildcardsWithTrie(letters, wildcardCount);
    }

    // Nivel 2: SQLite + wildcards
    const isSqliteReady = await this.checkSqliteAvailability();
    if (isSqliteReady) {
      try {
        return await this.processWildcardsWithSQLite(letters, wildcardCount);
      } catch (error) {
        this.isSqliteAvailable = false;
      }
    }

    // Nivel 3: Supabase + wildcards
    if (this.isSupabaseAvailable) {
      return await this.processWildcardsWithSupabase(letters, wildcardCount);
    }

    console.log(`❌ No services available for wildcards: ${letters}`);
    return { exactMatches: [], wildcardMatches: [], additionalWildcardMatches: [] };
  }

  /**
   * Método findAnagrams sincrono para compatibilidad legacy (requiere Trie)
   * Para uso en funciones que esperan el Trie clásico
   */
  findAnagramsSync(letters: string): { 
    exactMatches: string[], 
    wildcardMatches: string[], 
    additionalWildcardMatches: string[], 
    shorterMatches: string[] 
  } {
    if (this.isTrieReady && this.actualTrie) {
      // Usar método legacy del Trie que puede tener esta estructura
      console.log(`🚀 Using Trie sync anagrams: ${letters}`);
      // Intentar usar el método legacy si existe
      if (typeof (this.actualTrie as any).findAnagramsLegacy === 'function') {
        return (this.actualTrie as any).findAnagramsLegacy(letters);
      } else {
        // Fallback básico si no existe
        const exactMatches = this.actualTrie.findAnagrams(letters);
        return {
          exactMatches,
          wildcardMatches: [],
          additionalWildcardMatches: [],
          shorterMatches: []
        };
      }
    } else {
      // Sin Trie, no podemos hacer búsquedas síncronas
      console.log(`❌ Sync anagrams not available without Trie: ${letters}`);
      return {
        exactMatches: [],
        wildcardMatches: [],
        additionalWildcardMatches: [],
        shorterMatches: []
      };
    }
  }

  /**
   * Método findAnagramsWithSubAnagrams - API extendida con fallback de 3 niveles
   */
  async findAnagramsWithSubAnagrams(letters: string, includeSubanagrams: boolean = false): Promise<{
    exactMatches: string[];
    shorterMatches: string[];
  }> {
    // Nivel 1: Trie + IndexedDB para subanagramas (híbrido óptimo)
    if (this.isTrieReady && this.actualTrie) {
      const processedLetters = processDigraphs(letters);
      console.log(`🚀 Level 1 - Trie + IndexedDB hybrid anagrams: ${letters} → ${processedLetters}`);
      const exactMatches = this.actualTrie.findAnagrams(processedLetters);
      
      // Para subanagramas, usar SQLite ya que está optimizado para esto
      let shorterMatches: string[] = [];
      if (includeSubanagrams && this.isSqliteAvailable) {
        const results = await sqliteAnagramService.findAnagrams(processedLetters, 2, true);
        shorterMatches = results.partialMatches;
      }
      
      return { exactMatches, shorterMatches };
    }

    // Nivel 2: SQLite completo
    if (this.isSqliteAvailable) {
      console.log(`⚡ Level 2 - SQLite extended anagrams: ${letters}`);
      const results = await sqliteAnagramService.findAnagrams(letters, 2, includeSubanagrams);
      return {
        exactMatches: results.exactMatches,
        shorterMatches: results.partialMatches
      };
    }

    // Nivel 3: Supabase
    if (this.isSupabaseAvailable) {
      console.log(`🌐 Level 3 - Supabase extended anagrams: ${letters}`);
      const exactMatches = await supabaseWordService.findAnagrams(letters);
      let shorterMatches: string[] = [];
      
      if (includeSubanagrams) {
        shorterMatches = await supabaseWordService.findSubanagrams(letters, 2);
      }
      
      return { exactMatches, shorterMatches };
    }

    console.log(`❌ No services available for extended anagrams: ${letters}`);
    return { exactMatches: [], shorterMatches: [] };
  }

  /**
   * Método getAllWords - API exacta del Trie legacy
   */
  getAllWords(): string[] {
    if (this.isTrieReady && this.actualTrie) {
      return this.actualTrie.getAllWords();
    } else {
      // Fallback: retornar array vacío por ahora
      // TODO: Implementar con IndexedDB si es necesario
      console.log(`⚡ Hybrid getAllWords fallback - returning empty array`);
      return [];
    }
  }

  /**
   * Verificar si algún servicio está disponible
   */
  isReady(): boolean {
    return this.isTrieReady || this.isIndexedDbReady();
  }

  /**
   * Verificar específicamente si el Trie está listo
   */
  isTrieAvailable(): boolean {
    return this.isTrieReady;
  }

  /**
   * Verificar si IndexedDB está disponible (síntcrono aproximado)
   */
  private isIndexedDbReady(): boolean {
    // IndexedDB debería estar siempre disponible después de la carga inicial
    return true;
  }

  /**
   * Obtener información de qué proveedor se está usando actualmente
   */
  getCurrentProvider(): 'trie' | 'sqlite' | 'supabase' | 'none' {
    return this.isTrieReady ? 'trie' : 
           this.isSqliteAvailable ? 'sqlite' : 
           this.isSupabaseAvailable ? 'supabase' : 'none';
  }

  /**
   * 🎯 Método findPatternMatches - Buscar por patrones con fallback completo
   */
  async findPatternMatches(
    pattern: string, 
    showLongerWords: boolean = false,
    maxDefaultLength: number = 8,
    targetLength: number | null = null
  ): Promise<string[]> {
    // Nivel 1: Trie (ultra-rápido)
    if (this.isTrieReady && this.actualTrie) {
      console.log(`🚀 Level 1 - Trie pattern search: ${pattern}`);
      try {
        // Usar la función importada de pattern matching
        const { findPatternMatches } = await import('@/utils/pattern/matching');
        return await findPatternMatches(pattern, this.actualTrie, showLongerWords, maxDefaultLength, targetLength);
      } catch (error) {
        console.log(`⚠️ Trie pattern search failed, falling back: ${error}`);
      }
    }

    // Nivel 2: SQLite (rápido, pero verificar disponibilidad real)
    const isSqliteReady = await this.checkSqliteAvailability();
    if (isSqliteReady) {
      console.log(`⚡ Level 2 - SQLite pattern search: ${pattern}`);
      try {
        return await sqliteAnagramService.findPatternMatches(
          pattern, 
          showLongerWords, 
          maxDefaultLength, 
          targetLength || undefined
        );
      } catch (error) {
        console.log(`⚠️ SQLite pattern search failed, falling back: ${error}`);
        this.isSqliteAvailable = false;
      }
    }

    // Nivel 3: Supabase (remoto) - implementación básica
    if (this.isSupabaseAvailable) {
      console.log(`🌐 Level 3 - Supabase pattern search: ${pattern}`);
      // Por ahora, Supabase no tiene búsqueda de patrones implementada
      console.log(`⚠️ Supabase pattern search not implemented yet`);
      return [];
    }

    console.log(`❌ No services available for pattern search: ${pattern}`);
    return [];
  }

  /**
   * Obtener estadísticas del servicio
   */
  getStats(): { 
    provider: string; 
    ready: boolean; 
    trieReady: boolean; 
    indexedDbReady: boolean; 
    supabaseReady: boolean;
  } {
    return {
      provider: this.getCurrentProvider(),
      ready: this.isReady(),
      trieReady: this.isTrieReady,
      indexedDbReady: this.isIndexedDbAvailable,
      supabaseReady: this.isSupabaseAvailable
    };
  }

  /**
   * 🎯 Procesar wildcards usando Trie (legacy compatible)
   */
  private async processWildcardsWithTrie(letters: string, wildcardCount: number): Promise<{
    exactMatches: string[];
    wildcardMatches: string[];
    additionalWildcardMatches: string[];
  }> {
    if (!this.actualTrie) {
      return { exactMatches: [], wildcardMatches: [], additionalWildcardMatches: [] };
    }

    const lettersOnly = letters.replace(/\?/g, '');
    const processedInput = processDigraphs(lettersOnly);
    
    // Anagramas exactos (sin comodines)
    const exactMatches = wildcardCount === 0 
      ? this.actualTrie.findAnagrams(processedInput)
      : [];

    // Usar estrategia optimizada: búsqueda directa en lugar de generar todas las combinaciones
    const spanishLetters = ["A", "B", "C", "Ç", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    
    let wildcardMatches: string[] = [];
    let additionalWildcardMatches: string[] = [];

    if (wildcardCount > 0) {
      // Estrategia optimizada: buscar palabras por longitud específica
      const targetLength = processedInput.length + wildcardCount;
      const targetLengthPlus1 = targetLength + 1;
      
      // Obtener todas las palabras de longitud objetivo
      const wordsOfTargetLength = this.actualTrie.getWordsOfLength(targetLength);
      const wordsOfTargetLengthPlus1 = this.actualTrie.getWordsOfLength(targetLengthPlus1);
      
      // Verificar cuáles son anagramas válidos
      for (const word of wordsOfTargetLength) {
        if (this.canFormWordWithWildcards(word, processedInput, wildcardCount)) {
          wildcardMatches.push(word);
        }
      }
      
      // Para palabras con letra adicional
      for (const word of wordsOfTargetLengthPlus1) {
        if (this.canFormWordWithWildcards(word, processedInput, wildcardCount + 1)) {
          additionalWildcardMatches.push(word);
        }
      }
    }

    return {
      exactMatches: Array.from(new Set(exactMatches)),
      wildcardMatches: Array.from(new Set(wildcardMatches)),
      additionalWildcardMatches: Array.from(new Set(additionalWildcardMatches))
    };
  }

  /**
   * Verificar si una palabra se puede formar con las letras disponibles + wildcards
   */
  private canFormWordWithWildcards(word: string, availableLetters: string, wildcards: number): boolean {
    const wordLetters = word.toUpperCase().split('');
    const available = availableLetters.toUpperCase().split('');
    
    // Contar letras disponibles
    const availableCount = new Map<string, number>();
    for (const letter of available) {
      availableCount.set(letter, (availableCount.get(letter) || 0) + 1);
    }
    
    // Contar letras necesarias
    const neededCount = new Map<string, number>();
    for (const letter of wordLetters) {
      neededCount.set(letter, (neededCount.get(letter) || 0) + 1);
    }
    
    let wildcardsNeeded = 0;
    
    // Verificar cada letra necesaria
    for (const [letter, needed] of neededCount) {
      const available_of_letter = availableCount.get(letter) || 0;
      if (needed > available_of_letter) {
        wildcardsNeeded += needed - available_of_letter;
      }
    }
    
    return wildcardsNeeded <= wildcards;
  }

  /**
   * 🎯 Procesar wildcards usando SQLite
   */
  private async processWildcardsWithSQLite(letters: string, wildcardCount: number): Promise<{
    exactMatches: string[];
    wildcardMatches: string[];
    additionalWildcardMatches: string[];
  }> {
    console.log(`🔍 SQLite: processing ${wildcardCount} wildcards for "${letters}"`);
    
    try {
      // Usar el nuevo método de SQLite que maneja wildcards completos
      return await sqliteAnagramService.findAnagramsWithWildcards(letters, 2);
    } catch (error) {
      console.error('❌ SQLite wildcards search failed:', error);
      // Fallback to Supabase on error
      return this.processWildcardsWithSupabase(letters, wildcardCount);
    }
  }

  /**
   * 🎯 Procesar wildcards usando Supabase (legacy compatible)
   */
  private async processWildcardsWithSupabase(letters: string, wildcardCount: number): Promise<{
    exactMatches: string[];
    wildcardMatches: string[];
    additionalWildcardMatches: string[];
  }> {
    // Usar la lógica legacy de useAnagramSearch
    const lettersOnly = letters.replace(/\?/g, '');
    const processedInput = processDigraphs(lettersOnly);
    const inputLength = processedInput.length;
    
    let exactMatches: string[] = [];
    let wildcardMatches: string[] = [];
    let additionalWildcardMatches: string[] = [];

    if (wildcardCount === 0) {
      exactMatches = await supabaseWordService.findAnagrams(processedInput);
    } else {
      // Usar la lógica de combinaciones del useAnagramSearch legacy
      const spanishLetters = ["A", "B", "C", "Ç", "CH", "D", "E", "F", "G", "H", "I", "J", "K", "L", "LL", "M", "N", "Ñ", "O", "P", "Q", "R", "RR", "S", "T", "U", "V", "W", "X", "Y", "Z"];
      
      const generateCombinations = (depth: number): string[] => {
        if (depth === 0) return [''];
        const results: string[] = [];
        const prev = generateCombinations(depth - 1);
        for (const p of prev) {
          for (const letter of spanishLetters) {
            results.push(p + letter);
          }
        }
        return results;
      };

      // Limitar combinaciones para performance en Supabase
      const combinations = generateCombinations(wildcardCount).slice(0, 50);
      for (const combo of combinations) {
        const fullLetters = processedInput + combo;
        const matches = await supabaseWordService.findAnagrams(fullLetters);
        wildcardMatches.push(...matches);
      }
    }

    return {
      exactMatches: Array.from(new Set(exactMatches)),
      wildcardMatches: Array.from(new Set(wildcardMatches)),
      additionalWildcardMatches: Array.from(new Set(additionalWildcardMatches))
    };
  }
}

// Singleton instance
export const hybridTrieService = new HybridTrieService();