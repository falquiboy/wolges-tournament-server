import { TrieNode, LengthIndexedTrie, SerializedTrie, SerializedTrieNode } from './trie/types';
import { createNode, findNode, collectWords } from './trie/nodeOperations';
import { findWordsByLength, findWordsByAlphagram } from './trie/indexing';
import { search } from './trie/search';
import { generateAlphagram } from './digraphs';

export class Trie {
  private root: TrieNode;
  private lengthIndex: LengthIndexedTrie;

  constructor() {
    this.root = createNode();
    this.lengthIndex = {};
  }

  getRoot(): TrieNode {
    return this.root;
  }

  clear(): void {
    this.root = createNode();
    this.lengthIndex = {};
  }

  insert(word: string, originalWord: string): void {
    let current = this.root;
    
    for (const char of word) {
      if (!current.children.has(char)) {
        current.children.set(char, createNode());
      }
      current = current.children.get(char)!;
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

  private sortLetters(letters: string): string {
    return generateAlphagram(letters);
  }

  search(word: string): boolean {
    return search(this.root, word);
  }

  findAnagrams(letters: string): string[] {
    const length = letters.length;
    const alphagram = this.sortLetters(letters);
    return findWordsByAlphagram(this.lengthIndex, length, alphagram);
  }

  getWordsOfLength(length: number): string[] {
    return findWordsByLength(this.lengthIndex, length);
  }

  getAllWords(): string[] {
    const words: string[] = [];
    this.dfs(this.root, words);
    return words;
  }

  getWordsStartingWith(prefix: string): string[] {
    const node = findNode(this.root, prefix);
    if (!node) return [];
    
    const words: string[] = [];
    if (node.isEndOfWord) {
      words.push(node.word);
    }
    
    collectWords(node, words);
    return words;
  }

  private dfs(node: TrieNode, words: string[]): void {
    collectWords(node, words);
  }

  serialize(): SerializedTrie {
    const serializeNode = (node: TrieNode): SerializedTrieNode => {
      return {
        children: Array.from(node.children.entries()).map(([key, value]) => [
          key,
          serializeNode(value),
        ]),
        isEndOfWord: node.isEndOfWord,
        word: node.word,
      };
    };

    return {
      root: serializeNode(this.root),
    };
  }

  deserialize(data: SerializedTrie): void {
    const deserializeNode = (serialized: SerializedTrieNode): TrieNode => {
      const node = createNode();
      node.isEndOfWord = serialized.isEndOfWord;
      node.word = serialized.word;

      serialized.children.forEach(([key, value]) => {
        node.children.set(key, deserializeNode(value));
      });

      return node;
    };

    this.root = deserializeNode(data.root);
    
    // Rebuild length index
    this.lengthIndex = {};
    const words = this.getAllWords();
    words.forEach(word => {
      const length = word.length;
      const alphagram = this.sortLetters(word);
      
      if (!this.lengthIndex[length]) {
        this.lengthIndex[length] = {};
      }
      if (!this.lengthIndex[length][alphagram]) {
        this.lengthIndex[length][alphagram] = [];
      }
      this.lengthIndex[length][alphagram].push(word);
    });
  }
}

export const wordTrie = new Trie();
