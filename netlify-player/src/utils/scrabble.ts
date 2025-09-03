import { supabase } from "@/integrations/supabase/client";

export const isValidWord = async (word: string): Promise<boolean> => {
  if (!word.trim()) return false;
  
  const { data, error } = await supabase
    .from('words')
    .select('word')
    .eq('word', word.toUpperCase())
    .maybeSingle();

  if (error) {
    console.error('Error checking word:', error);
    return false;
  }

  return data !== null;
};

export const countWords = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error counting words:', error);
    throw error;
  }

  console.log('Total words in database:', count);
  return count || 0;
};

// Add a quick console log to help us confirm the count
(async () => {
  try {
    const totalWords = await countWords();
    console.log(`Total words in the database: ${totalWords}`);
  } catch (error) {
    console.error('Error getting word count:', error);
  }
})();