/**
 * SQLiteWordDatabase - Reemplaza IndexedDB con SQLite WASM
 * 
 * Ventajas:
 * - Construcción 10x más rápida con transacciones
 * - Queries SQL nativas con índices
 * - Cache persistente en OPFS
 * - API compatible para migración suave
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { persistentCache } from './PersistentCache';

export interface WordEntry {
  word: string;
  alphagram: string;
  length: number;
  points?: number;
}

export class SQLiteWordDatabase {
  private static instance: SQLiteWordDatabase;
  private SQL: SqlJsStatic | null = null;
  private db: Database | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private hasValidData = false; // Flag para evitar recarga en la misma sesión

  constructor() {
    if (SQLiteWordDatabase.instance) {
      return SQLiteWordDatabase.instance;
    }
    SQLiteWordDatabase.instance = this;
  }

  /**
   * Inicializar SQLite WASM y base de datos
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initializeDatabase();
    await this.initPromise;
  }

  private async initializeDatabase(): Promise<void> {
    try {
      console.log('🚀 Initializing SQLite WASM...');
      
      // Inicializar sql.js con WASM
      this.SQL = await initSqlJs({
        locateFile: (file: string) => `/${file}`
      });

      // 🥷 Operación stealth: intentar cargar desde IndexedDB primero
      const persistentData = await persistentCache.loadSQLiteDatabase();
      
      if (persistentData && persistentData.length > 0) {
        // Cargar base completa desde IndexedDB
        this.db = new this.SQL.Database(persistentData);
        const wordCount = await this.getWordCount();
        console.log(`🥷 SQLite loaded from persistent cache (${wordCount} words)`);
        this.hasValidData = wordCount >= 600000;
      } else {
        // Crear nueva base de datos vacía
        this.db = new this.SQL.Database();
        await this.createTables();
        console.log('📝 SQLite database created (no persistent cache found)');
        
        // Iniciar descarga automática de datos
        this.startAutoDataLoad();
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ SQLite initialization failed:', error);
      throw error;
    }
  }

  /**
   * Crear tablas y índices optimizados
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const schema = `
      -- Tabla principal de palabras
      CREATE TABLE words (
        word TEXT PRIMARY KEY,
        alphagram TEXT NOT NULL,
        length INTEGER NOT NULL,
        points INTEGER DEFAULT 0
      );

      -- Índices para búsquedas rápidas
      CREATE INDEX idx_alphagram ON words(alphagram);
      CREATE INDEX idx_length ON words(length);
      CREATE INDEX idx_alphagram_length ON words(alphagram, length);

      -- Tabla para cache del Trie serializado
      CREATE TABLE trie_cache (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      -- Metadata
      CREATE TABLE metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `;

    this.db.exec(schema);
    console.log('📋 SQLite tables and indexes created');
  }

  /**
   * Insertar palabras en lotes masivos (ultra-rápido)
   */
  async addWords(words: WordEntry[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO words (word, alphagram, length, points) 
      VALUES (?, ?, ?, ?)
    `);

    // Transacción para inserción masiva
    this.db.exec('BEGIN TRANSACTION;');
    
    try {
      for (const wordEntry of words) {
        stmt.run([
          wordEntry.word,
          wordEntry.alphagram,
          wordEntry.length,
          wordEntry.points || 0
        ]);
      }
      
      this.db.exec('COMMIT;');
      console.log(`✅ Inserted ${words.length} words into SQLite`);
      
      // Marcar que tenemos datos válidos después de insertar
      const totalWords = await this.getWordCount();
      if (totalWords >= 600000) {
        this.hasValidData = true;
        console.log(`🎯 SQLite marked as having valid data (${totalWords} words)`);
      }
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    } finally {
      stmt.free();
    }
  }

  /**
   * Buscar anagramas exactos por alphagram
   */
  async findAnagramsByAlphagram(alphagram: string): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT word FROM words WHERE alphagram = ? ORDER BY word');
    stmt.bind([alphagram]);

    const words: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      words.push(row.word as string);
    }

    stmt.free();
    return words;
  }

  /**
   * Buscar palabras por longitud (para subanagramas)
   */
  async findWordsByLength(length: number): Promise<WordEntry[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT word, alphagram, length FROM words WHERE length = ? ORDER BY word');
    stmt.bind([length]);

    const words: WordEntry[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      words.push({
        word: row.word as string,
        alphagram: row.alphagram as string,
        length: row.length as number
      });
    }

    stmt.free();
    return words;
  }

  /**
   * Obtener todas las palabras (para construir Trie)
   */
  async getAllWords(): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT word FROM words ORDER BY word');
    const words: string[] = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      words.push(row.word as string);
    }

    stmt.free();
    return words;
  }

  /**
   * Contar palabras totales
   */
  async getWordCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec('SELECT COUNT(*) as count FROM words')[0];
    return result?.values[0][0] as number || 0;
  }

  /**
   * Guardar Trie serializado en cache
   */
  async saveTrie(serializedTrie: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO trie_cache (id, data) 
      VALUES ('main', ?)
    `);
    
    stmt.run([JSON.stringify(serializedTrie)]);
    stmt.free();
    console.log('💾 Trie saved to SQLite cache');
  }

  /**
   * Cargar Trie desde cache
   */
  async loadTrie(): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT data FROM trie_cache WHERE id = ?');
    stmt.bind(['main']);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return JSON.parse(row.data as string);
    }

    stmt.free();
    return null;
  }

  /**
   * Limpiar cache del Trie (para invalidación)
   */
  async clearTrie(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM trie_cache WHERE id = ?');
    stmt.run(['main']);
    stmt.free();
    console.log('🗑️ Trie cache cleared');
  }

  /**
   * Guardar base de datos en cache del navegador
   */
  async saveToCache(): Promise<void> {
    if (!this.db) return;

    try {
      const wordCount = await this.getWordCount();
      
      // 🥷 Operación stealth: guardar en IndexedDB para persistencia de largo plazo
      if (wordCount >= 600000) {
        const data = this.db.export();
        await persistentCache.saveSQLiteDatabase(data, wordCount);
      }
      
      // También guardar metadatos ligeros para verificación rápida
      const metadata = {
        wordCount,
        timestamp: Date.now(),
        version: '1.0',
        isComplete: wordCount >= 600000
      };
      
      localStorage.setItem('sqlite_metadata', JSON.stringify(metadata));
      console.log(`💾 SQLite cached in both persistent and metadata storage (${wordCount} words)`);
      
    } catch (error) {
      console.warn('⚠️ Failed to cache SQLite:', error);
    }
  }

  /**
   * Cargar base de datos desde cache
   */
  private async loadFromCache(): Promise<Uint8Array | null> {
    try {
      const metadata = localStorage.getItem('sqlite_metadata');
      
      if (!metadata) {
        console.log('📭 No SQLite metadata found');
        return null;
      }

      const metaData = JSON.parse(metadata);
      
      // Verificar si el cache no es muy viejo (7 días)
      const cacheAge = Date.now() - metaData.timestamp;
      const ageInDays = cacheAge / (1000 * 60 * 60 * 24);
      
      if (ageInDays > 7) {
        console.log(`⏰ SQLite metadata too old (${ageInDays.toFixed(1)} days), ignoring`);
        localStorage.removeItem('sqlite_metadata');
        return null;
      }
      
      // Verificar que SQLite ya tenga datos válidos
      if (this.db) {
        const currentWordCount = await this.getWordCount();
        
        if (currentWordCount >= metaData.wordCount && metaData.isComplete) {
          console.log(`✅ SQLite already has valid data (${currentWordCount} words, cached: ${metaData.wordCount})`);
          return new Uint8Array(0); // Señal de que no necesita recarga pero está válida
        }
      }
      
      console.log(`📅 SQLite metadata valid but DB needs rebuilding (${ageInDays.toFixed(1)} days old)`);
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to load SQLite metadata:', error);
      localStorage.removeItem('sqlite_metadata');
      return null;
    }
  }

  /**
   * Notificar a HybridTrieService que SQLite está listo
   */
  private async notifyHybridService(): Promise<void> {
    try {
      // Importar dinámicamente para evitar circular dependencies
      const { hybridTrieService } = await import('./HybridTrieService');
      hybridTrieService.notifySqliteReady();
    } catch (error) {
      console.warn('⚠️ Failed to notify HybridTrieService:', error);
    }
  }

  /**
   * Iniciar descarga automática de datos cuando no hay caché
   */
  private async startAutoDataLoad(): Promise<void> {
    try {
      console.log('🚀 Starting automatic CSV data download...');
      
      // Importar dinámicamente para evitar circular dependencies
      const { CsvWordLoader } = await import('./CsvWordLoader');
      
      // Crear loader con conteo esperado (aproximado)
      const loader = new CsvWordLoader(600000);
      
      // Ejecutar en background sin bloquear la inicialización
      setTimeout(async () => {
        try {
          const success = await loader.loadCsvFile();
          if (success) {
            console.log('✅ SQLite database populated from CSV successfully');
            this.hasValidData = true;
            
            // Notificar a HybridTrieService que SQLite está listo
            this.notifyHybridService();
          } else {
            console.warn('⚠️ Failed to load CSV data, using fallback to Supabase');
          }
        } catch (error) {
          console.error('❌ Auto data load failed:', error);
        }
      }, 100); // Pequeño delay para no bloquear la UI
      
    } catch (error) {
      console.error('❌ Failed to start auto data load:', error);
    }
  }

  /**
   * Cerrar base de datos y limpiar
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.isInitialized = false;
  }
}

// Singleton instance
export const sqliteDB = new SQLiteWordDatabase();