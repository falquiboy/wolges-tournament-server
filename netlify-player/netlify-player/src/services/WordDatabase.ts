import { SerializedTrie, TrieNode } from '@/utils/trie/types';

export interface WordEntry {
  word: string;
  alphagram: string;
  length: number;
  points?: number;
}

export class WordDatabase {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('scrabbleDB', 6);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        this.initPromise = null;
        reject(new Error('Failed to initialize IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (db.objectStoreNames.contains('words')) {
          db.deleteObjectStore('words');
        }
        if (db.objectStoreNames.contains('metadata')) {
          db.deleteObjectStore('metadata');
        }
        if (db.objectStoreNames.contains('trie')) {
          db.deleteObjectStore('trie');
        }

        const wordsStore = db.createObjectStore('words', { keyPath: 'word' });
        wordsStore.createIndex('alphagram', 'alphagram', { unique: false });
        wordsStore.createIndex('length', 'length', { unique: false });
        
        db.createObjectStore('trie', { keyPath: 'id' });
        const metaStore = db.createObjectStore('metadata', { keyPath: 'key' });
        metaStore.put({ key: 'version', value: 6 });
      };
    });

    return this.initPromise;
  }

  async addWords(wordEntries: WordEntry[]): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('words', 'readwrite');
      const store = transaction.objectStore('words');

      transaction.onerror = () => {
        console.error('Transaction error:', transaction.error);
        reject(transaction.error);
      };

      transaction.oncomplete = () => resolve();

      wordEntries.forEach(entry => {
        // Store the complete word entry with alphagram and length
        store.put({
          word: entry.word.toUpperCase(),
          alphagram: entry.alphagram.toUpperCase(),
          length: entry.length,
          points: this.calculatePoints(entry.word)
        });
      });
    });
  }

  private calculatePoints(word: string): number {
    const points: { [key: string]: number } = {
      'A': 1, 'E': 1, 'I': 1, 'L': 1, 'N': 1, 'O': 1, 'R': 1, 'S': 1, 'T': 1, 'U': 1,
      'D': 2, 'G': 2,
      'B': 3, 'C': 3, 'M': 3, 'P': 3,
      'F': 4, 'H': 4, 'V': 4, 'Y': 4,
      'J': 5, 'K': 5, 'Ñ': 5, 'Q': 5, 'W': 5, 'X': 5,
      'Z': 10,
      'RR': 8, 'LL': 8, 'CH': 5
    };

    let total = 0;
    const upperWord = word.toUpperCase();
    
    // Handle digraphs first
    let processedWord = upperWord.replace(/RR/g, 'Ř').replace(/LL/g, 'Ł').replace(/CH/g, 'Ç');
    
    for (const char of processedWord) {
      if (char === 'Ř') total += 8; // RR
      else if (char === 'Ł') total += 8; // LL  
      else if (char === 'Ç') total += 5; // CH
      else total += points[char] || 0;
    }
    
    return total;
  }

  async getAllWords(): Promise<string[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('words', 'readonly');
      const store = transaction.objectStore('words');
      const request = store.getAll();

      request.onerror = () => {
        console.error('GetAll error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        // Return words as-is, without processing digraphs
        const words = request.result.map(record => record.word);
        resolve(words);
      };
    });
  }

  async saveTrie(serializedTrie: SerializedTrie): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('trie', 'readwrite');
      const store = transaction.objectStore('trie');
      const request = store.put({ id: 'main', data: serializedTrie });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async loadTrie(): Promise<SerializedTrie | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('trie', 'readonly');
      const store = transaction.objectStore('trie');
      const request = store.get('main');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.data || null);
    });
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['words', 'trie'], 'readwrite');
      const wordsStore = transaction.objectStore('words');
      const trieStore = transaction.objectStore('trie');

      wordsStore.clear();
      trieStore.clear();

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }
}

export const wordDB = new WordDatabase();