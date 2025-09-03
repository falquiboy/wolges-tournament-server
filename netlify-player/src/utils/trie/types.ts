export interface TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  word: string;
}

export interface SerializedTrieNode {
  children: [string, SerializedTrieNode][];
  isEndOfWord: boolean;
  word: string;
}

export interface SerializedTrie {
  root: SerializedTrieNode;
}

export interface LengthIndexedTrie {
  [length: number]: {
    [alphagram: string]: string[];
  };
}

export interface Trie {
  getRoot(): TrieNode;
  clear(): void;
  insert(word: string, originalWord: string): void;
  search(word: string): boolean;
  findAnagrams(letters: string): string[];
  getWordsOfLength(length: number): string[];
  getAllWords(): string[];
  getWordsStartingWith(prefix: string): string[];
  serialize(): SerializedTrie;
  deserialize(data: SerializedTrie): void;
}