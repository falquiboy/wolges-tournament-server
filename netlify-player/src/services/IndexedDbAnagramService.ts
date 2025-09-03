/**
 * Servicio de anagramas usando IndexedDB con índices optimizados
 * Fallback rápido mientras el Trie se carga
 */

import { wordDB, WordEntry } from './WordDatabase';

export interface AnagramResults {
  exactMatches: string[];
  partialMatches: string[];
}

export class IndexedDbAnagramService {
  
  /**
   * Buscar anagramas exactos usando el índice alphagram
   */
  async findExactAnagrams(letters: string): Promise<string[]> {
    const db = await this.getDatabase();
    if (!db) return [];

    const normalizedLetters = this.normalizeLetters(letters);
    const alphagram = this.createAlphagram(normalizedLetters);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('words', 'readonly');
      const store = transaction.objectStore('words');
      const index = store.index('alphagram');
      
      const request = index.getAll(alphagram);
      
      request.onsuccess = () => {
        const words = request.result.map((entry: WordEntry) => entry.word);
        resolve(words);
      };
      
      request.onerror = () => {
        console.error('Error finding exact anagrams:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Buscar subanagramas (palabras más cortas)
   */
  async findSubAnagrams(letters: string, minLength: number = 2): Promise<string[]> {
    const db = await this.getDatabase();
    if (!db) return [];

    const normalizedLetters = this.normalizeLetters(letters);
    const maxLength = normalizedLetters.length - 1;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('words', 'readonly');
      const store = transaction.objectStore('words');
      const lengthIndex = store.index('length');
      
      // Buscar palabras en el rango de longitud
      const range = IDBKeyRange.bound(minLength, maxLength);
      const request = lengthIndex.getAll(range);
      
      request.onsuccess = () => {
        const candidates = request.result;
        const availableAlphagram = this.createAlphagram(normalizedLetters);
        
        // Filtrar las que se pueden formar con las letras disponibles
        const validWords = candidates
          .filter((entry: WordEntry) => this.canMakeWord(availableAlphagram, entry.alphagram))
          .map((entry: WordEntry) => entry.word)
          .slice(0, 100); // Limitar resultados
        
        resolve(validWords);
      };
      
      request.onerror = () => {
        console.error('Error finding subanagrams:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Buscar anagramas completos (exactos + subanagramas)
   */
  async findAnagrams(letters: string, minLength: number = 2, includeSubanagrams: boolean = false): Promise<AnagramResults> {
    try {
      console.log(`🔍 IndexedDB anagram search: "${letters}"`);
      
      const exactMatches = await this.findExactAnagrams(letters);
      const partialMatches = includeSubanagrams ? await this.findSubAnagrams(letters, minLength) : [];
      
      console.log(`✅ IndexedDB results: ${exactMatches.length} exact, ${partialMatches.length} partial`);
      
      return {
        exactMatches,
        partialMatches
      };
    } catch (error) {
      console.error('❌ IndexedDB anagram search failed:', error);
      return { exactMatches: [], partialMatches: [] };
    }
  }

  /**
   * Verificar si una palabra se puede formar con las letras disponibles
   */
  private canMakeWord(availableAlphagram: string, neededAlphagram: string): boolean {
    const available = [...availableAlphagram];
    const needed = [...neededAlphagram];

    for (const letter of needed) {
      const index = available.indexOf(letter);
      if (index === -1) return false;
      available.splice(index, 1);
    }

    return true;
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
    
    return letters
      .split('')
      .sort((a, b) => {
        const posA = orderMap.get(a) ?? 999;
        const posB = orderMap.get(b) ?? 999;
        return posA - posB;
      })
      .join('');
  }

  /**
   * Normalizar letras para Scrabble (dígrafos)
   */
  private normalizeLetters(word: string): string {
    if (!word || typeof word !== 'string') {
      return '';
    }
    return word.toUpperCase()
      .replace(/CH/g, 'Ç')
      .replace(/LL/g, 'K') 
      .replace(/RR/g, 'W');
  }

  /**
   * Obtener referencia a la base de datos
   */
  private async getDatabase(): Promise<IDBDatabase | null> {
    try {
      await wordDB.init();
      // Acceder a la propiedad privada db de manera segura
      return (wordDB as any).db;
    } catch (error) {
      console.error('Error accessing database:', error);
      return null;
    }
  }

  /**
   * Verificar si el servicio está listo
   */
  async isReady(): Promise<boolean> {
    const db = await this.getDatabase();
    if (!db) return false;

    return new Promise((resolve) => {
      const transaction = db.transaction('words', 'readonly');
      const store = transaction.objectStore('words');
      const request = store.count();
      
      request.onsuccess = () => {
        const count = request.result;
        resolve(count > 0);
      };
      
      request.onerror = () => resolve(false);
    });
  }
}

// Singleton instance
export const indexedDbAnagramService = new IndexedDbAnagramService();