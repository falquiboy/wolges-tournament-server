/**
 * Hook de búsqueda de anagramas democrático
 * Utiliza el servicio híbrido para búsquedas con fallback automático
 */

import { useState, useEffect } from 'react';
import { hybridWordService } from '@/services/HybridWordService';
import { findPatternMatches } from "@/utils/pattern/matching";
import { Trie } from "@/utils/trie/types";
import { SearchResults } from "./anagramSearch/types";

export const useDemocraticAnagramSearch = (
  searchTerm: string,
  trie: Trie | null,
  showShorter: boolean,
  targetLength: number | null
) => {
  const [results, setResults] = useState<SearchResults>({
    exactMatches: [],
    wildcardMatches: [],
    additionalWildcardMatches: [],
    shorterMatches: [],
    patternMatches: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchAnagrams = async () => {
      if (!searchTerm.trim()) {
        setResults({
          exactMatches: [],
          wildcardMatches: [],
          additionalWildcardMatches: [],
          shorterMatches: [],
          patternMatches: []
        });
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const trimmedTerm = searchTerm.trim();
        console.log('🌍 Democratic anagram search:', { searchTerm: trimmedTerm, showShorter, targetLength });

        // Check if it's a pattern search
        const isPatternSearch = trimmedTerm.includes('*') || 
                               trimmedTerm.includes('.') || 
                               trimmedTerm.includes('-') || 
                               trimmedTerm.includes(':');

        if (isPatternSearch) {
          console.log('🔍 Pattern search detected, using hybrid pattern search');
          
          // Extract target length from pattern if it contains a colon
          let patternLength = targetLength;
          let cleanPattern = trimmedTerm;
          
          if (trimmedTerm.includes(':')) {
            const [patternPart, lengthStr] = trimmedTerm.split(':');
            if (lengthStr && /^\d+$/.test(lengthStr)) {
              patternLength = parseInt(lengthStr, 10);
              cleanPattern = patternPart;
            }
          }

          // For pattern searches, use appropriate method based on availability
          let patternMatches: string[] = [];
          
          if (cleanPattern.includes('?') || cleanPattern.includes('*')) {
            // Use hybrid service for wildcard patterns
            const result = await hybridWordService.searchPattern(cleanPattern);
            patternMatches = result.words;
            console.log(`✅ Pattern search via ${result.provider}: ${result.words.length} results (${result.responseTime}ms)`);
          } else if (trie) {
            // Use trie for simple patterns
            const matches = await findPatternMatches(cleanPattern, trie, showShorter, 8, patternLength);
            patternMatches = matches;
            console.log(`✅ Pattern search via trie: ${matches.length} results`);
          }

          setResults({
            exactMatches: [],
            wildcardMatches: [],
            additionalWildcardMatches: [],
            shorterMatches: [],
            patternMatches
          });

        } else {
          // Regular anagram search using democratic service
          console.log('🔤 Anagram search detected, using democratic service');
          
          const result = await hybridWordService.findAnagrams(
            trimmedTerm,
            2, // minLength
            showShorter, // includeSubanagrams
            false // includeAdditional - could be parameterized
          );

          console.log(`✅ Anagram search via ${result.provider}: ${result.exactMatches.length} exact, ${result.partialMatches.length} shorter (${result.responseTime}ms)`);

          setResults({
            exactMatches: result.exactMatches,
            wildcardMatches: [],
            additionalWildcardMatches: result.additionalMatches || [],
            shorterMatches: result.partialMatches,
            patternMatches: []
          });
        }

      } catch (err) {
        console.error('❌ Democratic anagram search error:', err);
        setError(err instanceof Error ? err.message : 'Error en la búsqueda');
        setResults({
          exactMatches: [],
          wildcardMatches: [],
          additionalWildcardMatches: [],
          shorterMatches: [],
          patternMatches: []
        });
      } finally {
        setIsLoading(false);
      }
    };

    searchAnagrams();
  }, [searchTerm, showShorter, targetLength, trie]);

  return {
    results,
    isLoading,
    error
  };
};