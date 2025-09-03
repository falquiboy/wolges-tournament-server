import { LengthIndexedTrie } from './types';

export const findWordsByLength = (index: LengthIndexedTrie, length: number): string[] => {
  if (!index[length]) return [];
  
  return Object.values(index[length]).flat();
};

export const findWordsByAlphagram = (index: LengthIndexedTrie, length: number, alphagram: string): string[] => {
  if (!index[length] || !index[length][alphagram]) return [];
  
  return index[length][alphagram];
};