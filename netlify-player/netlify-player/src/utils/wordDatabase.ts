import { supabase } from "@/integrations/supabase/client";

export interface WordData {
  word: string;
  isValid: boolean;
  etymology?: string;
  etymologyLanguage?: string;
  definitions?: Array<{
    definition: string;
    partOfSpeech?: string;
    domain?: string;
    usage?: string;
  }>;
  scrabblePoints?: number;
}

export async function fetchWordData(word: string): Promise<WordData> {
  const normalizedWord = word.toLowerCase().trim();
  
  try {
    // Check if word is valid for Scrabble
    const { data: scrabbleData } = await supabase
      .from('words')
      .select('word')
      .eq('word', word.toUpperCase())
      .single();
    
    const isValid = !!scrabbleData;
    
    // Try to get dictionary entry
    const { data: entryData } = await supabase
      .from('dictionary_entries')
      .select(`
        key,
        lemma,
        etymology_info,
        etymology_language,
        dictionary_senses (
          definition,
          part_of_speech_1,
          domain,
          usage
        )
      `)
      .ilike('lemma', normalizedWord)
      .limit(1)
      .single();

    const result: WordData = {
      word,
      isValid,
    };

    if (entryData) {
      result.etymology = entryData.etymology_info || undefined;
      result.etymologyLanguage = entryData.etymology_language || undefined;
      
      if (entryData.dictionary_senses && entryData.dictionary_senses.length > 0) {
        result.definitions = entryData.dictionary_senses.map((sense: any) => ({
          definition: sense.definition,
          partOfSpeech: sense.part_of_speech_1 || undefined,
          domain: sense.domain || undefined,
          usage: sense.usage || undefined,
        }));
      }
    }

    // Try to calculate Scrabble points (basic implementation)
    if (isValid) {
      result.scrabblePoints = calculateScrabblePoints(word);
    }

    return result;

  } catch (error) {
    console.error('Error fetching word data:', error);
    
    // Return basic data even if database query fails
    return {
      word,
      isValid: false, // Conservative approach if we can't verify
    };
  }
}

function calculateScrabblePoints(word: string): number {
  const pointValues: { [key: string]: number } = {
    'A': 1, 'E': 1, 'I': 1, 'L': 1, 'N': 1, 'O': 1, 'R': 1, 'S': 1, 'T': 1, 'U': 1,
    'D': 2, 'G': 2,
    'B': 3, 'C': 3, 'M': 3, 'P': 3,
    'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
    'K': 5,
    'J': 8, 'X': 8,
    'Q': 10, 'Z': 10,
    'Ñ': 8, // Spanish specific
    'LL': 8, 'RR': 8, 'CH': 5 // Spanish digraphs
  };

  let points = 0;
  const upperWord = word.toUpperCase();
  
  // Handle Spanish digraphs first
  let processedWord = upperWord;
  processedWord = processedWord.replace(/CH/g, 'Ç'); // Temporary replacement
  processedWord = processedWord.replace(/LL/g, 'K'); // Temporary replacement  
  processedWord = processedWord.replace(/RR/g, 'W'); // Temporary replacement

  for (const char of processedWord) {
    if (char === 'Ç') points += 5; // CH
    else if (char === 'K') points += 8; // LL  
    else if (char === 'W') points += 8; // RR
    else points += pointValues[char] || 0;
  }

  return points;
}