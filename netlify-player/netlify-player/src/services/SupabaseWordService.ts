/**
 * SupabaseWordService - Servicio directo a Supabase como último fallback
 * 
 * Este servicio consulta directamente las tablas CSV subidas a Supabase
 * cuando IndexedDB no está disponible o falló. Mantiene la misma API
 * que los otros servicios para transparencia total.
 */

import { supabase } from '@/integrations/supabase/client';

export interface SupabaseWordEntry {
  alphagram: string;
  word: string;
  length: number;
}

export class SupabaseWordService {
  private tableName = 'lexicon_keys';  // Tabla real con estructura correcta

  /**
   * Buscar palabra exacta en Supabase usando lexicon_keys
   */
  async search(word: string): Promise<boolean> {
    try {
      const upperWord = word.toUpperCase();
      console.log(`🔍 Supabase search: "${upperWord}"`);

      const { data: words, error } = await supabase
        .from(this.tableName)
        .select('norm_word')
        .eq('norm_word', upperWord)
        .limit(1);

      if (error) {
        console.error('❌ Supabase search error:', error);
        return false;
      }

      const found = words && words.length > 0;
      console.log(`${found ? '✅' : '❌'} Word ${found ? 'found' : 'not found'} in Supabase: ${upperWord}`);
      return found;

    } catch (error) {
      console.error('❌ Supabase search error:', error);
      return false;
    }
  }

  /**
   * Buscar anagramas en Supabase usando norm_alph
   */
  async findAnagrams(letters: string): Promise<string[]> {
    try {
      const alphagram = this.createAlphagram(letters.toUpperCase());
      console.log(`🔍 Supabase anagrams for: "${letters}" (alphagram: ${alphagram})`);

      const { data: anagrams, error } = await supabase
        .from(this.tableName)
        .select('norm_word')
        .eq('norm_alph', alphagram)
        .order('norm_word');

      if (error) {
        console.error('❌ Supabase anagram search error:', error);
        return [];
      }

      const words = anagrams?.map(entry => entry.norm_word) || [];
      console.log(`✅ Found ${words.length} anagrams in Supabase`);
      
      return words;

    } catch (error) {
      console.error('❌ Supabase anagram error:', error);
      return [];
    }
  }

  /**
   * Buscar subanagramas (palabras más cortas) en Supabase usando norm_length
   */
  async findSubanagrams(letters: string, minLength: number = 2): Promise<string[]> {
    try {
      const upperLetters = letters.toUpperCase();
      console.log(`🔍 Supabase subanagrams for: "${upperLetters}" (min length: ${minLength})`);

      const maxLength = letters.length - 1;
      const results: string[] = [];

      for (let len = minLength; len <= maxLength; len++) {
        const { data: words, error } = await supabase
          .from(this.tableName)
          .select('norm_word, norm_alph')
          .eq('norm_length', len)
          .limit(1000); // Límite razonable

        if (!error && words) {
          // Filtrar palabras que son subanagramas
          const subanagrams = words.filter(entry => {
            return this.isSubanagram(entry.norm_word, upperLetters);
          }).map(entry => entry.norm_word);

          results.push(...subanagrams);
        }
      }

      console.log(`✅ Found ${results.length} subanagrams in Supabase`);
      return results.sort();

    } catch (error) {
      console.error('❌ Supabase subanagram error:', error);
      return [];
    }
  }

  /**
   * Obtener todas las palabras (usado para completar el Trie)
   */
  async getAllWords(): Promise<SupabaseWordEntry[]> {
    try {
      console.log('🔍 Getting all words from Supabase...');

      const { data: words, error } = await supabase
        .from(this.tableName)
        .select('norm_word, norm_alph, norm_length')
        .order('norm_word');

      if (error) {
        console.error('❌ Supabase getAllWords error:', error);
        return [];
      }

      // Mapear a la estructura esperada
      const mappedWords = words?.map(entry => ({
        word: entry.norm_word,
        alphagram: entry.norm_alph,
        length: entry.norm_length
      })) || [];

      console.log(`✅ Retrieved ${mappedWords.length} words from Supabase`);
      return mappedWords;

    } catch (error) {
      console.error('❌ Supabase getAllWords error:', error);
      return [];
    }
  }

  /**
   * Verificar conectividad con Supabase
   */
  async isAvailable(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('norm_word')
        .limit(1);

      return !error && data !== null;
    } catch (error) {
      console.error('❌ Supabase availability check failed:', error);
      return false;
    }
  }

  /**
   * Crear alphagram con el orden custom de Scrabble
   */
  private createAlphagram(letters: string): string {
    const order = 'AEIOUBCÇDFGHJLKMNÑPQRWSTVXYZ';
    const orderMap = new Map<string, number>();
    
    // Crear mapa de posiciones
    for (let i = 0; i < order.length; i++) {
      orderMap.set(order[i], i);
    }
    
    return [...letters]
      .sort((a, b) => {
        const posA = orderMap.get(a) ?? 999;
        const posB = orderMap.get(b) ?? 999;
        return posA - posB;
      })
      .join('');
  }

  /**
   * Función helper para verificar si una palabra es subanagrama de las letras dadas
   */
  private isSubanagram(word: string, availableLetters: string): boolean {
    const letterCount: { [key: string]: number } = {};
    
    // Contar letras disponibles
    for (const letter of availableLetters) {
      letterCount[letter] = (letterCount[letter] || 0) + 1;
    }

    // Verificar si la palabra puede formarse
    for (const letter of word) {
      if (!letterCount[letter] || letterCount[letter] === 0) {
        return false;
      }
      letterCount[letter]--;
    }

    return true;
  }
}

// Instancia singleton
export const supabaseWordService = new SupabaseWordService();