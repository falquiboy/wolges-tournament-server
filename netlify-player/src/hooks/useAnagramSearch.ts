import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { processDigraphs, generateAlphagram, toDisplayFormat } from "@/utils/digraphs";
import { useMemo } from "react";

// Spanish alphabet including digraphs in specified order
const SPANISH_LETTERS = ["A", "B", "C", "Ç", "CH", "D", "E", "F", "G", "H", "I", "J", "K", "L", "LL", "M", "N", "Ñ", "O", "P", "Q", "R", "RR", "S", "T", "U", "V", "W", "X", "Y", "Z"];

// Increased batch size for more efficient querying
const BATCH_SIZE = 50;

type AnagramResults = {
  exactMatches: string[];
  wildcardMatches: string[];
  additionalWildcardMatches: string[];
};

export const useAnagramSearch = (searchTerm: string) => {
  // Memoize the initial processing of the search term
  const { wildcardCount, processedInput, targetAlphagram, inputLength } = useMemo(() => {
    const count = (searchTerm.match(/\?/g) || []).length;
    const lettersOnly = searchTerm.replace(/\?/g, '');
    const processed = processDigraphs(lettersOnly);
    return {
      wildcardCount: count,
      processedInput: processed,
      targetAlphagram: generateAlphagram(processed),
      inputLength: processed.length
    };
  }, [searchTerm]);

  return useQuery<AnagramResults>({
    queryKey: ["words", searchTerm],
    queryFn: async () => {
      if (!searchTerm) return { exactMatches: [], wildcardMatches: [], additionalWildcardMatches: [] };
      
      console.log('Search term:', searchTerm, 'Wildcard count:', wildcardCount);

      // Query exact matches first (when no wildcards)
      let exactMatches: string[] = [];
      if (wildcardCount === 0) {
        const { data: exactData, error: exactError } = await supabase
          .from("words")
          .select("word")
          .eq('length', inputLength)
          .eq('alphagram', targetAlphagram);

        if (exactError) {
          console.error("Supabase error (exact):", exactError);
        } else {
          exactMatches = exactData?.map(d => toDisplayFormat(d.word)) || [];
        }
      }

      // For wildcard searches, we need to try all possible letter combinations
      let wildcardMatches: string[] = [];
      let additionalWildcardMatches: string[] = [];
      
      if (wildcardCount > 0) {
        // Generate combinations more efficiently
        const generateCombinations = (depth: number): string[] => {
          if (depth === 0) return [''];
          
          const results: string[] = [];
          const previousCombinations = generateCombinations(depth - 1);
          
          for (const prev of previousCombinations) {
            for (const letter of SPANISH_LETTERS) {
              results.push(prev + letter);
            }
          }
          return results;
        };

        // Get combinations for current wildcard count
        const possibleCombinations = generateCombinations(wildcardCount);
        console.log(`Generated ${possibleCombinations.length} combinations for current wildcards`);

        // Process combinations in batches
        for (let i = 0; i < possibleCombinations.length; i += BATCH_SIZE) {
          const batch = possibleCombinations.slice(i, i + BATCH_SIZE);
          const alphagrams = batch.map(combo => generateAlphagram(processedInput + combo));
          
          const { data, error } = await supabase
            .from("words")
            .select("word")
            .eq('length', inputLength + wildcardCount)
            .in('alphagram', alphagrams);

          if (error) {
            console.error(`Supabase error for batch ${i}:`, error);
            continue;
          }

          if (data) {
            wildcardMatches.push(...data.map(d => toDisplayFormat(d.word)));
          }
        }

        // Generate combinations for additional wildcard
        const additionalCombinations = generateCombinations(wildcardCount + 1);
        console.log(`Generated ${additionalCombinations.length} combinations for additional wildcard`);
        
        // Process additional combinations in batches
        for (let i = 0; i < additionalCombinations.length; i += BATCH_SIZE) {
          const batch = additionalCombinations.slice(i, i + BATCH_SIZE);
          const alphagrams = batch.map(combo => generateAlphagram(processedInput + combo));
          
          const { data, error } = await supabase
            .from("words")
            .select("word")
            .eq('length', inputLength + wildcardCount + 1)
            .in('alphagram', alphagrams);

          if (error) {
            console.error(`Supabase error for batch ${i}:`, error);
            continue;
          }

          if (data) {
            additionalWildcardMatches.push(...data.map(d => toDisplayFormat(d.word)));
          }
        }

        // Remove duplicates
        wildcardMatches = Array.from(new Set(wildcardMatches));
        additionalWildcardMatches = Array.from(new Set(additionalWildcardMatches));
      }

      console.log('Results count:', {
        exact: exactMatches.length,
        wildcard: wildcardMatches.length,
        additional: additionalWildcardMatches.length
      });
      
      return {
        exactMatches,
        wildcardMatches,
        additionalWildcardMatches
      };
    },
    enabled: Boolean(searchTerm)
  });
};
