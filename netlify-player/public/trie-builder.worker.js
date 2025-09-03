/**
 * Web Worker para construcción no-bloqueante del Trie
 * Permite que la UI siga funcionando mientras se construye
 */

// Simple Trie implementation para el worker
class WorkerTrie {
  constructor() {
    this.root = { children: new Map(), isEndOfWord: false, word: null };
    this.lengthIndex = {};
  }

  insert(word, originalWord) {
    let current = this.root;
    
    for (const char of word) {
      if (!current.children.has(char)) {
        current.children.set(char, { children: new Map(), isEndOfWord: false, word: null });
      }
      current = current.children.get(char);
    }
    
    current.isEndOfWord = true;
    current.word = originalWord;

    // Update length index
    const length = word.length;
    if (!this.lengthIndex[length]) {
      this.lengthIndex[length] = {};
    }
    
    const alphagram = this.sortLetters(word);
    if (!this.lengthIndex[length][alphagram]) {
      this.lengthIndex[length][alphagram] = [];
    }
    
    this.lengthIndex[length][alphagram].push(originalWord);
  }

  sortLetters(letters) {
    // Use same alphagram logic as main thread
    const CUSTOM_ALPHABET = "AEIOUBCÇDFGHJLKMNÑPQRWSTVXYZ";
    return [...letters].sort((a, b) => {
      const posA = CUSTOM_ALPHABET.indexOf(a);
      const posB = CUSTOM_ALPHABET.indexOf(b);
      return posA - posB;
    }).join('');
  }

  serialize() {
    return {
      root: this.serializeNode(this.root)
    };
  }

  serializeNode(node) {
    return {
      children: Array.from(node.children.entries()).map(([key, value]) => [
        key,
        this.serializeNode(value),
      ]),
      isEndOfWord: node.isEndOfWord,
      word: node.word,
    };
  }
}

// Process digraphs function (duplicated for worker)
function processDigraphs(input) {
  if (!input) return '';
  
  let result = input.toUpperCase();
  
  // Special handling for Ñ
  result = result.replace(/Ñ/g, '#');
  
  // Remove accents
  result = result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
  
  // Restore Ñ
  result = result.replace(/#/g, 'Ñ');
  
  // Process digraphs
  result = result.replace(/CH/g, 'Ç');
  result = result.replace(/LL/g, 'K');
  result = result.replace(/RR/g, 'W');
  
  return result;
}

// Worker message handler
self.onmessage = async function(e) {
  const { type, words } = e.data;
  
  if (type === 'BUILD_TRIE') {
    console.log('🔧 Worker: Starting Trie construction with', words.length, 'words');
    
    const trie = new WorkerTrie();
    const totalWords = words.length;
    let processed = 0;
    
    // Build trie with progress reports
    for (const word of words) {
      const upperWord = word.toUpperCase();
      trie.insert(upperWord, upperWord);
      processed++;
      
      // Report progress every 5000 words to avoid spam
      if (processed % 5000 === 0 || processed === totalWords) {
        const progress = Math.floor((processed / totalWords) * 100);
        self.postMessage({
          type: 'PROGRESS',
          progress,
          processed,
          total: totalWords
        });
      }
    }
    
    console.log('✅ Worker: Trie construction complete, serializing...');
    
    // Serialize and send back
    const serializedTrie = trie.serialize();
    self.postMessage({
      type: 'COMPLETE',
      serializedTrie,
      wordCount: totalWords
    });
    
    console.log('🚀 Worker: Trie sent to main thread');
  }
};

console.log('👷 Trie Builder Worker ready');