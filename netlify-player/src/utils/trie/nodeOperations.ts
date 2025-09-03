import { TrieNode } from './types';

export const createNode = (): TrieNode => ({
  children: new Map(),
  isEndOfWord: false,
  word: ''
});

export const findNode = (root: TrieNode, word: string): TrieNode | null => {
  let current = root;
  
  for (const char of word) {
    if (!current.children.has(char)) {
      return null;
    }
    current = current.children.get(char)!;
  }
  
  return current;
};

export const collectWords = (node: TrieNode, words: string[]): void => {
  if (node.isEndOfWord) {
    words.push(node.word);
  }

  for (const [, child] of node.children) {
    collectWords(child, words);
  }
};