import { supabase } from "@/integrations/supabase/client";
import { fetchVerbInfo, fetchBatchVerbInfo, VerbInfo } from "./verbData";
import { processDigraphs } from "./digraphs";

// Cache local para evitar queries repetidas de anagramWordData
const anagramWordCache = new Map<string, AnagramWordInfo>();
const ANAGRAM_CACHE_STATS = { hits: 0, misses: 0 };

export interface AnagramWordInfo {
  word: string;
  lemma?: string;
  partOfSpeech?: string;
  wordType?: 'femenino' | 'plural' | 'conjugación' | 'variante' | 'base';
  shortDefinition?: string; // Complete definition
  isScrabbleValid?: boolean;
  // Verb-specific information
  isVerb?: boolean;
  verbInfo?: VerbInfo;
}

export async function fetchAnagramWordsData(words: string[]): Promise<Map<string, AnagramWordInfo>> {
  const results = new Map<string, AnagramWordInfo>();
  
  if (words.length === 0) return results;

  console.log(`🔍 fetchAnagramWordsData called with ${words.length} words - checking cache first`);

  // Separar palabras cacheadas vs no cacheadas (mismo patrón que leaves/hooks)
  const uncachedWords: string[] = [];
  
  for (const word of words) {
    if (anagramWordCache.has(word)) {
      ANAGRAM_CACHE_STATS.hits++;
      results.set(word, anagramWordCache.get(word)!);
      console.log(`🎯 AnagramWord Cache HIT for: ${word}`);
    } else {
      uncachedWords.push(word);
    }
  }

  // Si todas estaban en cache, devolver resultados
  if (uncachedWords.length === 0) {
    console.log(`🚀 All ${words.length} anagram words found in cache - no database queries needed!`);
    return results;
  }

  console.log(`🔍 Cache MISS for ${uncachedWords.length} words, querying database...`);
  ANAGRAM_CACHE_STATS.misses += uncachedWords.length;

  try {
    // Words are already in uppercase from ResultsList
    
    // Step 1: Query lexicon_keys table first to determine word types through key assignments
    console.log('📊 Step 1: Querying lexicon_keys table...');
    
    // Normalize uncached words (uppercase for lexicon_keys, NO digraph processing yet - DB has display format)
    const normalizedWords = uncachedWords.map(word => word.toUpperCase());
    console.log('📊 Normalized uncached words (uppercase for lexicon_keys) for query:', normalizedWords);
    
    // Create mapping from normalized word back to original words for result association
    const normalizedToOriginal = new Map<string, string[]>();
    uncachedWords.forEach(originalWord => {
      const normalized = originalWord.toUpperCase(); // No digraph processing here, uppercase for lexicon_keys
      if (!normalizedToOriginal.has(normalized)) {
        normalizedToOriginal.set(normalized, []);
      }
      normalizedToOriginal.get(normalized)!.push(originalWord);
    });
    
    const { data: scrabbleData, error: scrabbleError } = await supabase
      .from('lexicon_keys')
      .select('norm_word, key_lemma, key_feminine, key_plural, key_conj, key_variant')
      .in('norm_word', normalizedWords);

    if (scrabbleError) {
      console.error('❌ Lexicon keys table error:', scrabbleError);
      throw scrabbleError;
    }

    console.log('✅ Lexicon keys response:', scrabbleData);
    console.log('✅ Number of rows returned:', scrabbleData?.length || 0);
    if (scrabbleData && scrabbleData.length > 0) {
      console.log('✅ First row example:', scrabbleData[0]);
    }

    // Step 2: Determine word types and collect all keys
    const allKeys = new Set<number>();
    const wordToKeys = new Map<string, Record<string, string>>();
    const wordTypes = new Map<string, string>();

    if (scrabbleData && scrabbleData.length > 0) {
      scrabbleData.forEach(row => {
        // Map normalized word to database row
        wordToKeys.set(row.norm_word, row);
        wordToKeys.set(row.norm_word.toUpperCase(), row);
        
        // Also map all original words that normalize to this result
        const originalWords = normalizedToOriginal.get(row.norm_word) || [];
        originalWords.forEach(originalWord => {
          wordToKeys.set(originalWord, row);
          wordToKeys.set(originalWord.toUpperCase(), row);
        });
        
        // Helper function to parse keys (handle comma-separated and decimal values)
        const parseKeys = (keyString: string) => {
          if (!keyString) return [];
          return keyString.split(',').map(k => parseFloat(k.trim())).filter(k => !isNaN(k));
        };

        // Determine word type with priority: conjugación first, then others
        // Within each type, use the smallest key (earliest/etymological antecedent)
        let wordType = 'base';
        let primaryKeys: number[] = [];
        
        // Priority 1: Conjugación (privileged)
        if (row.key_conj) {
          wordType = 'conjugación';
          primaryKeys = parseKeys(row.key_conj);
        }
        // Priority 2: Other types
        else if (row.key_feminine) {
          wordType = 'femenino';
          primaryKeys = parseKeys(row.key_feminine);
        } else if (row.key_plural) {
          wordType = 'plural';
          primaryKeys = parseKeys(row.key_plural);
        } else if (row.key_variant) {
          wordType = 'variante';
          primaryKeys = parseKeys(row.key_variant);
        } else if (row.key_lemma) {
          wordType = 'base';
          primaryKeys = parseKeys(row.key_lemma);
        }
        
        // Add all keys to the collection
        primaryKeys.forEach(key => allKeys.add(key));
        
        wordTypes.set(row.norm_word, wordType);
        wordTypes.set(row.norm_word.toUpperCase(), wordType);
        
        // Also map word types for all original words that normalize to this result
        originalWords.forEach(originalWord => {
          wordTypes.set(originalWord, wordType);
          wordTypes.set(originalWord.toUpperCase(), wordType);
        });
      });
    }

    console.log('📝 Word types determined:', Object.fromEntries(wordTypes));
    console.log('🔑 All keys to fetch:', Array.from(allKeys));

    // Step 3: Fetch dictionary information using the keys
    const keyToEntry = new Map();
    const keyToSenses = new Map();
    
    if (allKeys.size > 0) {
      // Fetch dictionary entries
      console.log('📚 Step 3a: Fetching dictionary entries...');
      const { data: entries, error: entriesError } = await supabase
        .from('dictionary_entries')
        .select('key, lemma, etymology_info')
        .in('key', Array.from(allKeys));
      
      if (entriesError) {
        console.error('❌ Dictionary entries error:', entriesError);
      } else {
        console.log('✅ Dictionary entries response:', entries);
        if (entries) {
          entries.forEach(entry => {
            keyToEntry.set(entry.key, entry);
          });
        }
      }

      // Fetch dictionary senses
      console.log('📖 Step 3b: Fetching dictionary senses...');
      const { data: senses, error: sensesError } = await supabase
        .from('dictionary_senses')
        .select('entry_key, definition, part_of_speech_1')
        .in('entry_key', Array.from(allKeys));
      
      if (sensesError) {
        console.error('❌ Dictionary senses error:', sensesError);
      } else {
        console.log('✅ Dictionary senses response:', senses);
        if (senses) {
          // Group senses by entry_key
          senses.forEach(sense => {
            if (!keyToSenses.has(sense.entry_key)) {
              keyToSenses.set(sense.entry_key, []);
            }
            keyToSenses.get(sense.entry_key).push(sense);
          });
        }
      }
    }

    // Helper function to normalize lemma by removing homonym digit
    const normalizeLemma = (lemma: string) => {
      // Remove digit at the end for homonym normalization (e.g., "ser2" → "ser")
      return lemma.replace(/\d+$/, '');
    };

    // Step 4: Collect all potential verb lemmas for batch query
    console.log('🔄 Step 4a: Collecting potential verb lemmas for batch query...');
    const potentialVerbLemmas = new Set<string>();
    
    for (const word of uncachedWords) {
      const scrabbleInfo = wordToKeys.get(word);
      if (scrabbleInfo) {
        const parseKeys = (keyString: string) => {
          if (!keyString) return null;
          const keys = keyString.split(',').map(k => parseFloat(k.trim())).filter(k => !isNaN(k));
          return keys.length > 0 ? Math.min(...keys) : null;
        };

        const primaryKey = parseKeys(scrabbleInfo.key_conj) ||
                        parseKeys(scrabbleInfo.key_feminine) || 
                        parseKeys(scrabbleInfo.key_plural) || 
                        parseKeys(scrabbleInfo.key_variant) ||
                        parseKeys(scrabbleInfo.key_lemma);
        
        const entry = keyToEntry.get(primaryKey);
        let lemmaToCheck = entry?.lemma || word.toLowerCase();
        
        // Normalize lemma by removing homonym digit for verb lookup
        const normalizedLemma = normalizeLemma(lemmaToCheck);
        
        // Add both the normalized lemma and base form (without -se) for pronominal verbs
        potentialVerbLemmas.add(normalizedLemma);
        if (normalizedLemma.endsWith('se')) {
          potentialVerbLemmas.add(normalizedLemma.slice(0, -2)); // Remove 'se'
        }
      }
    }

    // Batch query para todos los verbos potenciales
    console.log(`🚀 Step 4b: Batch querying ${potentialVerbLemmas.size} potential verb lemmas...`);
    const verbInfoMap = potentialVerbLemmas.size > 0 
      ? await fetchBatchVerbInfo(Array.from(potentialVerbLemmas))
      : new Map<string, VerbInfo | null>();

    // Step 4c: Process each uncached word and build final results
    console.log('🔄 Step 4c: Processing uncached words...');
    for (const word of uncachedWords) {
      const scrabbleInfo = wordToKeys.get(word);
      const wordType = wordTypes.get(word);
      
      if (scrabbleInfo) {
        // Word is valid for Scrabble
        // Helper function to parse and get smallest key (earliest/etymological antecedent)
        const parseKeys = (keyString: string) => {
          if (!keyString) return null;
          const keys = keyString.split(',').map(k => parseFloat(k.trim())).filter(k => !isNaN(k));
          return keys.length > 0 ? Math.min(...keys) : null;
        };

        // Priority order: conjugación first, then others
        const primaryKey = parseKeys(scrabbleInfo.key_conj) ||
                        parseKeys(scrabbleInfo.key_feminine) || 
                        parseKeys(scrabbleInfo.key_plural) || 
                        parseKeys(scrabbleInfo.key_variant) ||
                        parseKeys(scrabbleInfo.key_lemma);
        
        const entry = keyToEntry.get(primaryKey);
        const senses = keyToSenses.get(primaryKey) || [];
        
        console.log(`🔑 Word: ${word}, Type: ${wordType}, Primary Key: ${primaryKey} (smallest), Entry:`, entry);
        console.log(`🔍 Available keys - conj: ${scrabbleInfo.key_conj}, fem: ${scrabbleInfo.key_feminine}, plural: ${scrabbleInfo.key_plural}, variant: ${scrabbleInfo.key_variant}, lemma: ${scrabbleInfo.key_lemma}`);
        
        // Get verb info from batch result (NO individual queries!)
        let lemmaToCheck = entry?.lemma || word.toLowerCase();
        let verbInfo = null;
        
        // Normalize lemma for verb lookup (remove homonym digits like "ser2" → "ser")
        const normalizedLemmaForLookup = normalizeLemma(lemmaToCheck);
        
        // Check batch results for verb info using normalized lemma
        if (normalizedLemmaForLookup.endsWith('se')) {
          const baseForm = normalizedLemmaForLookup.slice(0, -2); // Remove 'se'
          console.log(`🔄 Checking pronominal verb in batch results: ${lemmaToCheck} → ${normalizedLemmaForLookup} → ${baseForm}`);
          verbInfo = verbInfoMap.get(baseForm);
          if (!verbInfo) {
            // Fallback to full normalized lemma from batch results
            verbInfo = verbInfoMap.get(normalizedLemmaForLookup);
          }
          if (verbInfo) {
            console.log(`✅ Found verb info in batch for: ${verbInfo.norm_lemma}`, verbInfo);
          }
        } else {
          console.log(`🔄 Checking normalized verb in batch results: ${lemmaToCheck} → ${normalizedLemmaForLookup}`);
          verbInfo = verbInfoMap.get(normalizedLemmaForLookup);
          if (verbInfo) {
            console.log(`✅ Found verb info in batch for: ${normalizedLemmaForLookup}`, verbInfo);
          }
        }
        
        let shortDefinition = '';
        let partOfSpeech = '';
        
        if (verbInfo) {
          // Use verb-specific information
          console.log(`🌟 Found verb info for: ${word}`, verbInfo);
          shortDefinition = verbInfo.prime_sense || '';
          partOfSpeech = 'verbo';
        } else {
          // Use dictionary senses
          if (senses.length > 0) {
            const firstSense = senses[0];
            if (firstSense.definition) {
              shortDefinition = firstSense.definition;
            }
            partOfSpeech = firstSense.part_of_speech_1 || '';
          }
        }
        
        const wordInfo: AnagramWordInfo = {
          word,
          isScrabbleValid: true,
          lemma: entry?.lemma || verbInfo?.norm_lemma || word.toLowerCase(),
          partOfSpeech,
          wordType: wordType as 'femenino' | 'plural' | 'conjugación' | 'variante' | 'base',
          shortDefinition,
          isVerb: !!verbInfo,
          verbInfo: verbInfo || undefined
        };
        
        console.log(`✅ Processed valid word: ${word}`, wordInfo);
        
        // Guardar en cache Y en results
        anagramWordCache.set(word, wordInfo);
        results.set(word, wordInfo);
      } else {
        // Word not found in lexicon_keys
        const wordInfo: AnagramWordInfo = {
          word,
          isScrabbleValid: false
        };
        
        console.log(`❌ Word not valid for Scrabble: ${word}`);
        
        // Guardar en cache Y en results (incluso invalid words para evitar re-queries)
        anagramWordCache.set(word, wordInfo);
        results.set(word, wordInfo);
      }
    }

    // Log performance improvement
    console.log(`🚀 AnagramWord optimization: ${uncachedWords.length} words processed with ${potentialVerbLemmas.size} verb batch queries (vs ${uncachedWords.length} individual verb calls)`);
    
    // Log cache stats periodically
    if ((ANAGRAM_CACHE_STATS.hits + ANAGRAM_CACHE_STATS.misses) % 20 === 0) {
      const total = ANAGRAM_CACHE_STATS.hits + ANAGRAM_CACHE_STATS.misses;
      const hitRate = ((ANAGRAM_CACHE_STATS.hits / total) * 100).toFixed(1);
      console.log(`📊 AnagramWord Cache Stats: ${ANAGRAM_CACHE_STATS.hits}/${total} hits (${hitRate}% hit rate)`);
    }

  } catch (error) {
    console.error('❌ Error fetching anagram words data:', error);
    
    // Return basic info for uncached words on error (cached already in results)
    uncachedWords.forEach(word => {
      const errorWordInfo: AnagramWordInfo = { word, isScrabbleValid: false };
      // Cache error results to avoid repeated failed queries
      anagramWordCache.set(word, errorWordInfo);
      results.set(word, errorWordInfo);
    });
  }

  return results;
}