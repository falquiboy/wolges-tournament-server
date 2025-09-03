/**
 * 🥷 Servicio stealth para cache persistente en IndexedDB
 * 
 * Cache de largo plazo que persiste entre sesiones sin que los componentes se enteren
 * Almacena base SQLite completa de forma eficiente
 */

import { WordEntry } from './SQLiteWordDatabase';

const DB_NAME = 'ScrabbleCache';
const DB_VERSION = 1;
const STORE_NAME = 'dictionary_cache';

interface CacheEntry {
  id: string;
  data: Uint8Array; // Base SQLite completa
  wordCount: number;
  timestamp: number;
  version: string;
}

export class PersistentCache {
  private static instance: PersistentCache;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (PersistentCache.instance) {
      return PersistentCache.instance;
    }
    PersistentCache.instance = this;
  }

  /**
   * Inicializar IndexedDB (lazy)
   */
  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.openDatabase();
    await this.initPromise;
  }

  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn('🥷 IndexedDB cache failed to open');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('🥷 IndexedDB cache ready for stealth operations');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('🥷 IndexedDB cache store created');
        }
      };
    });
  }

  /**
   * Verificar si existe cache válido
   */
  async hasValidCache(): Promise<{ valid: boolean; wordCount?: number; age?: number }> {
    try {
      await this.init();
      if (!this.db) return { valid: false };

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('main_dictionary');

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result as CacheEntry;
          
          if (!result) {
            console.log('🥷 No cache found in IndexedDB');
            resolve({ valid: false });
            return;
          }

          const ageInDays = (Date.now() - result.timestamp) / (1000 * 60 * 60 * 24);
          
          if (ageInDays > 7) {
            console.log(`🥷 Cache too old (${ageInDays.toFixed(1)} days)`);
            resolve({ valid: false, age: ageInDays });
            return;
          }

          if (result.wordCount < 600000) {
            console.log(`🥷 Cache incomplete (${result.wordCount} words)`);
            resolve({ valid: false, wordCount: result.wordCount });
            return;
          }

          console.log(`🥷 Valid cache found (${result.wordCount} words, ${ageInDays.toFixed(1)} days old)`);
          resolve({ valid: true, wordCount: result.wordCount, age: ageInDays });
        };

        request.onerror = () => {
          console.warn('🥷 Cache check failed');
          resolve({ valid: false });
        };
      });
    } catch (error) {
      console.warn('🥷 Cache validation error:', error);
      return { valid: false };
    }
  }

  /**
   * Cargar base SQLite desde cache
   */
  async loadSQLiteDatabase(): Promise<Uint8Array | null> {
    try {
      await this.init();
      if (!this.db) return null;

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('main_dictionary');

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const result = request.result as CacheEntry;
          
          if (result?.data) {
            const sizeInMB = (result.data.length / (1024 * 1024)).toFixed(2);
            console.log(`🥷 Loading SQLite from IndexedDB cache (${sizeInMB} MB)`);
            resolve(result.data);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.warn('🥷 Failed to load from cache');
          resolve(null);
        };
      });
    } catch (error) {
      console.warn('🥷 Cache load error:', error);
      return null;
    }
  }

  /**
   * Guardar base SQLite en cache
   */
  async saveSQLiteDatabase(data: Uint8Array, wordCount: number): Promise<void> {
    try {
      await this.init();
      if (!this.db) return;

      const cacheEntry: CacheEntry = {
        id: 'main_dictionary',
        data,
        wordCount,
        timestamp: Date.now(),
        version: '1.0'
      };

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cacheEntry);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const sizeInMB = (data.length / (1024 * 1024)).toFixed(2);
          console.log(`🥷 SQLite database cached in IndexedDB (${sizeInMB} MB, ${wordCount} words)`);
          resolve();
        };

        request.onerror = () => {
          console.warn('🥷 Failed to save to cache');
          reject(request.error);
        };
      });
    } catch (error) {
      console.warn('🥷 Cache save error:', error);
    }
  }

  /**
   * Guardar palabras directamente desde CSV (más eficiente)
   */
  async saveWordsFromCSV(words: WordEntry[]): Promise<void> {
    // TODO: Implementar construcción directa desde CSV si es necesario
    // Por ahora delegamos a SQLite
    console.log('🥷 Direct CSV cache not implemented yet');
  }

  /**
   * Limpiar cache viejo
   */
  async clearOldCache(): Promise<void> {
    try {
      await this.init();
      if (!this.db) return;

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('🥷 Old cache cleared');
          resolve();
        };

        request.onerror = () => {
          console.warn('🥷 Failed to clear cache');
          reject(request.error);
        };
      });
    } catch (error) {
      console.warn('🥷 Cache clear error:', error);
    }
  }
}

// Singleton instance para operaciones stealth
export const persistentCache = new PersistentCache();