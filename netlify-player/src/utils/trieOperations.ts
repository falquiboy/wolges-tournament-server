import { sqliteDB } from '@/services/SQLiteWordDatabase';
import { Trie } from '@/utils/trie';

// Versión del formato de Trie - incrementar cuando hay cambios estructurales
const TRIE_FORMAT_VERSION = 4; // v4: Datos CSV ya vienen con dígrafos procesados

export const buildTrieFromWords = async (
  words: string[],
  trie: Trie,
  onProgress: (progress: number) => void
) => {
  let processed = 0;
  const totalWords = words.length;
  let lastProgress = 0;

  trie.clear();
  
  for (const word of words) {
    // Words from CSV already have digraphs processed (CH→Ç, LL→K, RR→W)
    const upperWord = word.toUpperCase();
    trie.insert(upperWord, upperWord); // Data is already correctly processed
    processed++;
    
    const currentProgress = Math.floor((processed / totalWords) * 100);
    if (currentProgress > lastProgress) {
      lastProgress = currentProgress;
      onProgress(currentProgress);
      console.log(`Building trie progress: ${currentProgress}% (${processed}/${totalWords} words)`);
    }
  }

  return trie;
};

export const loadCachedTrie = async (trie: Trie) => {
  console.log('Checking for serialized trie...');
  
  try {
    await sqliteDB.init();
    const serializedTrie = await sqliteDB.loadTrie();
    
    if (serializedTrie && serializedTrie.data) {
      // Verificar versión del formato
      const cachedVersion = serializedTrie.formatVersion || 1; // Default v1 para caches antiguos
      
      if (cachedVersion !== TRIE_FORMAT_VERSION) {
        console.log(`🔄 Trie format version mismatch (cached: v${cachedVersion}, required: v${TRIE_FORMAT_VERSION}). Invalidating cache.`);
        await sqliteDB.clearTrie(); // Limpiar cache obsoleto
        return 0;
      }
      
      console.log('Found compatible serialized trie in SQLite, deserializing...');
      trie.deserialize(serializedTrie.data);
      return trie.getAllWords().length;
    }
  } catch (error) {
    console.warn('Failed to load trie from SQLite cache:', error);
  }
  
  return 0;
};

export const saveTrie = async (trie: Trie) => {
  console.log('Saving trie to cache...');
  const serializedTrie = trie.serialize();
  
  try {
    await sqliteDB.init();
    await sqliteDB.saveTrie({
      data: serializedTrie,
      wordCount: trie.getAllWords().length,
      timestamp: Date.now(),
      formatVersion: TRIE_FORMAT_VERSION // Incluir versión del formato
    });
    console.log(`✅ Trie v${TRIE_FORMAT_VERSION} saved to SQLite cache`);
  } catch (error) {
    console.error('❌ Failed to save trie to SQLite cache:', error);
  }
};