import { supabase } from "@/integrations/supabase/client";
import { processDigraphs, toDisplayFormat } from "./digraphs";

// Cache local para evitar queries repetidas de hooks
const hooksCache = new Map<string, HookInfo>();
const HOOKS_CACHE_STATS = { hits: 0, misses: 0 };

export interface HookInfo {
  word: string;
  leftExternal?: string;
  rightExternal?: string;
  leftInternal?: string;
  rightInternal?: string;
  hasExternalHooks: boolean;
  hasInternalHooks: boolean;
}

export interface ProcessedHooks {
  leftExternal: string[];
  rightExternal: string[];
  hasLeftInternal: boolean;
  hasRightInternal: boolean;
  leftInternalLetters: string[];
  rightInternalLetters: string[];
}

/**
 * Versión optimizada de fetchHooksData con cache local
 * Misma estrategia que funcionó para leaves: cache + batch queries
 */
export async function fetchHooksData(words: string[]): Promise<Map<string, HookInfo>> {
  const results = new Map<string, HookInfo>();
  
  if (words.length === 0) {
    console.log('🎣 fetchHooksData: No words provided');
    return results;
  }

  console.log(`🎣 fetchHooksData called with ${words.length} words - checking cache first`);

  // Separar palabras cacheadas vs no cacheadas
  const uncachedWords: string[] = [];
  const wordToInternalMap = new Map<string, string>();
  
  for (const word of words) {
    const upperKey = toDisplayFormat(word).toUpperCase();
    const internalWord = processDigraphs(word.toLowerCase());
    
    wordToInternalMap.set(word, internalWord);
    
    if (hooksCache.has(upperKey)) {
      HOOKS_CACHE_STATS.hits++;
      results.set(upperKey, hooksCache.get(upperKey)!);
      console.log(`🎯 Cache HIT for: ${word}`);
    } else {
      uncachedWords.push(word);
    }
  }

  // Si todas estaban en cache, devolver resultados
  if (uncachedWords.length === 0) {
    console.log(`🚀 All ${words.length} hooks found in cache - no database query needed!`);
    return results;
  }

  console.log(`🔍 Cache MISS for ${uncachedWords.length} words, querying database...`);
  HOOKS_CACHE_STATS.misses += uncachedWords.length;

  try {
    // Convert solo las no-cacheadas a internal format
    const internalWords = uncachedWords.map(word => wordToInternalMap.get(word)!);
    
    // Batch query optimizada para solo las palabras no cacheadas
    const { data: hooksData, error } = await supabase
      .from('hooks')
      .select(`
        word,
        left_external,
        right_external,
        left_internal,
        right_internal,
        has_external_hooks,
        has_internal_hooks
      `)
      .in('word', internalWords);

    if (error) {
      console.error('❌ Hooks table error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      
      // Check if it's a table not found error
      if (error.message && error.message.includes('does not exist')) {
        console.error('❌ HOOKS TABLE DOES NOT EXIST! Need to import hooks.csv first');
      }
      
      throw error;
    }

    console.log('✅ Hooks response received');
    console.log('✅ Hooks data:', hooksData);
    console.log('✅ Number of hooks found:', hooksData?.length || 0);
    
    // Log each hook found for debugging
    if (hooksData && hooksData.length > 0) {
      hooksData.forEach((hook, index) => {
        console.log(`🎣 Hook ${index + 1}:`, hook);
      });
    } else {
      console.warn('⚠️ No hooks data returned from database');
    }

    if (hooksData && hooksData.length > 0) {
      // Create map with original word as key (solo para uncached words)
      const internalToOriginal = new Map<string, string>();
      uncachedWords.forEach(word => {
        const internal = wordToInternalMap.get(word)!;
        internalToOriginal.set(internal, word);
      });

      hooksData.forEach(hook => {
        const originalWord = internalToOriginal.get(hook.word) || hook.word;
        
        const hookInfo: HookInfo = {
          word: originalWord,
          leftExternal: hook.left_external || undefined,
          rightExternal: hook.right_external || undefined,
          leftInternal: hook.left_internal || undefined,
          rightInternal: hook.right_internal || undefined,
          hasExternalHooks: hook.has_external_hooks === "1",
          hasInternalHooks: hook.has_internal_hooks === "1"
        };

        console.log(`🎣 Processed hooks for: ${originalWord}`, hookInfo);
        const upperKey = toDisplayFormat(originalWord).toUpperCase();
        
        // Guardar en cache Y en results
        hooksCache.set(upperKey, hookInfo);
        results.set(upperKey, hookInfo);
      });
    }

    // Add empty entries for uncached words without hooks
    uncachedWords.forEach(word => {
      const upperKey = toDisplayFormat(word).toUpperCase();
      if (!results.has(upperKey)) {
        const emptyHookInfo: HookInfo = {
          word,
          hasExternalHooks: false,
          hasInternalHooks: false
        };
        
        // Guardar en cache Y en results (incluso empty entries para evitar re-queries)
        hooksCache.set(upperKey, emptyHookInfo);
        results.set(upperKey, emptyHookInfo);
      }
    });

    // Log performance improvement
    console.log(`🚀 Hooks optimization: ${uncachedWords.length} words queried (vs ${words.length} individual calls)`);
    
    // Log cache stats periodically
    if ((HOOKS_CACHE_STATS.hits + HOOKS_CACHE_STATS.misses) % 25 === 0) {
      const total = HOOKS_CACHE_STATS.hits + HOOKS_CACHE_STATS.misses;
      const hitRate = ((HOOKS_CACHE_STATS.hits / total) * 100).toFixed(1);
      console.log(`📊 Hooks Cache Stats: ${HOOKS_CACHE_STATS.hits}/${total} hits (${hitRate}% hit rate)`);
    }

  } catch (error) {
    console.error('❌ Error fetching hooks data:', error);
    
    // Return empty hook info for uncached words on error (cached already in results)
    uncachedWords.forEach(word => {
      const upperKey = toDisplayFormat(word).toUpperCase();
      const emptyHookInfo: HookInfo = {
        word,
        hasExternalHooks: false,
        hasInternalHooks: false
      };
      
      // Cache empty results to avoid repeated failed queries
      hooksCache.set(upperKey, emptyHookInfo);
      results.set(upperKey, emptyHookInfo);
    });
  }

  return results;
}

export function processHooks(hookInfo: HookInfo): ProcessedHooks {
  const processed: ProcessedHooks = {
    leftExternal: [],
    rightExternal: [],
    hasLeftInternal: false,
    hasRightInternal: false,
    leftInternalLetters: [],
    rightInternalLetters: []
  };

  // Process external hooks - convert back to display format
  if (hookInfo.leftExternal) {
    processed.leftExternal = hookInfo.leftExternal.split('').map(letter => 
      toDisplayFormat(letter)
    );
  }

  if (hookInfo.rightExternal) {
    processed.rightExternal = hookInfo.rightExternal.split('').map(letter => 
      toDisplayFormat(letter)
    );
  }

  // Process internal hooks
  if (hookInfo.leftInternal) {
    processed.hasLeftInternal = true;
    processed.leftInternalLetters = hookInfo.leftInternal.split('').map(letter => 
      toDisplayFormat(letter)
    );
  }

  if (hookInfo.rightInternal) {
    processed.hasRightInternal = true;
    processed.rightInternalLetters = hookInfo.rightInternal.split('').map(letter => 
      toDisplayFormat(letter)
    );
  }

  return processed;
}

export function formatHooksForDisplay(word: string, hooks: ProcessedHooks): {
  leftHooks: string[];
  rightHooks: string[];
  displayWord: string;
} {
  const displayWord = toDisplayFormat(word);
  
  return {
    leftHooks: hooks.leftExternal,
    rightHooks: hooks.rightExternal,
    displayWord
  };
}